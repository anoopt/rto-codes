/**
 * TypeScript type definitions for RTO Codes data structure
 * 
 * These types ensure data consistency across all RTO code entries
 * and provide excellent IDE autocomplete support.
 */

/**
 * Represents a single RTO (Regional Transport Office) code entry
 */
export interface RTOCode {
  /** 
   * The official RTO code (e.g., "KA-01", "KA-19")
   * Format: STATE_CODE-NUMBER
   */
  code: string;

  /**
   * The specific region or area name this RTO serves
   * Example: "Bangalore (Central)", "Mysore", "Hubli"
   */
  region: string;

  /**
   * The primary city where this RTO is located
   * Example: "Bangalore", "Mysore", "Mangalore"
   */
  city: string;

  /**
   * The full state name
   * Example: "Karnataka", "Tamil Nadu"
   */
  state: string;

  /**
   * Two-letter state code
   * Example: "KA", "TN", "MH"
   */
  stateCode: string;

  /**
   * The district this RTO serves (optional)
   * Example: "Bangalore Urban", "Mysore", "Dakshina Kannada"
   */
  district?: string;

  /**
   * Detailed description of the RTO and areas it serves
   * Supports markdown formatting
   * Use *text* for emphasis (will be styled differently)
   */
  description?: string;

  /**
   * Geographic coverage area served by this RTO (optional)
   * Example: "Covers entire Udupi District", "Covers Central Bengaluru"
   */
  coverage?: string;

  /**
   * Year the RTO office was established (optional)
   * Example: "1988", "1995"
   */
  established?: string;

  /**
   * Physical address of the RTO office (optional)
   * Example: "21st Main Road, Agara village, 1st Sector, H.S.R. Layout"
   */
  address?: string;

  /**
   * Pin code of the RTO office location (optional)
   * Example: "560102"
   */
  pinCode?: string;

  /**
   * Contact phone number(s) for the RTO office (optional)
   * Example: "080-25533525, 080-25533545"
   */
  phone?: string;

  /**
   * Official email address of the RTO office (optional)
   * Example: "rtobngc-ka@nic.in"
   */
  email?: string;

  /**
   * Administrative division this RTO belongs to (optional)
   * Example: "Bengaluru Urban Division", "Mysuru Division"
   */
  division?: string;

  /**
   * List of areas/localities under this RTO's jurisdiction (optional)
   * Example: ["Koramangala", "HSR Layout", "Agara"]
   */
  jurisdictionAreas?: string[];

  /**
   * Additional information about coverage areas, pin codes, etc. (optional)
   */
  additionalInfo?: string;

  /**
   * Name of the photographer or image source (optional)
   * Required if an image is provided
   */
  imageCredit?: string;

  /**
   * Link to the image source or photographer's page (optional)
   * Required if an image is provided
   * Should be a Creative Commons licensed source
   */
  imageCreditLink?: string;

  /**
   * Status of the RTO code (optional)
   * 'not-in-use' indicates this code is no longer active
   */
  status?: 'not-in-use' | 'active' | 'discontinued';

  /**
   * Additional note about the RTO code (optional)
   * Used for redirecting users to active RTOs when status is 'not-in-use'
   */
  note?: string;

  /**
   * RTO code to redirect to when this RTO is not in use (optional)
   * Example: "GA-07" for GA-01 which redirects to GA-07
   * Used to dynamically create links to active RTOs
   */
  redirectTo?: string;

  /**
   * Whether this RTO corresponds to the district headquarters (optional)
   * Used for prioritizing map navigation
   */
  isDistrictHeadquarter?: boolean;
}

/**
 * State metadata containing information about the entire state
 */
export interface StateMetadata {
  /**
   * State code (e.g., "KA", "TN")
   */
  code: string;

  /**
   * Full state name (e.g., "Karnataka", "Tamil Nadu")
   */
  name: string;

  /**
   * Total number of RTO codes in this state
   */
  totalRTOs: number;

  /**
   * List of districts in this state
   */
  districts: string[];

  /**
   * Population of the state (optional)
   */
  population?: number;

  /**
   * Number of registered vehicles (optional)
   */
  registeredVehicles?: number;
}

/**
 * Search result structure for search functionality
 */
export interface RTOSearchResult extends RTOCode {
  /**
   * Search relevance score (0-1)
   * Higher score = better match
   */
  score?: number;

  /**
   * Matched fields that caused this result
   */
  matches?: string[];
}

/**
 * Filter options for browsing RTOs
 */
export interface RTOFilters {
  /**
   * Filter by state code
   */
  state?: string;

  /**
   * Filter by district name
   */
  district?: string;

  /**
   * Filter by city name
   */
  city?: string;

  /**
   * Search query string
   */
  query?: string;
}

/**
 * Sort options for RTO listings
 */
export type RTOSortOption =
  | 'code-asc'      // By code, ascending (KA-01, KA-02, ...)
  | 'code-desc'     // By code, descending
  | 'name-asc'      // By region name, A-Z
  | 'name-desc'     // By region name, Z-A
  | 'city-asc'      // By city name, A-Z
  | 'city-desc';    // By city name, Z-A

/**
 * Example usage:
 * 
 * ```typescript
 * import { RTOCode } from './types/rto';
 * 
 * const ka01: RTOCode = {
 *   code: "KA-01",
 *   region: "Bangalore (Central)",
 *   city: "Bangalore",
 *   state: "Karnataka",
 *   stateCode: "KA",
 *   district: "Bangalore Urban",
 *   description: "The primary RTO office for central Bangalore...",
 *   established: "1988"
 * };
 * ```
 */
