/**
 * State Configuration Types (shared between client and server)
 * 
 * This file contains only type definitions and can be safely imported
 * in both client and server components.
 */

export interface StateConfig {
  stateCode: string;
  name: string;
  displayName: string;
  capital: string;
  totalRTOs: number;
  /** Optional: List of valid RTO codes (for non-sequential numbering) */
  validCodes?: string[];
  /** Maps district names to normalized identifiers used by OSM */
  districtMapping: Record<string, string>;
  /** Whether all RTOs have been added for this state/UT */
  isComplete: boolean;
  /** Whether this is a state or union territory */
  type: "state" | "union-territory";
  /** Whether OSM map is enabled for this state (requires boundaries.json and coordinates.json) */
  osmEnabled?: boolean;
  /** Number of RTOs currently in active use (for states with legacy/retired codes) */
  activeRTOs?: number;
}
