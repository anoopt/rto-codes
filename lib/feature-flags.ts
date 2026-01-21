/**
 * Feature flags utility for controlling feature rollouts
 */

/**
 * Check if OpenStreetMap maps are enabled globally
 * Controlled by NEXT_PUBLIC_OSM_ENABLED environment variable
 * Defaults to false (uses SVG maps) when not set
 */
export function isOSMEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_OSM_ENABLED;
  return value === 'true';
}

/**
 * Check if district map highlighting is enabled
 * Controlled by NEXT_PUBLIC_ENABLE_DISTRICT_MAP environment variable
 */
export function isDistrictMapEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_ENABLE_DISTRICT_MAP;
  return value === 'true';
}
