import fs from 'fs';
import path from 'path';
import type { RTOCode } from '@/types/rto';

// Re-export RTOCode type for backward compatibility
export type { RTOCode } from '@/types/rto';

const DATA_DIR = path.join(process.cwd(), 'data');
const DEFAULT_STATE = 'karnataka';

// State code to folder mapping
const STATE_CODE_TO_FOLDER: Record<string, string> = {
  'KA': 'karnataka',
  'GA': 'goa',
};

// Cache for loaded index data per state
// In development, we skip caching to pick up file changes immediately
const isDev = process.env.NODE_ENV === 'development';
const stateRTOCache: Record<string, RTOCode[]> = {};
let cachedAllRTOs: RTOCode[] | null = null;
let cachedVerifiedRTOs: RTOCode[] | null = null;

/**
 * Get all available state folders from the data directory
 */
function getAvailableStates(): string[] {
  try {
    const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(name => fs.existsSync(path.join(DATA_DIR, name, 'index.json')) ||
        fs.existsSync(path.join(DATA_DIR, name, 'config.json')));
  } catch {
    return [DEFAULT_STATE];
  }
}

/**
 * Get the state folder name from an RTO code prefix
 */
function getStateFolderFromCode(code: string): string | null {
  const stateCode = code.toUpperCase().split('-')[0];
  return STATE_CODE_TO_FOLDER[stateCode] || null;
}

/**
 * Load all RTO codes from the pre-generated index.json for a specific state
 */
export function getAllRTOs(state?: string): RTOCode[] {
  // If no state specified, return all RTOs from all states
  if (!state) {
    if (!isDev && cachedAllRTOs) {
      return cachedAllRTOs;
    }

    const states = getAvailableStates();
    const allRTOs: RTOCode[] = [];

    for (const stateName of states) {
      const stateRTOs = getAllRTOs(stateName);
      allRTOs.push(...stateRTOs);
    }

    const sorted = allRTOs.sort((a, b) => a.code.localeCompare(b.code));
    if (!isDev) {
      cachedAllRTOs = sorted;
    }
    return sorted;
  }

  // Return cached data for specific state if available (skip in dev)
  if (!isDev && stateRTOCache[state]) {
    return stateRTOCache[state];
  }

  const indexPath = path.join(DATA_DIR, state, 'index.json');

  // Try to load from index.json first (generated at build time)
  if (fs.existsSync(indexPath)) {
    const indexContents = fs.readFileSync(indexPath, 'utf8');
    stateRTOCache[state] = JSON.parse(indexContents) as RTOCode[];
    return stateRTOCache[state];
  }

  // Fallback: read individual files (for development before first build)
  const stateDir = path.join(DATA_DIR, state);
  if (!fs.existsSync(stateDir)) {
    return [];
  }

  const files = fs.readdirSync(stateDir).filter(file =>
    file.endsWith('.json') &&
    !file.includes('index') &&
    !file.includes('raw-') &&
    !file.includes('config')
  );

  const rtos: RTOCode[] = files.map(file => {
    const filePath = path.join(stateDir, file);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents) as RTOCode;
  });

  // Sort by code and cache
  const sorted = rtos.sort((a, b) => a.code.localeCompare(b.code));
  if (!isDev) {
    stateRTOCache[state] = sorted;
  }
  return sorted;
}

/**
 * Get a single RTO by code
 * Automatically detects the state from the code prefix
 */
export function getRTOByCode(code: string, state?: string): RTOCode | null {
  try {
    // Determine state from code prefix if not provided
    const resolvedState = state || getStateFolderFromCode(code);

    if (resolvedState) {
      // Try to find in specific state's cached/indexed data
      const stateRTOs = getAllRTOs(resolvedState);
      const rto = stateRTOs.find(r => r.code.toLowerCase() === code.toLowerCase());
      if (rto) return rto;

      // Fallback: try reading individual file directly
      const filePath = path.join(DATA_DIR, resolvedState, `${code.toLowerCase()}.json`);
      if (fs.existsSync(filePath)) {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileContents) as RTOCode;
      }
    }

    // Last resort: search all states
    const allRTOs = getAllRTOs();
    return allRTOs.find(r => r.code.toLowerCase() === code.toLowerCase()) || null;
  } catch {
    return null;
  }
}

