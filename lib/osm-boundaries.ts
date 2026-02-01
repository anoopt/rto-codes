/**
 * OpenStreetMap Boundary Utilities
 * 
 * This module provides functions to load district and state boundaries from pre-generated
 * static JSON files at /data/{state}/boundaries.json and /data/{state}/state-boundary.json.
 * 
 * Data Sources (in priority order):
 * 1. In-memory cache (for current session)
 * 2. localStorage cache (7 days TTL)
 * 3. Static JSON files (public/data/{state}/boundaries.json or state-boundary.json)
 */

import type { LatLngTuple } from 'leaflet';

// Type for GeoJSON Feature
export interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    name: string;
    display_name?: string;
    osm_id?: number;
    osm_type?: string;
    districtName?: string;
    stateName?: string;
    [key: string]: unknown;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  bbox?: [number, number, number, number];
}

export interface BoundaryData {
  feature: GeoJSONFeature;
  timestamp: number;
}

// Type for static boundaries file
interface StaticBoundaries {
  type: 'FeatureCollection';
  generatedAt: string;
  state: string;
  districtCount: number;
  successCount: number;
  failedDistricts: string[];
  features: GeoJSONFeature[];
}

// Type for state boundary file
interface StateBoundaryFile {
  type: 'Feature';
  generatedAt: string;
  state: string;
  properties: GeoJSONFeature['properties'];
  geometry: GeoJSONFeature['geometry'];
  bbox?: [number, number, number, number];
}

// Cache settings
const CACHE_PREFIX = 'osm_boundary_';
const STATE_CACHE_PREFIX = 'osm_state_boundary_';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory caches
const memoryCache = new Map<string, GeoJSONFeature>();
const stateBoundaryCache = new Map<string, GeoJSONFeature | null>();
const staticBoundariesCache = new Map<string, StaticBoundaries | null>();

/**
 * Convert state name to folder name
 */
function stateToFolderName(state: string): string {
  return state.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Generate a cache key for a district boundary
 */
function getCacheKey(state: string, district: string): string {
  const normalizedState = state.toLowerCase().replace(/\s+/g, '_');
  const normalizedDistrict = district.toLowerCase().replace(/\s+/g, '_');
  return `${CACHE_PREFIX}${normalizedState}_${normalizedDistrict}`;
}

/**
 * Get boundary from localStorage cache
 */
function getFromLocalStorage(state: string, district: string): GeoJSONFeature | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = getCacheKey(state, district);
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const data: BoundaryData = JSON.parse(cached);

    // Check TTL
    if (Date.now() - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }

    // Validate geometry type
    if (data.feature.geometry?.type !== 'Polygon' && data.feature.geometry?.type !== 'MultiPolygon') {
      localStorage.removeItem(key);
      return null;
    }

    return data.feature;
  } catch {
    return null;
  }
}

/**
 * Save boundary to localStorage
 */
