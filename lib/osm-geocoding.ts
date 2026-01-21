/**
 * OpenStreetMap Geocoding Utilities
 * 
 * This module provides functions to geocode city/town names to coordinates
 * using the Nominatim API, with localStorage caching to minimize API calls.
 */

import type { LatLngTuple } from 'leaflet';

// Type for geocoded location
export interface GeocodedLocation {
  lat: number;
  lon: number;
  displayName: string;
}

export interface GeocodeCacheData {
  location: GeocodedLocation;
  timestamp: number;
}

// Cache settings
const CACHE_PREFIX = 'osm_geocode_';
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds (locations don't change often)

// Nominatim API settings
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'RTOCodesIndia/1.0 (https://rto-codes.in)';

// Rate limiting: Nominatim requires max 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds to be safe

/**
 * Generate a cache key for a geocoded location
 */
function getCacheKey(city: string, district: string, state: string): string {
  const normalized = `${city}_${district}_${state}`.toLowerCase().replace(/\s+/g, '_');
  return `${CACHE_PREFIX}${normalized}`;
}

/**
 * Get geocoded location from localStorage cache
 */
function getFromCache(city: string, district: string, state: string): GeocodedLocation | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const key = getCacheKey(city, district, state);
    const cached = localStorage.getItem(key);
    
    if (!cached) return null;
    
    const data: GeocodeCacheData = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    
    return data.location;
  } catch {
    return null;
  }
}

/**
 * Save geocoded location to localStorage cache
 */
function saveToCache(city: string, district: string, state: string, location: GeocodedLocation): void {
  if (typeof window === 'undefined') return;
  
  try {
    const key = getCacheKey(city, district, state);
    const data: GeocodeCacheData = {
      location,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage might be full or disabled - fail silently
  }
}

/**
 * Wait for rate limiting
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
}

/**
 * Fetch geocoded coordinates from Nominatim API
 */
async function fetchFromNominatim(
  city: string,
  district: string,
  state: string
): Promise<GeocodedLocation | null> {
  try {
    // Wait for rate limiting
    await waitForRateLimit();
    
    // Build search query: "City, District, State, India"
    const query = `${city}, ${district}, ${state}, India`;
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
      countrycodes: 'in',
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
    if (!data || data.length === 0) {
      // Try alternative search with just city and state
      await waitForRateLimit();
      
      const altParams = new URLSearchParams({
        q: `${city}, ${state}, India`,
        format: 'json',
        limit: '1',
        countrycodes: 'in',
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
      
      if (!altData || altData.length === 0) {
        return null;
      }

      return {
        lat: parseFloat(altData[0].lat),
        lon: parseFloat(altData[0].lon),
        displayName: altData[0].display_name || city,
      };
    }

    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
      displayName: data[0].display_name || city,
    };
  } catch {
    return null;
  }
}

/**
 * Geocode a city/town name to coordinates
 * 
 * First checks localStorage cache, then fetches from Nominatim if needed.
 * Results are cached for 30 days to minimize API calls.
 * 
 * @param city - The city/town name (e.g., "Bengaluru")
 * @param district - The district name (e.g., "Bengaluru Urban")
 * @param state - The state name (e.g., "Karnataka")
 * @returns Coordinates as [lat, lng] tuple or null if not found
 */
export async function geocodeCity(
  city: string,
  district: string,
  state: string
): Promise<LatLngTuple | null> {
  // Check cache first
  const cached = getFromCache(city, district, state);
  if (cached) {
    return [cached.lat, cached.lon];
  }

  // Fetch from API
  const location = await fetchFromNominatim(city, district, state);
  
  if (location) {
    // Cache the result
    saveToCache(city, district, state, location);
    return [location.lat, location.lon];
  }

  return null;
}

/**
 * Batch geocode multiple cities
 * 
 * Geocodes multiple cities in sequence with rate limiting.
 * Uses caching to avoid redundant API calls.
 * 
 * @param cities - Array of {city, district, state} objects
 * @returns Map of city names to coordinates
 */
export async function geocodeCities(
  cities: Array<{ city: string; district: string; state: string; rtoCode: string }>
): Promise<Map<string, LatLngTuple>> {
  const results = new Map<string, LatLngTuple>();
  
  for (const { city, district, state, rtoCode } of cities) {
    // Use RTO code as key to handle multiple RTOs in same city
    const coords = await geocodeCity(city, district, state);
    if (coords) {
      results.set(rtoCode, coords);
    }
  }
  
  return results;
}

/**
 * Clear all cached geocode data (useful for debugging)
 */
export function clearGeocodeCache(): void {
  if (typeof window === 'undefined') return;
  
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key.startsWith(CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}