/**
 * Get only RTOs with complete data (non-empty regions)
 */
export function getVerifiedRTOs(state?: string): RTOCode[] {
  if (!isDev && !state && cachedVerifiedRTOs) {
    return cachedVerifiedRTOs;
  }
  const verified = getAllRTOs(state).filter(rto => rto.region && rto.region.trim() !== '');
  if (!isDev && !state) {
    cachedVerifiedRTOs = verified;
  }
  return verified;
}

/**
 * Get all verified RTO codes as a simple string array
 * Useful for shuffle functionality and quick lookups
 * Sorted with active RTOs first, then inactive ones (matching homepage order)
 * 
 * Active RTOs: All RTOs except those with status 'not-in-use' or 'discontinued'
 * Inactive RTOs: RTOs with status 'not-in-use' or 'discontinued'
 */
export function getVerifiedRTOCodes(state?: string): string[] {
  const isInactive = (rto: RTOCode) => rto.status === 'not-in-use' || rto.status === 'discontinued';

  return getVerifiedRTOs(state)
    .sort((a, b) => {
      // Sort: active RTOs first, then inactive ones
      const aInactive = isInactive(a);
      const bInactive = isInactive(b);

      if (aInactive && !bInactive) return 1;
      if (!aInactive && bInactive) return -1;

      // If both are same status, maintain alphabetical order by code
      return a.code.localeCompare(b.code);
    })
    .map(rto => rto.code.toLowerCase());
}

/**
 * Search RTOs by query string
 */
export function searchRTOs(query: string, state?: string): RTOCode[] {
  const allRTOs = getVerifiedRTOs(state); // Only search verified RTOs
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    return allRTOs;
  }

  return allRTOs.filter(rto => {
    return (
      rto.code.toLowerCase().includes(lowerQuery) ||
      rto.region.toLowerCase().includes(lowerQuery) ||
      rto.city.toLowerCase().includes(lowerQuery) ||
      (rto.district && rto.district.toLowerCase().includes(lowerQuery)) ||
      (rto.jurisdictionAreas && rto.jurisdictionAreas.some(area => area.toLowerCase().includes(lowerQuery)))
    );
  });
}

/**
 * Get all RTOs belonging to a specific district
 */
export function getRTOsByDistrict(district: string, state?: string): RTOCode[] {
  return getAllRTOs(state).filter(rto => rto.district === district);
}

/**
 * Get a map of district names to their RTOs
 */
export function getDistrictToRTOsMap(state?: string): Record<string, RTOCode[]> {
  const allRTOs = getAllRTOs(state);
  const map: Record<string, RTOCode[]> = {};

  allRTOs.forEach(rto => {
    if (rto.district) {
      if (!map[rto.district]) {
        map[rto.district] = [];
      }
      map[rto.district].push(rto);
    }
  });

  // Sort RTOs within each district to prefer active ones
  Object.keys(map).forEach(district => {
    map[district].sort((a, b) => {
      // 1. Prefer district headquarters
      if (a.isDistrictHeadquarter && !b.isDistrictHeadquarter) return -1;
      if (!a.isDistrictHeadquarter && b.isDistrictHeadquarter) return 1;

      // 2. Prefer active RTOs
      const aInactive = a.status === 'not-in-use' || a.status === 'discontinued';
      const bInactive = b.status === 'not-in-use' || b.status === 'discontinued';

      if (aInactive && !bInactive) return 1;
      if (!aInactive && bInactive) return -1;

      // 3. Sort by code
      return a.code.localeCompare(b.code);
    });
  });

  return map;
}
