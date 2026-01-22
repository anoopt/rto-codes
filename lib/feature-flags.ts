/**
 * Feature flags utility for controlling feature rollouts
 */

/**
 * Check if OpenStreetMap maps are enabled globally
 * Controlled by NEXT_PUBLIC_OSM_ENABLED environment variable
 * Defaults to false when not set
 */
export function isOSMEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_OSM_ENABLED;
  return value === 'true';
}

/**
 * Check if OSM is enabled for a specific state
 * Requires both global NEXT_PUBLIC_OSM_ENABLED=true AND state config osmEnabled=true
 * 
 * @param stateOsmEnabled - The osmEnabled flag from state config
 * @returns true if both global and state-level OSM flags are enabled
 */
export function isOSMEnabledForState(stateOsmEnabled?: boolean): boolean {
  // Global flag must be enabled
  if (!isOSMEnabled()) {
    return false;
  }
  // State-level flag must be explicitly true (defaults to false)
  return stateOsmEnabled === true;
}
