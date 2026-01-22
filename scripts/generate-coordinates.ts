/**
 * Script to generate RTO coordinates data for OSM maps
 * 
 * This script fetches coordinates for all RTO offices using Nominatim (OpenStreetMap)
 * and saves them as static JSON files for each state.
 * 
 * Output:
 *   public/data/{state}/coordinates.json - Map of RTO code to coordinates
 * 
 * Run: bun scripts/generate-coordinates.ts
 * Run for specific state: bun scripts/generate-coordinates.ts --state=karnataka
 * 
 * Rate limiting: Nominatim requires max 1 request per second.
 * This script respects that limit with 1.1s delays between requests.
 */

import fs from 'fs';
import path from 'path';

// Types
interface RTOData {
  code: string;
  city: string;
  district: string;
  region: string;
  state: string;
}

interface Coordinate {
  lat: number;
  lon: number;
  displayName?: string;
}

interface CoordinatesOutput {
  generatedAt: string;
  state: string;
  rtoCount: number;
  successCount: number;
  failedRTOs: string[];
  coordinates: Record<string, Coordinate>;
}

// Constants
const DATA_DIR = path.join(process.cwd(), 'data');
const PUBLIC_DATA_DIR = path.join(process.cwd(), 'public', 'data');
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'RTOCodesIndia/1.0 (https://rto-codes.in; contact@rto-codes.in)';
const REQUEST_DELAY_MS = 1100; // 1.1 seconds between requests

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch coordinates for an RTO location from Nominatim
 */
async function fetchCoordinates(
  city: string,
  district: string,
  state: string,
  region?: string
): Promise<Coordinate | null> {
  // Clean city name - remove directional suffixes for geocoding
  const cleanCity = city
    .replace(/\s+(West|East|North|South|Central)$/i, '')
    .trim();

  // Try different query variations
  const queries = [
    // Try clean city name first (without West/East/etc.)
    cleanCity !== city ? `${cleanCity}, ${district}, ${state}, India` : null,
    // Original city name with district
    `${city}, ${district}, ${state}, India`,
    // Just the city with state
    `${city}, ${state}, India`,
    // Use region if different from city
    region && region !== city ? `${region}, ${district}, ${state}, India` : null,
    // Fall back to district center
    `${district}, ${state}, India`,
  ].filter((q): q is string => q !== null);

  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '1',
      });

      const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params}`, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();

      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          displayName: data[0].display_name,
        };
      }
    } catch {
      continue;
    }

    // Rate limit between attempts
    await sleep(REQUEST_DELAY_MS);
  }

  return null;
}

/**
 * Get state display name from folder name
 */
function getStateDisplayName(folderName: string): string {
  return folderName.split('-').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');
}

/**
 * Get all RTOs for a state
 */
function getRTOsForState(stateFolder: string): RTOData[] {
  const indexPath = path.join(DATA_DIR, stateFolder, 'index.json');

  if (!fs.existsSync(indexPath)) {
    console.warn(`  ⚠ No index.json found for ${stateFolder}`);
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`  ✗ Error reading index for ${stateFolder}:`, error);
    return [];
  }
}

/**
 * Generate coordinates for a single state
 */
async function generateCoordinatesForState(stateFolder: string): Promise<void> {
  const stateName = getStateDisplayName(stateFolder);
  const rtos = getRTOsForState(stateFolder);

  if (rtos.length === 0) {
    console.log(`  Skipping ${stateFolder} - no RTOs found`);
    return;
  }

  console.log(`\n📍 Processing ${stateName} (${rtos.length} RTOs)`);

  const coordinates: Record<string, Coordinate> = {};
  const failedRTOs: string[] = [];

  // Track unique cities to avoid redundant API calls
  const processedCities = new Map<string, Coordinate | null>();

  for (let i = 0; i < rtos.length; i++) {
    const rto = rtos[i];
    const cityKey = `${rto.city}|${rto.district}|${rto.state}`.toLowerCase();

    process.stdout.write(`  [${i + 1}/${rtos.length}] ${rto.code} (${rto.city})... `);

    // Check if we already processed this city
    if (processedCities.has(cityKey)) {
      const cached = processedCities.get(cityKey);
      if (cached) {
        coordinates[rto.code] = cached;
        console.log('✓ (cached)');
      } else {
        failedRTOs.push(rto.code);
        console.log('✗ (cached)');
      }
      continue;
    }

    const coord = await fetchCoordinates(rto.city, rto.district, rto.state, rto.region);

    if (coord) {
      coordinates[rto.code] = coord;
      processedCities.set(cityKey, coord);
      console.log('✓');
    } else {
      failedRTOs.push(rto.code);
      processedCities.set(cityKey, null);
      console.log('✗');
    }

    // Rate limiting - wait before next request (only if we made an API call)
    if (i < rtos.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  // Create output
  const output: CoordinatesOutput = {
    generatedAt: new Date().toISOString(),
    state: stateName,
    rtoCount: rtos.length,
    successCount: Object.keys(coordinates).length,
    failedRTOs,
    coordinates,
  };

  // Write to file in public/data for static serving
  const statePublicDir = path.join(PUBLIC_DATA_DIR, stateFolder);
  if (!fs.existsSync(statePublicDir)) {
    fs.mkdirSync(statePublicDir, { recursive: true });
  }
  const outputPath = path.join(statePublicDir, 'coordinates.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n  ✅ Saved ${Object.keys(coordinates).length}/${rtos.length} coordinates to public/data/${stateFolder}/coordinates.json`);

  if (failedRTOs.length > 0) {
    console.log(`  ⚠ Failed RTOs: ${failedRTOs.join(', ')}`);
  }
}

