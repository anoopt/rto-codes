/**
 * District name mapping from RTO JSON data names to SVG element IDs.
 * 
 * The SVG map now uses modern official district names (e.g., "Ballari", "Mysuru", "Bengaluru Urban").
 * Most mappings are identity mappings since the SVG IDs match the official names.
 * 
 * Special cases:
 * - 'Bagalkote' → 'Bagalkot' (minor spelling variation)
 * - 'Chikkaballapura' → 'Chikkaballapur' (minor spelling variation)
 * - 'Vijayanagara' → 'Ballari' (newer district carved from Ballari, maps to parent)
 */

export const districtToSvgId: Record<string, string> = {
    // Identity mappings - district name matches SVG ID exactly
    'Bagalkot': 'Bagalkot',
    'Ballari': 'Ballari',
    'Belagavi': 'Belagavi',
    'Bengaluru Rural': 'Bengaluru Rural',
    'Bengaluru Urban': 'Bengaluru Urban',
    'Bidar': 'Bidar',
    'Chamarajanagar': 'Chamarajanagar',
    'Chikkaballapur': 'Chikkaballapur',
    'Chikkamagaluru': 'Chikkamagaluru',
    'Chitradurga': 'Chitradurga',
    'Dakshina Kannada': 'Dakshina Kannada',
    'Davanagere': 'Davanagere',
    'Dharwad': 'Dharwad',
    'Gadag': 'Gadag',
    'Hassan': 'Hassan',
    'Haveri': 'Haveri',
    'Kalaburagi': 'Kalaburagi',
    'Kodagu': 'Kodagu',
    'Kolar': 'Kolar',
    'Koppal': 'Koppal',
    'Mandya': 'Mandya',
    'Mysuru': 'Mysuru',
    'Raichur': 'Raichur',
    'Ramanagara': 'Ramanagara',
    'Shivamogga': 'Shivamogga',
    'Tumakuru': 'Tumakuru',
    'Udupi': 'Udupi',
    'Uttara Kannada': 'Uttara Kannada',
    'Vijayapura': 'Vijayapura',
    'Yadgir': 'Yadgir',

    // Special mappings - aliases or districts without their own SVG region
    'Bagalkote': 'Bagalkot',           // Alternate spelling
    'Chikkaballapura': 'Chikkaballapur', // Alternate spelling (extra 'a')
    'Vijayanagara': 'Ballari',         // Newer district carved from Ballari, maps to parent
};

/**
 * Get the SVG element ID for a given district name.
 * Returns the district name itself if found (identity mapping),
 * or null if the district is not in the mapping.
 */
export function getSvgDistrictId(districtName: string): string | null {
    return districtToSvgId[districtName] || null;
}

/**
 * List of all district SVG IDs available in the Karnataka map.
 * These now use modern official spellings.
 */
export const allSvgDistrictIds = [
    'Bagalkot',
    'Ballari',
    'Belagavi',
    'Bengaluru Rural',
    'Bengaluru Urban',
    'Bidar',
    'Chamarajanagar',
    'Chikkaballapur',
    'Chikkamagaluru',
    'Chitradurga',
    'Dakshina Kannada',
    'Davanagere',
    'Dharwad',
    'Gadag',
    'Hassan',
    'Haveri',
    'Kalaburagi',
    'Kodagu',
    'Kolar',
    'Koppal',
    'Mandya',
    'Mysuru',
    'Raichur',
    'Ramanagara',
    'Shivamogga',
    'Tumakuru',
    'Udupi',
    'Uttara Kannada',
    'Vijayapura',
    'Yadgir',
] as const;

/**
 * Reverse mapping from SVG district IDs to district names used in RTO data.
 * Used for click-to-navigate functionality on the map.
 * Since SVG IDs now match official names, this is mostly identity mapping.
 */
export const svgIdToDistrict: Record<string, string> = Object.fromEntries(
    Object.entries(districtToSvgId).map(([modern, svg]) => [svg, modern])
);

/**
 * Get the district name for a given SVG element ID.
 * Returns null if the SVG ID is not found in the mapping.
 */
export function getDistrictFromSvgId(svgId: string): string | null {
    return svgIdToDistrict[svgId] || null;
}
