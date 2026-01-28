/**
 * Script to generate district boundary data for OSM maps
 * 
 * This script fetches district boundaries from Nominatim (OpenStreetMap)
 * and saves them as static JSON files for each state.
 * 
 * Output:
 *   data/{state}/boundaries.json - GeoJSON FeatureCollection of all district boundaries
 * 
 * Run: bun scripts/generate-boundaries.ts
 * Run for specific state: bun scripts/generate-boundaries.ts --state=karnataka
 * 
 * Rate limiting: Nominatim requires max 1 request per second.
 * This script respects that limit with 1.1s delays between requests.
 */

import fs from 'fs';
import path from 'path';
import type { StateConfig } from '../types/state-config.js';

// Types
interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    name: string;
    display_name?: string;
    osm_id?: number;
    osm_type?: string;
    districtName: string; // Our canonical district name
    [key: string]: unknown;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  bbox?: [number, number, number, number];
}

interface BoundaryOutput {
  type: 'FeatureCollection';
  generatedAt: string;
  state: string;
  districtCount: number;
  successCount: number;
  failedDistricts: string[];
  features: GeoJSONFeature[];
}

// Constants
const DATA_DIR = path.join(process.cwd(), 'data');
const PUBLIC_DATA_DIR = path.join(process.cwd(), 'public', 'data');
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'RTOCodesIndia/1.0 (https://rto-codes.in; contact@rto-codes.in)';
const REQUEST_DELAY_MS = 1100; // 1.1 seconds between requests

/**
 * OSM District Name Mappings
 * Maps our district names to the names used in OpenStreetMap/Nominatim.
 */
const OSM_DISTRICT_ALIASES: Record<string, Record<string, string>> = {
  'Karnataka': {
    'Bengaluru Rural': 'Bengaluru North',
    'Bagalkot': 'Bagalkote',
    'Chikkaballapur': 'Chikkaballapura',
  },
};

/**
 * Get OSM-compatible district name
 */
function getOSMDistrictName(state: string, district: string): string {
  const stateAliases = OSM_DISTRICT_ALIASES[state];
  if (stateAliases && stateAliases[district]) {
    return stateAliases[district];
  }
  return district;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch district boundary from Nominatim
 */
async function fetchDistrictBoundary(
  stateName: string,
  districtName: string
): Promise<GeoJSONFeature | null> {
  const osmDistrictName = getOSMDistrictName(stateName, districtName);

  // Build search query: "District Name district, State, India"
  const query = `${osmDistrictName} district, ${stateName}, India`;
  const params = new URLSearchParams({
    q: query,
    format: 'geojson',
    polygon_geojson: '1',
    limit: '1',
  });

  try {
    const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`  ✗ HTTP error ${response.status} for ${districtName}`);
      return null;
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      // Try without "district" suffix
      const altParams = new URLSearchParams({
        q: `${osmDistrictName}, ${stateName}, India`,
        format: 'geojson',
        polygon_geojson: '1',
        limit: '1',
      });

      const altResponse = await fetch(`${NOMINATIM_BASE_URL}/search?${altParams}`, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
      });

      if (altResponse.ok) {
        const altData = await altResponse.json();
        if (altData.features && altData.features.length > 0) {
          const feature = altData.features[0];
          if (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon') {
            return {
              ...feature,
              properties: {
                ...feature.properties,
                districtName, // Store our canonical name
              },
            };
          }
        }
      }

      console.error(`  ✗ No boundary found for ${districtName}`);
      return null;
    }

    const feature = data.features[0];

    // Validate geometry type
    if (feature.geometry?.type !== 'Polygon' && feature.geometry?.type !== 'MultiPolygon') {
      console.error(`  ✗ Got ${feature.geometry?.type} instead of Polygon for ${districtName}`);
      return null;
    }

    return {
      ...feature,
      properties: {
        ...feature.properties,
        districtName, // Store our canonical name
      },
    };
  } catch (error) {
    console.error(`  ✗ Error fetching ${districtName}:`, error);
    return null;
  }
}

/**
 * Get state display name from folder name
 */
function getStateDisplayName(folderName: string): string {
  // Load config to get proper state name
  const configPath = path.join(DATA_DIR, folderName, 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config: StateConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config.name || folderName.split('-').map(w =>
        w.charAt(0).toUpperCase() + w.slice(1)
      ).join(' ');
    } catch {
      // Fall back to folder name
    }
  }

  return folderName.split('-').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');
}

/**
 * Get all districts for a state from config or RTO files
 */
function getDistrictsForState(stateFolder: string): string[] {
  const configPath = path.join(DATA_DIR, stateFolder, 'config.json');

  if (!fs.existsSync(configPath)) {
    console.warn(`  ⚠ No config.json found for ${stateFolder}`);
    return [];
  }

  try {
    const config: StateConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // First try districtMapping from config
    if (config.districtMapping && Object.keys(config.districtMapping).length > 0) {
      // Get unique district names (keys are actual district names)
      return Object.keys(config.districtMapping);
    }

    // If districtMapping is empty, fall back to extracting districts from RTO files
    console.log(`  ℹ districtMapping empty, extracting districts from RTO files...`);
    return extractDistrictsFromRTOFiles(stateFolder);
  } catch (error) {
    console.error(`  ✗ Error reading config for ${stateFolder}:`, error);
    return [];
  }
}

/**
 * Extract unique district names from RTO JSON files in a state folder
 */
