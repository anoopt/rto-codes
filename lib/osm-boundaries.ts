/**
 * OpenStreetMap Boundary Fetching Utilities
 * 
 * This module provides functions to fetch district boundaries from Nominatim API
 * and cache them in localStorage to minimize API calls.
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

// Cache settings
const CACHE_PREFIX = 'osm_boundary_';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Nominatim API settings
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'RTOCodesIndia/1.0 (https://rto-codes.in)';

/**
 * Generate a cache key for a district boundary
 */
function getCacheKey(state: string, district: string): string {
  const normalizedState = state.toLowerCase().replace(/\s+/g, '_');
  const normalizedDistrict = district.toLowerCase().replace(/\s+/g, '_');
  return `${CACHE_PREFIX}${normalizedState}_${normalizedDistrict}`;
}

/**
 * Get boundary data from localStorage cache
 */
function getFromCache(state: string, district: string): GeoJSONFeature | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const key = getCacheKey(state, district);
    const cached = localStorage.getItem(key);
    
    if (!cached) return null;
    
    const data: BoundaryData = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    
    return data.feature;
  } catch {
    return null;
  }
}

/**
 * Save boundary data to localStorage cache
 */
function saveToCache(state: string, district: string, feature: GeoJSONFeature): void {
  if (typeof window === 'undefined') return;
  
  try {
    const key = getCacheKey(state, district);
    const data: BoundaryData = {
      feature,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage might be full or disabled - fail silently
  }
}

/**
 * Fetch district boundary from Nominatim API
 */
async function fetchBoundaryFromNominatim(
  state: string,
  district: string
): Promise<GeoJSONFeature | null> {
  try {
    // Build search query: "District Name, State, India"
    const query = `${district} district, ${state}, India`;
    const params = new URLSearchParams({
      q: query,
      format: 'geojson',
      polygon_geojson: '1',
      limit: '1',
      featuretype: 'settlement',
    });

    const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params}`, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();

    // Check if we got results
    if (!data.features || data.features.length === 0) {
      // Try alternative search without "district" suffix
      const altParams = new URLSearchParams({
        q: `${district}, ${state}, India`,
        format: 'geojson',
        polygon_geojson: '1',
        limit: '1',
      });

      const altResponse = await fetch(`${NOMINATIM_BASE_URL}/search?${altParams}`, {
        headers: {
          'User-Agent': USER_AGENT,
        },
      });

      if (!altResponse.ok) {
        return null;
      }

      const altData = await altResponse.json();
      
      if (!altData.features || altData.features.length === 0) {
        return null;
      }

      return altData.features[0] as GeoJSONFeature;
    }

    return data.features[0] as GeoJSONFeature;
  } catch {
    return null;
  }
}

/**
 * Fetch district boundary with caching
 * 
 * First checks localStorage cache, then fetches from Nominatim if needed.
 * Results are cached for 7 days to minimize API calls.
 * 
 * @param state - The state name (e.g., "Karnataka")
 * @param district - The district name (e.g., "Bengaluru Urban")
 * @returns GeoJSON feature or null if not found
 */
export async function fetchDistrictBoundary(
  state: string,
  district: string
): Promise<GeoJSONFeature | null> {
  // Check cache first
  const cached = getFromCache(state, district);
  if (cached) {
    return cached;
  }

  // Fetch from API
  const feature = await fetchBoundaryFromNominatim(state, district);
  
  if (feature) {
    // Cache the result
    saveToCache(state, district, feature);
  }

  return feature;
}

/**
 * Get the center coordinates from a boundary feature
 */
export function getBoundaryCenter(feature: GeoJSONFeature): LatLngTuple {
  if (feature.bbox) {
    // Use bbox center if available
    const [minLon, minLat, maxLon, maxLat] = feature.bbox;
    return [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
  }

  // Calculate from geometry (simplified - just use first coordinate)
  const coords = feature.geometry.coordinates;
  if (feature.geometry.type === 'Polygon' && coords[0]) {
    const ring = coords[0] as number[][];
    if (ring.length > 0) {
      // Average first few points
      let sumLat = 0, sumLon = 0;
      const count = Math.min(ring.length, 10);
      for (let i = 0; i < count; i++) {
        sumLon += ring[i][0];
        sumLat += ring[i][1];
      }
      return [sumLat / count, sumLon / count];
    }
  }

  // Fallback
  return [20.5937, 78.9629]; // Center of India
}

/**
 * Clear all cached boundaries (useful for debugging)
 */
export function clearBoundaryCache(): void {
  if (typeof window === 'undefined') return;
  
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key.startsWith(CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}
