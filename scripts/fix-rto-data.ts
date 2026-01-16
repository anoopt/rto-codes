#!/usr/bin/env bun
/**
 * Script to fix RTO JSON files by adding required fields
 * This adds missing region, city, state, and stateCode fields
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'karnataka');

interface RTOData {
    code: string;
    name?: string;
    region?: string;
    city?: string;
    state?: string;
    stateCode?: string;
    district?: string;
    address?: string;
    pinCode?: string;
    phone?: string;
    email?: string;
    division?: string;
    jurisdictionAreas?: string[];
    description?: string;
    coverage?: string;
    established?: string;
    additionalInfo?: string;
}

// Extract region name from the RTO name
function extractRegion(name: string): string {
    // Remove RTO/ARTO suffix and get the location name
    const regionName = name
        .replace(/\s*(RTO|ARTO)$/i, '')
        .trim();
    return regionName;
}

// Extract city from region or district
function extractCity(region: string, district: string): string {
    // For most cases, the city is the same as the region
    // For Bengaluru RTOs, the city is Bengaluru
    if (district === 'Bengaluru Urban' || district === 'Bengaluru Rural') {
        return 'Bengaluru';
    }
    return region;
}

// Generate description from the data
function generateDescription(code: string, name: string, district: string): string {
    const officeType = name.includes('ARTO') ? 'Assistant Regional Transport Office' : 'Regional Transport Office';
    return `The ${code} ${officeType} (${name}) handles vehicle registrations and transport services for this region in ${district} district.`;
}

async function fixRTOFiles() {
    const files = fs.readdirSync(DATA_DIR)
        .filter(file => file.match(/^ka-\d+\.json$/));

    console.log(`🔧 Fixing ${files.length} RTO files...`);

    let fixed = 0;
    let skipped = 0;

    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const data: RTOData = JSON.parse(content);

        // Check if already has required fields
        if (data.region && data.city && data.state && data.stateCode) {
            skipped++;
            continue;
        }

        // Fix missing fields
        const name = data.name || '';
        const district = data.district || '';
        const region = data.region || extractRegion(name);
        const city = data.city || extractCity(region, district);

        const fixedData: RTOData = {
            code: data.code,
            region: region,
            city: city,
            state: 'Karnataka',
            stateCode: 'KA',
            district: data.district,
            division: data.division,
            description: data.description || generateDescription(data.code, name, district),
            established: data.established || 'N/A',
            coverage: data.coverage,
            address: data.address,
            pinCode: data.pinCode,
            phone: data.phone,
            email: data.email,
            jurisdictionAreas: data.jurisdictionAreas,
            additionalInfo: data.additionalInfo,
        };

        // Remove undefined fields
        const cleanData = Object.fromEntries(
            Object.entries(fixedData).filter(([, v]) => v !== undefined)
        );

        fs.writeFileSync(filePath, JSON.stringify(cleanData, null, 2) + '\n');
        console.log(`  ✅ Fixed ${file}: region="${region}", city="${city}"`);
        fixed++;
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Fixed: ${fixed} files`);
    console.log(`   Skipped (already valid): ${skipped} files`);
    console.log(`\n✨ Done! Run 'npm run build' to regenerate the index.`);
}

fixRTOFiles().catch(console.error);
