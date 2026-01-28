/**
 * Script to generate district boundary data for OSM maps
 * 
 * This script fetches district boundaries from Nominatim (OpenStreetMap)
 * and saves them as static JSON files for each state.
 * 
 * Output:
 *   public/data/{state}/boundaries.json - GeoJSON FeatureCollection of all district boundaries
 * 
 * Usage:
 *   bun scripts/generate-boundaries.ts                          # All states (skip existing)
 *   bun scripts/generate-boundaries.ts --state=karnataka        # Specific state
 *   bun scripts/generate-boundaries.ts --state=assam --force    # Regenerate all
 *   bun scripts/generate-boundaries.ts --state=assam --retry-failed  # Retry only failed districts
 *   bun scripts/generate-boundaries.ts --state=assam --district=Morigaon  # Retry specific district
 *   bun scripts/generate-boundaries.ts --state=assam --district=Morigaon --osm-name=Marigaon  # Use specific OSM name
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
  'Assam': {
    'Morigaon': 'Marigaon',  // OSM uses local spelling
  },
};

/**
 * Build alternative search queries for a district
 * Returns an array of queries to try in order
 * @param osmNameOverride - If provided, uses this name instead of looking up aliases
 */
function buildSearchQueries(stateName: string, districtName: string, osmNameOverride?: string): string[] {
  const osmDistrictName = osmNameOverride || getOSMDistrictName(stateName, districtName);

  return [
    // Standard format
    `${osmDistrictName} district, ${stateName}, India`,
    // Without "district" suffix
    `${osmDistrictName}, ${stateName}, India`,
    // With "District" capitalized
    `${osmDistrictName} District, ${stateName}, India`,
    // Administrative boundary format
    `${osmDistrictName}, ${stateName}`,
    // Try with dashes replaced by spaces (for names like "Dima Hasao")
    `${osmDistrictName.replace(/-/g, ' ')} district, ${stateName}, India`,
  ];
}

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
 * Fetch district boundary from Nominatim with a specific query
 */
async function fetchWithQuery(query: string): Promise<GeoJSONFeature | null> {
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
      return null;
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return null;
    }

    const feature = data.features[0];

    // Only accept Polygon or MultiPolygon geometries
    if (feature.geometry?.type !== 'Polygon' && feature.geometry?.type !== 'MultiPolygon') {
      return null;
    }

    return feature;
  } catch {
    return null;
  }
}

/**
 * Fetch district boundary from Nominatim using multiple query strategies
 * @param osmNameOverride - If provided, uses this name instead of looking up aliases
 */