function saveToLocalStorage(state: string, district: string, feature: GeoJSONFeature): void {
  if (typeof window === 'undefined') return;

  try {
    const key = getCacheKey(state, district);
    const data: BoundaryData = { feature, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage might be full or disabled
  }
}

/**
 * Load static boundaries file for a state
 */
async function loadStaticBoundaries(state: string): Promise<StaticBoundaries | null> {
  const folder = stateToFolderName(state);

  // Check cache first
  if (staticBoundariesCache.has(folder)) {
    return staticBoundariesCache.get(folder) || null;
  }

  try {
    const response = await fetch(`/data/${folder}/boundaries.json`);
    if (!response.ok) {
      staticBoundariesCache.set(folder, null);
      return null;
    }

    const data: StaticBoundaries = await response.json();
    staticBoundariesCache.set(folder, data);
    return data;
  } catch {
    staticBoundariesCache.set(folder, null);
    return null;
  }
}

/**
 * Find district in static boundaries
 */
function findInStaticBoundaries(
  boundaries: StaticBoundaries,
  district: string
): GeoJSONFeature | null {
  const lowerDistrict = district.toLowerCase().trim();

  for (const feature of boundaries.features) {
    const featureName = (feature.properties?.districtName || feature.properties?.name || '').toLowerCase().trim();
    if (featureName === lowerDistrict) {
      return feature;
    }
  }

  return null;
}

/**
 * Check if a boundary is available in cache (sync, no async calls)
 */
export function getCachedBoundary(state: string, district: string): GeoJSONFeature | null {
  const cacheKey = getCacheKey(state, district);

  // Check in-memory cache
  const inMemory = memoryCache.get(cacheKey);
  if (inMemory) return inMemory;

  // Check localStorage
  const cached = getFromLocalStorage(state, district);
  if (cached) {
    memoryCache.set(cacheKey, cached);
    return cached;
  }

  return null;
}

/**
 * Fetch district boundary with cascading fallbacks
 * 
 * Priority:
 * 1. In-memory cache
 * 2. localStorage cache  
 * 3. Static JSON file (public/data/{state}/boundaries.json)
 * 
 * @param state - The state name (e.g., "Karnataka")
 * @param district - The district name (e.g., "Bengaluru Urban")
 * @returns GeoJSON feature or null if not found
 */
export async function fetchDistrictBoundary(
  state: string,
  district: string
): Promise<GeoJSONFeature | null> {
  const cacheKey = getCacheKey(state, district);

  // 1. Check in-memory cache
  const inMemory = memoryCache.get(cacheKey);
  if (inMemory) return inMemory;

  // 2. Check localStorage cache
  const cached = getFromLocalStorage(state, district);
  if (cached) {
    memoryCache.set(cacheKey, cached);
    return cached;
  }

  // 3. Try static boundaries file
  const staticBoundaries = await loadStaticBoundaries(state);
  if (staticBoundaries) {
    const feature = findInStaticBoundaries(staticBoundaries, district);
    if (feature) {
      memoryCache.set(cacheKey, feature);
      saveToLocalStorage(state, district, feature);
      return feature;
    }
  }

  return null;
}

/**
 * Load all boundaries for a state at once (efficient batch load)
 */
export async function loadAllBoundariesForState(state: string): Promise<Map<string, GeoJSONFeature>> {
  const result = new Map<string, GeoJSONFeature>();

  const staticBoundaries = await loadStaticBoundaries(state);
  if (!staticBoundaries) return result;

  for (const feature of staticBoundaries.features) {
    const districtName = feature.properties?.districtName || feature.properties?.name;
    if (districtName) {
      const cacheKey = getCacheKey(state, districtName);
      memoryCache.set(cacheKey, feature);
      result.set(districtName, feature);
    }
  }

  return result;
}

/**
 * Get the center coordinates from a boundary feature
 */
export function getBoundaryCenter(feature: GeoJSONFeature): LatLngTuple {
  if (feature.bbox) {
    const [minLon, minLat, maxLon, maxLat] = feature.bbox;
    return [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
  }

  const coords = feature.geometry.coordinates;
  if (feature.geometry.type === 'Polygon' && coords[0]) {
    const ring = coords[0] as number[][];
    if (ring.length > 0) {
      let sumLat = 0, sumLon = 0;
      const count = Math.min(ring.length, 10);
      for (let i = 0; i < count; i++) {
        sumLon += ring[i][0];
        sumLat += ring[i][1];
      }
      return [sumLat / count, sumLon / count];
    }
  }

  return [20.5937, 78.9629]; // Center of India fallback
}

/**
 * Clear all cached boundaries
 */
export function clearBoundaryCache(): void {
  memoryCache.clear();
  stateBoundaryCache.clear();
  staticBoundariesCache.clear();

  if (typeof window === 'undefined') return;

  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key.startsWith(CACHE_PREFIX) || key.startsWith(STATE_CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}

/**
 * Generate a cache key for a state boundary
 */
function getStateCacheKey(state: string): string {
  const normalizedState = state.toLowerCase().replace(/\s+/g, '_');
  return `${STATE_CACHE_PREFIX}${normalizedState}`;
}

/**
 * Get state boundary from localStorage cache
 */
function getStateBoundaryFromLocalStorage(state: string): GeoJSONFeature | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = getStateCacheKey(state);
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const data: BoundaryData = JSON.parse(cached);

    // Check TTL
    if (Date.now() - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }

    // Validate geometry type
    if (data.feature.geometry?.type !== 'Polygon' && data.feature.geometry?.type !== 'MultiPolygon') {
      localStorage.removeItem(key);
      return null;
    }

    return data.feature;
  } catch {
    return null;
  }
}

/**
 * Save state boundary to localStorage
 */
function saveStateBoundaryToLocalStorage(state: string, feature: GeoJSONFeature): void {
  if (typeof window === 'undefined') return;

  try {
    const key = getStateCacheKey(state);
    const data: BoundaryData = { feature, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage might be full or disabled
  }
}

/**
 * Load state boundary from static JSON file
 */
async function loadStaticStateBoundary(state: string): Promise<GeoJSONFeature | null> {
  const folder = stateToFolderName(state);
  const cacheKey = `static_state_${folder}`;

  // Check in-memory cache first
  if (stateBoundaryCache.has(cacheKey)) {
    return stateBoundaryCache.get(cacheKey) || null;
  }

  try {
    const response = await fetch(`/data/${folder}/state-boundary.json`);
    if (!response.ok) {
      stateBoundaryCache.set(cacheKey, null);
      return null;
    }

    const data: StateBoundaryFile = await response.json();

    // Convert to GeoJSONFeature format
    const feature: GeoJSONFeature = {
      type: 'Feature',
      properties: {
        ...data.properties,
        stateName: data.state,
      },
      geometry: data.geometry,
      bbox: data.bbox,
    };

    stateBoundaryCache.set(cacheKey, feature);
    return feature;
  } catch {
    stateBoundaryCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Check if state boundary is available in cache (sync, no async calls)
 */
export function getCachedStateBoundary(state: string): GeoJSONFeature | null {
  const cacheKey = getStateCacheKey(state);

  // Check in-memory cache
  const inMemory = stateBoundaryCache.get(`static_state_${stateToFolderName(state)}`);
  if (inMemory) return inMemory;

  // Check localStorage
  const cached = getStateBoundaryFromLocalStorage(state);
  if (cached) {
    stateBoundaryCache.set(`static_state_${stateToFolderName(state)}`, cached);
    return cached;
  }

  return null;
}

/**
 * Fetch state boundary with cascading fallbacks
 * 
 * Priority:
 * 1. In-memory cache
 * 2. localStorage cache  
 * 3. Static JSON file (public/data/{state}/state-boundary.json)
 * 
 * @param state - The state name (e.g., "Andhra Pradesh")
 * @returns GeoJSON feature or null if not found
 */
export async function fetchStateBoundary(state: string): Promise<GeoJSONFeature | null> {
  const folder = stateToFolderName(state);
  const cacheKey = `static_state_${folder}`;

  // 1. Check in-memory cache
  if (stateBoundaryCache.has(cacheKey)) {
    return stateBoundaryCache.get(cacheKey) || null;
  }

  // 2. Check localStorage cache
  const cached = getStateBoundaryFromLocalStorage(state);
  if (cached) {
    stateBoundaryCache.set(cacheKey, cached);
    return cached;
  }

  // 3. Try static state boundary file
  const feature = await loadStaticStateBoundary(state);
  if (feature) {
    saveStateBoundaryToLocalStorage(state, feature);
    return feature;
  }

  return null;
}
