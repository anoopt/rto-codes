/**
 * OpenStreetMap Geocoding Utilities
 * 
 * This module provides functions to get coordinates for RTO locations
 * from pre-generated static JSON files at /data/{state}/coordinates.json.
 * 
 * Data Sources (in priority order):
 * 1. In-memory cache (for current session)
 * 2. localStorage cache (30 days TTL)
 * 3. Static JSON files (public/data/{state}/coordinates.json)
 */

import type { LatLngTuple } from 'leaflet';

// Type for coordinate
interface Coordinate {
  lat: number;
  lon: number;
  displayName?: string;
}

interface GeocodeCacheData {
  lat: number;
  lon: number;
  timestamp: number;
}

// Type for static coordinates file
interface StaticCoordinates {
  generatedAt: string;
  state: string;
  rtoCount: number;
  successCount: number;
  failedRTOs: string[];
  coordinates: Record<string, Coordinate>;
}

// Cache settings
const CACHE_PREFIX = 'osm_geocode_';
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// In-memory caches
const memoryCache = new Map<string, LatLngTuple>();
const staticCoordinatesCache = new Map<string, StaticCoordinates | null>();

/**
 * Convert state name to folder name
 */
function stateToFolderName(state: string): string {
  return state.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Generate a cache key for a geocoded location
 */
function getCacheKey(rtoCode: string): string {
  return `${CACHE_PREFIX}${rtoCode.toLowerCase()}`;
}

/**
 * Get coordinates from localStorage cache
 */
function getFromLocalStorage(rtoCode: string): LatLngTuple | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = getCacheKey(rtoCode);
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const data: GeocodeCacheData = JSON.parse(cached);
    
    // Check TTL
    if (Date.now() - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }

    return [data.lat, data.lon];
  } catch {
    return null;
  }
}

/**
 * Save coordinates to localStorage
 */
function saveToLocalStorage(rtoCode: string, coords: LatLngTuple): void {
  if (typeof window === 'undefined') return;

  try {
    const key = getCacheKey(rtoCode);
    const data: GeocodeCacheData = { 
      lat: coords[0], 
      lon: coords[1], 
      timestamp: Date.now() 
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage might be full or disabled
  }
}

/**
 * Load static coordinates file for a state
 */
async function loadStaticCoordinates(state: string): Promise<StaticCoordinates | null> {
  const folder = stateToFolderName(state);
  
  // Check cache first
  if (staticCoordinatesCache.has(folder)) {
    return staticCoordinatesCache.get(folder) || null;
  }

  try {
    const response = await fetch(`/data/${folder}/coordinates.json`);
    if (!response.ok) {
      staticCoordinatesCache.set(folder, null);
      return null;
    }

    const data: StaticCoordinates = await response.json();
    staticCoordinatesCache.set(folder, data);
    return data;
  } catch {
    staticCoordinatesCache.set(folder, null);
    return null;
  }
}

/**
 * Get RTO coordinates with cascading fallbacks
 * 
 * Priority:
 * 1. In-memory cache
 * 2. Static JSON file (public/data/{state}/coordinates.json) - authoritative source
 * 3. localStorage cache (fallback if static file unavailable)
 * 
 * @param rtoCode - The RTO code (e.g., "KA-01")
 * @param state - The state name (e.g., "Karnataka")
 * @returns Coordinates as [lat, lng] tuple or null if not found
 */
export async function getRTOCoordinates(
  rtoCode: string,
  state: string
): Promise<LatLngTuple | null> {
  const normalizedCode = rtoCode.toUpperCase();
  const cacheKey = getCacheKey(normalizedCode);

  // 1. Check in-memory cache
  const inMemory = memoryCache.get(cacheKey);
  if (inMemory) return inMemory;

  // 2. Try static coordinates file first (authoritative source)
  const staticCoords = await loadStaticCoordinates(state);
  if (staticCoords) {
    const coord = staticCoords.coordinates[normalizedCode];
    if (coord) {
      const latLng: LatLngTuple = [coord.lat, coord.lon];
      memoryCache.set(cacheKey, latLng);
      saveToLocalStorage(normalizedCode, latLng);
      return latLng;
    }
  }

  // 3. Fallback to localStorage cache (only if static file unavailable)
  const cached = getFromLocalStorage(normalizedCode);
  if (cached) {
    memoryCache.set(cacheKey, cached);
    return cached;
  }

  return null;
}

/**
 * Geocode a city/town name to coordinates
 * 
 * This is a compatibility wrapper that maps the old API to the new static data approach.
 * For new code, prefer using getRTOCoordinates directly with the RTO code.
 * 
 * @deprecated Use getRTOCoordinates instead
 */
export async function geocodeCity(
  city: string,
  district: string,
  state: string
): Promise<LatLngTuple | null> {
  // This function is kept for backwards compatibility
  // The OSMStateMap component uses this, but we'll need to update it
  // to use getRTOCoordinates with the RTO code instead
  
  // For now, try to find by city+district in static data
  const staticCoords = await loadStaticCoordinates(state);
  if (!staticCoords) return null;

  const cityLower = city.toLowerCase();
  const districtLower = district.toLowerCase();

  // Search through coordinates to find matching city/district
  // This is inefficient but works for backwards compatibility
  for (const [, coord] of Object.entries(staticCoords.coordinates)) {
    if (coord.displayName) {
      const displayLower = coord.displayName.toLowerCase();
      if (displayLower.includes(cityLower) && displayLower.includes(districtLower)) {
        return [coord.lat, coord.lon];
      }
    }
  }

  // Just find any match for the city
  for (const [, coord] of Object.entries(staticCoords.coordinates)) {
    if (coord.displayName?.toLowerCase().includes(cityLower)) {
      return [coord.lat, coord.lon];
    }
  }

  return null;
}

/**
 * Load all coordinates for a state at once (efficient batch load)
 */
export async function loadAllCoordinatesForState(state: string): Promise<Map<string, LatLngTuple>> {
  const result = new Map<string, LatLngTuple>();
  
  const staticCoords = await loadStaticCoordinates(state);
  if (!staticCoords) return result;

  for (const [rtoCode, coord] of Object.entries(staticCoords.coordinates)) {
    const latLng: LatLngTuple = [coord.lat, coord.lon];
    result.set(rtoCode, latLng);
    
    // Also populate memory cache
    const cacheKey = getCacheKey(rtoCode);
    memoryCache.set(cacheKey, latLng);
  }

  return result;
}

/**
 * Clear all cached geocode data
 */
export function clearGeocodeCache(): void {
  memoryCache.clear();
  staticCoordinatesCache.clear();
  
  if (typeof window === 'undefined') return;
  
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key.startsWith(CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}
