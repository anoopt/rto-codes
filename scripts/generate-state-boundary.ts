/**
 * Script to generate state boundary data for OSM maps
 * 
 * This script fetches state boundaries from Nominatim (OpenStreetMap)
 * and saves them as static JSON files for each state.
 * 
 * Output:
 *   public/data/{state}/state-boundary.json - GeoJSON Feature of the state boundary
 * 
 * Usage:
 *   bun scripts/generate-state-boundary.ts                          # All states (skip existing)
 *   bun scripts/generate-state-boundary.ts --state=andhra-pradesh   # Specific state
 *   bun scripts/generate-state-boundary.ts --state=andhra-pradesh --force  # Regenerate
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
        [key: string]: unknown;
    };
    geometry: {
        type: 'Polygon' | 'MultiPolygon';
        coordinates: number[][][] | number[][][][];
    };
    bbox?: [number, number, number, number];
}

interface StateBoundaryOutput {
    type: 'Feature';
    generatedAt: string;
    state: string;
    properties: GeoJSONFeature['properties'];
    geometry: GeoJSONFeature['geometry'];
    bbox?: [number, number, number, number];
}

// Constants
const DATA_DIR = path.join(process.cwd(), 'data');
const PUBLIC_DATA_DIR = path.join(process.cwd(), 'public', 'data');
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'RTOCodesIndia/1.0 (https://rto-codes.in; contact@rto-codes.in)';
const REQUEST_DELAY_MS = 1100; // 1.1 seconds between requests

/**
 * State name aliases for OSM lookup
 * Maps our state folder names to OSM-compatible names
 */
const STATE_OSM_ALIASES: Record<string, string> = {
    'andaman-nicobar': 'Andaman and Nicobar Islands',
    'dadra-nagar-haveli-daman-diu': 'Dadra and Nagar Haveli and Daman and Diu',
    'jammu-kashmir': 'Jammu and Kashmir',
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get state display name from folder name
 */
function getStateDisplayName(folderName: string): string {
    // Check aliases first
    if (STATE_OSM_ALIASES[folderName]) {
        return STATE_OSM_ALIASES[folderName];
    }

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
 * Build search queries for a state
 */
function buildSearchQueries(stateName: string): string[] {
    return [
        // Standard format with "state"
        `${stateName} state, India`,
        // Without "state" suffix
        `${stateName}, India`,
        // With admin level hint
        `${stateName}`,
    ];
}

/**
 * Fetch state boundary from Nominatim with a specific query
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

        // Verify it's an administrative boundary (state level)
        const displayName = feature.properties?.display_name || '';
        if (!displayName.toLowerCase().includes('india')) {
            console.log(`  ⚠ Result doesn't appear to be in India: ${displayName}`);
        }

        return feature;
    } catch (error) {
        console.error(`  ✗ Fetch error:`, error);
        return null;
    }
}

/**
 * Fetch state boundary from Nominatim using multiple query strategies
 */
async function fetchStateBoundary(
    stateName: string,
    verbose: boolean = false
): Promise<GeoJSONFeature | null> {
    const queries = buildSearchQueries(stateName);

    for (let i = 0; i < queries.length; i++) {
        const query = queries[i];

        if (verbose) {
            process.stdout.write(`  Trying: "${query}"... `);
        }

        const feature = await fetchWithQuery(query);

        if (feature) {
            if (verbose) {
                console.log('✓');
            }
            return feature;
        } else if (verbose) {
            console.log('✗');
        }

        // Wait before trying the next query (rate limiting)
        if (i < queries.length - 1) {
            await sleep(REQUEST_DELAY_MS);
        }
    }

    console.error(`  ✗ No polygon boundary found for ${stateName} after trying ${queries.length} query variations`);
    return null;
}

/**
 * Generate state boundary for a single state
 */
async function generateStateBoundary(stateFolder: string): Promise<boolean> {
    const stateName = getStateDisplayName(stateFolder);

    console.log(`\n📍 Processing ${stateName}...`);

    const feature = await fetchStateBoundary(stateName, true);

    if (!feature) {
        console.log(`  ✗ Failed to fetch boundary for ${stateName}`);
        return false;
    }

    // Create output
    const output: StateBoundaryOutput = {
        type: 'Feature',
        generatedAt: new Date().toISOString(),
        state: stateName,
        properties: {
            ...feature.properties,
            name: stateName,
        },
        geometry: feature.geometry,
        bbox: feature.bbox,
    };

    // Write to file in public/data for static serving
    const statePublicDir = path.join(PUBLIC_DATA_DIR, stateFolder);
    if (!fs.existsSync(statePublicDir)) {
        fs.mkdirSync(statePublicDir, { recursive: true });
    }

    const boundaryPath = path.join(statePublicDir, 'state-boundary.json');
    fs.writeFileSync(boundaryPath, JSON.stringify(output, null, 2));

    console.log(`  ✅ Saved to public/data/${stateFolder}/state-boundary.json`);
    return true;
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
 * Check if a state has state-wide RTOs (needs state boundary)
 */
function hasStateWideRTOs(stateFolder: string): boolean {
    const configPath = path.join(DATA_DIR, stateFolder, 'config.json');
    if (!fs.existsSync(configPath)) {
        return false;
    }

    try {
        const config: StateConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        // Check if districtMapping has "State-wide" entry
        if (config.districtMapping) {
            return Object.keys(config.districtMapping).some(
                key => key.toLowerCase() === 'state-wide'
            );
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Main function
 */
async function main(): Promise<void> {
    console.log('🗺️  Generate State Boundaries');
    console.log('==============================');
    console.log('');

    // Parse command line arguments
    const args = process.argv.slice(2);
    const stateArg = args.find(arg => arg.startsWith('--state='));
    const specificState = stateArg?.split('=')[1];
    const forceRegenerate = args.includes('--force');
    const onlyStateWide = args.includes('--state-wide-only');

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

        // If --state-wide-only, filter to only states with state-wide RTOs
        if (onlyStateWide) {
            statesToProcess = statesToProcess.filter(hasStateWideRTOs);
            console.log(`Found ${statesToProcess.length} states with state-wide RTOs: ${statesToProcess.join(', ')}`);
        }
    }

    console.log(`States to process: ${statesToProcess.join(', ')}`);
    console.log(`Rate limit: ${REQUEST_DELAY_MS}ms between requests`);

    if (!forceRegenerate) {
        console.log('(Use --force to regenerate existing boundaries)');
    }

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const stateFolder of statesToProcess) {
        // Check if boundary already exists (unless --force)
        const boundaryPath = path.join(PUBLIC_DATA_DIR, stateFolder, 'state-boundary.json');
        if (!forceRegenerate && fs.existsSync(boundaryPath)) {
            console.log(`\n⏭️  Skipping ${stateFolder} - state-boundary.json exists`);
            skippedCount++;
            continue;
        }

        const success = await generateStateBoundary(stateFolder);
        if (success) {
            successCount++;
        } else {
            failedCount++;
        }

        // Rate limiting between states
        if (statesToProcess.indexOf(stateFolder) < statesToProcess.length - 1) {
            await sleep(REQUEST_DELAY_MS);
        }
    }

    console.log('\n==============================');
    console.log('📊 Summary');
    console.log('==============================');
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failedCount}`);
    console.log(`Skipped (already exist): ${skippedCount}`);
    console.log('');
}

main().catch(console.error);
