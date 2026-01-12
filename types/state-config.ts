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
  mapFile: string;
  districtMapping: Record<string, string>;
  svgDistrictIds: string[];
}