async function fetchDistrictBoundary(
  stateName: string,
  districtName: string,
  verbose: boolean = false,
  osmNameOverride?: string
): Promise<GeoJSONFeature | null> {
  const queries = buildSearchQueries(stateName, districtName, osmNameOverride);

  if (osmNameOverride) {
    console.log(`  Using OSM name override: "${osmNameOverride}"`);
  }

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];

    if (verbose && i > 0) {
      process.stdout.write(`\n    Trying: "${query}"... `);
    }

    const feature = await fetchWithQuery(query);

    if (feature) {
      return {
        ...feature,
        properties: {
          ...feature.properties,
          districtName, // Store our canonical name
        },
      };
    }

    // Wait before trying the next query (rate limiting)
    if (i < queries.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  console.error(`\n  ✗ No polygon boundary found for ${districtName} after trying ${queries.length} query variations`);
  return null;
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
 * @param stateFolder - The state folder name
 * @param specificDistricts - Optional array of specific districts to process (for retry)
 * @param mergeWithExisting - Whether to merge with existing boundaries file
 * @param osmNameOverride - Optional OSM name to use (only applies when processing single district)
 */
async function generateBoundariesForState(
  stateFolder: string,
  specificDistricts?: string[],
  mergeWithExisting: boolean = false,
  osmNameOverride?: string
): Promise<void> {
  const stateName = getStateDisplayName(stateFolder);
  const allDistricts = getDistrictsForState(stateFolder);
  const districtsToProcess = specificDistricts || allDistricts;

  if (districtsToProcess.length === 0) {
    console.log(`  Skipping ${stateFolder} - no districts to process`);
    return;
  }

  console.log(`\n📍 Processing ${stateName} (${districtsToProcess.length} districts)`);

  // Load existing boundaries if merging
  const boundariesPath = path.join(PUBLIC_DATA_DIR, stateFolder, 'boundaries.json');
  let existingFeatures: GeoJSONFeature[] = [];
  let existingDistrictNames: Set<string> = new Set();

  if (mergeWithExisting && fs.existsSync(boundariesPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(boundariesPath, 'utf-8'));
      existingFeatures = existing.features || [];
      existingDistrictNames = new Set(existingFeatures.map(f => f.properties.districtName));
      console.log(`  ℹ Loaded ${existingFeatures.length} existing boundaries`);
    } catch {
      console.log(`  ⚠ Could not load existing boundaries, starting fresh`);
    }
  }

  const newFeatures: GeoJSONFeature[] = [];
  const failedDistricts: string[] = [];

  for (let i = 0; i < districtsToProcess.length; i++) {
    const district = districtsToProcess[i];
    process.stdout.write(`  [${i + 1}/${districtsToProcess.length}] ${district}... `);

    // Only use osmNameOverride for single district processing
    const overrideToUse = districtsToProcess.length === 1 ? osmNameOverride : undefined;
    const feature = await fetchDistrictBoundary(stateName, district, true, overrideToUse);

    if (feature) {
      newFeatures.push(feature);
      console.log('✓');
    } else {
      failedDistricts.push(district);
    }

    // Rate limiting - wait before next request
    if (i < districtsToProcess.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  // Merge features: replace existing with new, keep non-overlapping
  const mergedFeatures: GeoJSONFeature[] = [];
  const newDistrictNames = new Set(newFeatures.map(f => f.properties.districtName));

  // Keep existing features that weren't re-fetched
  for (const feature of existingFeatures) {
    if (!newDistrictNames.has(feature.properties.districtName)) {
      mergedFeatures.push(feature);
    }
  }

  // Add all new features
  mergedFeatures.push(...newFeatures);

  // Calculate total stats
  const totalDistrictCount = allDistricts.length;
  const allSuccessfulDistricts = new Set(mergedFeatures.map(f => f.properties.districtName));
  const allFailedDistricts = allDistricts.filter(d => !allSuccessfulDistricts.has(d));

  // Create output
  const output: BoundaryOutput = {
    type: 'FeatureCollection',
    generatedAt: new Date().toISOString(),
    state: stateName,
    districtCount: totalDistrictCount,
    successCount: mergedFeatures.length,
    failedDistricts: allFailedDistricts,
    features: mergedFeatures,
  };

  // Write to file in public/data for static serving
  const statePublicDir = path.join(PUBLIC_DATA_DIR, stateFolder);
  if (!fs.existsSync(statePublicDir)) {
    fs.mkdirSync(statePublicDir, { recursive: true });
  }
  fs.writeFileSync(boundariesPath, JSON.stringify(output, null, 2));

  console.log(`\n  ✅ Saved ${mergedFeatures.length}/${totalDistrictCount} boundaries to public/data/${stateFolder}/boundaries.json`);

  if (allFailedDistricts.length > 0) {
    console.log(`  ⚠ Failed districts: ${allFailedDistricts.join(', ')}`);
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
 * Get failed districts from existing boundaries file
 */
function getFailedDistrictsFromFile(stateFolder: string): string[] {
  const boundariesPath = path.join(PUBLIC_DATA_DIR, stateFolder, 'boundaries.json');
  if (!fs.existsSync(boundariesPath)) {
    return [];
  }

  try {
    const existing = JSON.parse(fs.readFileSync(boundariesPath, 'utf-8'));
    return existing.failedDistricts || [];
  } catch {
    return [];
  }
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
  const districtArg = args.find(arg => arg.startsWith('--district='));
  const osmNameArg = args.find(arg => arg.startsWith('--osm-name='));
  const specificState = stateArg?.split('=')[1];
  const specificDistrict = districtArg?.split('=')[1];
  const osmNameOverride = osmNameArg?.split('=')[1];

  // Check for flags
  const forceRegenerate = args.includes('--force');
  const retryFailed = args.includes('--retry-failed');

  // Validate arguments
  if ((specificDistrict || retryFailed) && !specificState) {
    console.error('Error: --district and --retry-failed require --state=<state>');
    process.exit(1);
  }

  if (osmNameOverride && !specificDistrict) {
    console.error('Error: --osm-name requires --district=<district>');
    process.exit(1);
  }

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

  // Handle specific district or retry-failed mode
  if (specificDistrict) {
    console.log(`Retrying specific district: ${specificDistrict}`);
    console.log(`State: ${specificState}`);
    if (osmNameOverride) {
      console.log(`OSM name override: ${osmNameOverride}`);
    }
    console.log(`Rate limit: ${REQUEST_DELAY_MS}ms between requests`);
    console.log('');

    await generateBoundariesForState(specificState!, [specificDistrict], true, osmNameOverride);
    return;
  }

  if (retryFailed) {
    const failedDistricts = getFailedDistrictsFromFile(specificState!);
    if (failedDistricts.length === 0) {
      console.log(`✅ No failed districts for ${specificState}`);
      return;
    }
    console.log(`Retrying ${failedDistricts.length} failed districts: ${failedDistricts.join(', ')}`);
    console.log(`State: ${specificState}`);
    console.log(`Rate limit: ${REQUEST_DELAY_MS}ms between requests`);
    console.log('');

    await generateBoundariesForState(specificState!, failedDistricts, true);
    return;
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
