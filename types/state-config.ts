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
  mapFile?: string;
  districtMapping: Record<string, string>;
  svgDistrictIds: string[];
  /** Whether all RTOs have been added for this state/UT */
  isComplete: boolean;
  /** Whether this is a state or union territory */
  type: "state" | "union-territory";
}