function extractDistrictsFromRTOFiles(stateFolder: string): string[] {
  const statePath = path.join(DATA_DIR, stateFolder);
  const districts = new Set<string>();

  if (!fs.existsSync(statePath)) {
    return [];
  }

  const files = fs.readdirSync(statePath).filter(file =>
    file.endsWith('.json') &&
    !file.includes('index') &&
    !file.includes('config') &&
    !file.includes('validation-report') &&
    /^[a-z]{2}-\d+\.json$/i.test(file)
  );

  for (const file of files) {
    try {
      const filePath = path.join(statePath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const rtoData = JSON.parse(content);

      if (rtoData.district && typeof rtoData.district === 'string') {
        const district = rtoData.district.trim();
        if (district && district !== 'N/A' && district !== 'Unknown') {
          districts.add(district);
        }
      }
    } catch {
      // Skip files that can't be parsed
    }
  }

  const districtArray = Array.from(districts).sort();
  console.log(`  ℹ Found ${districtArray.length} unique districts from ${files.length} RTO files`);
  return districtArray;
}

/**
 * Generate boundaries for a single state
 */
async function generateBoundariesForState(stateFolder: string): Promise<void> {
  const stateName = getStateDisplayName(stateFolder);
  const districts = getDistrictsForState(stateFolder);

  if (districts.length === 0) {
    console.log(`  Skipping ${stateFolder} - no districts configured`);
    return;
  }

  console.log(`\n📍 Processing ${stateName} (${districts.length} districts)`);

  const features: GeoJSONFeature[] = [];
  const failedDistricts: string[] = [];

  for (let i = 0; i < districts.length; i++) {
    const district = districts[i];
    process.stdout.write(`  [${i + 1}/${districts.length}] ${district}... `);

    const feature = await fetchDistrictBoundary(stateName, district);

    if (feature) {
      features.push(feature);
      console.log('✓');
    } else {
      failedDistricts.push(district);
      console.log('✗');
    }

    // Rate limiting - wait before next request
    if (i < districts.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  // Create output
  const output: BoundaryOutput = {
    type: 'FeatureCollection',
    generatedAt: new Date().toISOString(),
    state: stateName,
    districtCount: districts.length,
    successCount: features.length,
    failedDistricts,
    features,
  };

  // Write to file in public/data for static serving
  const statePublicDir = path.join(PUBLIC_DATA_DIR, stateFolder);
  if (!fs.existsSync(statePublicDir)) {
    fs.mkdirSync(statePublicDir, { recursive: true });
  }
  const outputPath = path.join(statePublicDir, 'boundaries.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n  ✅ Saved ${features.length}/${districts.length} boundaries to public/data/${stateFolder}/boundaries.json`);

  if (failedDistricts.length > 0) {
    console.log(`  ⚠ Failed districts: ${failedDistricts.join(', ')}`);
  }
}

/**
 * Get all state directories that have config files
 */
function getStateDirectories(): string[] {
  return fs.readdirSync(DATA_DIR)
    .filter(item => {
      const itemPath = path.join(DATA_DIR, item);
      const configPath = path.join(itemPath, 'config.json');
      return fs.statSync(itemPath).isDirectory() && fs.existsSync(configPath);
    })
    .sort();
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('🗺️  Generate District Boundaries');
  console.log('================================');
  console.log('');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const stateArg = args.find(arg => arg.startsWith('--state='));
  const specificState = stateArg?.split('=')[1];

  // Check for --force flag to regenerate existing boundaries
  const forceRegenerate = args.includes('--force');

  let statesToProcess: string[];

  if (specificState) {
    // Process specific state
    if (!fs.existsSync(path.join(DATA_DIR, specificState))) {
      console.error(`Error: State folder '${specificState}' not found`);
      process.exit(1);
    }
    statesToProcess = [specificState];
  } else {
    // Process all states with config files
    statesToProcess = getStateDirectories();
  }

  console.log(`States to process: ${statesToProcess.join(', ')}`);
  console.log(`Rate limit: ${REQUEST_DELAY_MS}ms between requests`);

  if (!forceRegenerate) {
    console.log('(Use --force to regenerate existing boundaries)');
  }

  let totalDistricts = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let skippedStates = 0;

  for (const stateFolder of statesToProcess) {
    // Check if boundaries already exist in public/data (unless --force)
    const boundariesPath = path.join(PUBLIC_DATA_DIR, stateFolder, 'boundaries.json');
    if (!forceRegenerate && fs.existsSync(boundariesPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(boundariesPath, 'utf-8'));
        console.log(`\n⏭️  Skipping ${stateFolder} - boundaries.json exists (${existing.successCount} districts)`);
        skippedStates++;
        continue;
      } catch {
        // File exists but is invalid, regenerate
      }
    }

    await generateBoundariesForState(stateFolder);

    // Read back stats
    if (fs.existsSync(boundariesPath)) {
      const result = JSON.parse(fs.readFileSync(boundariesPath, 'utf-8'));
      totalDistricts += result.districtCount;
      totalSuccess += result.successCount;
      totalFailed += result.failedDistricts.length;
    }
  }

  console.log('\n================================');
  console.log('📊 Summary');
  console.log('================================');
  console.log(`States processed: ${statesToProcess.length - skippedStates}`);
  console.log(`States skipped (already exist): ${skippedStates}`);
  console.log(`Total districts: ${totalDistricts}`);
  console.log(`Successful: ${totalSuccess}`);
  console.log(`Failed: ${totalFailed}`);
  console.log('');
}

main().catch(console.error);
