import fs from 'fs';
import path from 'path';

/**
 * Read and process the Karnataka map SVG on the server side.
 * Returns the cleaned SVG content that can be used directly in React.
 */
export function getKarnatakaMapSvg(): string | null {
    try {
        const svgPath = path.join(process.cwd(), 'public', 'map.svg');
        let svgContent = fs.readFileSync(svgPath, 'utf-8');

        // Remove XML declaration
        svgContent = svgContent.replace(/<\?xml[^?]*\?>/g, '').trim();

        // Remove comments
        svgContent = svgContent.replace(/<!--[\s\S]*?-->/g, '');

        return svgContent;
    } catch (error) {
        console.error('Failed to read Karnataka map SVG:', error);
        return null;
    }
}

/**
 * District list with their SVG IDs - using modern official names.
 */
export const KARNATAKA_DISTRICTS = [
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

export type DistrictSvgId = typeof KARNATAKA_DISTRICTS[number];
