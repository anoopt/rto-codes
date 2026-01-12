/**
 * State Configuration System (Server-side only)
 * 
 * This module provides functions to load state-specific configuration
 * including district mappings, map files, and metadata.
 * 
 * IMPORTANT: This file uses Node.js 'fs' module and can only be imported
 * in Server Components or API routes, NOT in Client Components.
 * 
 * To add a new state:
 * 1. Create a folder: data/[state-name]/
 * 2. Add config.json with state metadata and district mappings
 * 3. Add map.svg for the state map
 * 4. Add individual RTO JSON files (e.g., xx-01.json, xx-02.json)
 * 5. Add index.json with the list of RTOs
 */

import fs from 'fs';
import path from 'path';

// Re-export the type for convenience
export type { StateConfig } from '@/types/state-config';
import type { StateConfig } from '@/types/state-config';

// Cache for loaded configs
const configCache = new Map<string, StateConfig>();

/**
 * Get list of available states (folders in data/ that have config.json)
 */
export function getAvailableStates(): string[] {
  const dataDir = path.join(process.cwd(), 'data');
  const entries = fs.readdirSync(dataDir, { withFileTypes: true });

  return entries
    .filter(entry => {
      if (!entry.isDirectory()) return false;
      const configPath = path.join(dataDir, entry.name, 'config.json');
      return fs.existsSync(configPath);
    })
    .map(entry => entry.name);
}

/**
 * Load state configuration from config.json
 * @param stateName - The folder name (e.g., 'karnataka', 'maharashtra')
 */
export function getStateConfig(stateName: string): StateConfig | null {
  // Check cache first
  if (configCache.has(stateName)) {
    return configCache.get(stateName)!;
  }

  try {
    const configPath = path.join(process.cwd(), 'data', stateName, 'config.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent) as StateConfig;

    // Cache it
    configCache.set(stateName, config);

    return config;
  } catch (error) {
    console.error(`Failed to load config for state: ${stateName}`, error);
    return null;
  }
}

/**
 * Get state config by state code (e.g., 'KA', 'MH')
 */
export function getStateConfigByCode(stateCode: string): StateConfig | null {
  const states = getAvailableStates();

  for (const stateName of states) {
    const config = getStateConfig(stateName);
    if (config && config.stateCode.toUpperCase() === stateCode.toUpperCase()) {
      return config;
    }
  }

  return null;
}

/**
 * Get the state folder name from state code
 */
export function getStateFolderByCode(stateCode: string): string | null {
  const states = getAvailableStates();

  for (const stateName of states) {
    const config = getStateConfig(stateName);
    if (config && config.stateCode.toUpperCase() === stateCode.toUpperCase()) {
      return stateName;
    }
  }

  return null;
}

/**
 * Get SVG district ID from modern district name for a specific state
 */
export function getSvgDistrictId(stateName: string, districtName: string): string | null {
  const config = getStateConfig(stateName);
  if (!config) return null;

  return config.districtMapping[districtName] || null;
}

/**
 * Get modern district name from SVG ID for a specific state
 */
export function getDistrictFromSvgId(stateName: string, svgId: string): string | null {
  const config = getStateConfig(stateName);
  if (!config) return null;

  // Reverse lookup
  for (const [modern, svg] of Object.entries(config.districtMapping)) {
    if (svg === svgId) {
      return modern;
    }
  }

  return null;
}

/**
 * Get all SVG district IDs for a state
 */
export function getSvgDistrictIds(stateName: string): string[] {
  const config = getStateConfig(stateName);
  return config?.svgDistrictIds || [];
}

/**
 * Read and process a state's map SVG
 */
export function getStateMapSvg(stateName: string): string | null {
  try {
    const config = getStateConfig(stateName);
    if (!config) return null;

    // First try data/[state]/map.svg, then fall back to public/map.svg for backwards compatibility
    let svgPath = path.join(process.cwd(), 'data', stateName, config.mapFile);

    if (!fs.existsSync(svgPath)) {
      // Fallback to public folder
      svgPath = path.join(process.cwd(), 'public', config.mapFile);
    }

    if (!fs.existsSync(svgPath)) {
      console.error(`Map file not found for state: ${stateName}`);
      return null;
    }

    let svgContent = fs.readFileSync(svgPath, 'utf-8');

    // Remove XML declaration
    svgContent = svgContent.replace(/<\?xml[^?]*\?>/g, '').trim();

    // Remove comments
    svgContent = svgContent.replace(/<!--[\s\S]*?-->/g, '');

    return svgContent;
  } catch (error) {
    console.error(`Failed to read map SVG for state: ${stateName}`, error);
    return null;
  }
}