/**
 * Get all state directories that have index files
 */
function getStateDirectories(): string[] {
  return fs.readdirSync(DATA_DIR)
    .filter(item => {
      const itemPath = path.join(DATA_DIR, item);
      const indexPath = path.join(itemPath, 'index.json');
      return fs.statSync(itemPath).isDirectory() && fs.existsSync(indexPath);
    })
    .sort();
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('🗺️  Generate RTO Coordinates');
  console.log('============================');
  console.log('');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const stateArg = args.find(arg => arg.startsWith('--state='));
  const specificState = stateArg?.split('=')[1];

  // Check for --force flag to regenerate existing coordinates
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
    // Process all states with index files
    statesToProcess = getStateDirectories();
  }

  console.log(`States to process: ${statesToProcess.join(', ')}`);
  console.log(`Rate limit: ${REQUEST_DELAY_MS}ms between requests`);

  if (!forceRegenerate) {
    console.log('(Use --force to regenerate existing coordinates)');
  }

  let totalRTOs = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let skippedStates = 0;

  for (const stateFolder of statesToProcess) {
    // Check if coordinates already exist in public/data (unless --force)
    const coordinatesPath = path.join(PUBLIC_DATA_DIR, stateFolder, 'coordinates.json');
    if (!forceRegenerate && fs.existsSync(coordinatesPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(coordinatesPath, 'utf-8'));
        console.log(`\n⏭️  Skipping ${stateFolder} - coordinates.json exists (${existing.successCount} RTOs)`);
        skippedStates++;
        continue;
      } catch {
        // File exists but is invalid, regenerate
      }
    }

    await generateCoordinatesForState(stateFolder);

    // Read back stats
    if (fs.existsSync(coordinatesPath)) {
      const result = JSON.parse(fs.readFileSync(coordinatesPath, 'utf-8'));
      totalRTOs += result.rtoCount;
      totalSuccess += result.successCount;
      totalFailed += result.failedRTOs.length;
    }
  }

  console.log('\n============================');
  console.log('📊 Summary');
  console.log('============================');
  console.log(`States processed: ${statesToProcess.length - skippedStates}`);
  console.log(`States skipped (already exist): ${skippedStates}`);
  console.log(`Total RTOs: ${totalRTOs}`);
  console.log(`Successful: ${totalSuccess}`);
  console.log(`Failed: ${totalFailed}`);
  console.log('');
}

main().catch(console.error);
