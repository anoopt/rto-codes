/**
 * Script to extract coverage information from RTO descriptions
 * and populate the new 'coverage' field
 * 
 * Run with: npx tsx scripts/extract-coverage.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '..', 'data', 'karnataka');

interface RTOData {
    code: string;
    region: string;
    city: string;
    state: string;
    stateCode: string;
    district?: string;
    description?: string;
    coverage?: string;
    established?: string;
    additionalInfo?: string;
    imageCredit?: string;
    imageCreditLink?: string;
}

function extractCoverage(description: string): { cleanDescription: string; coverage: string | null } {
    if (!description) {
        return { cleanDescription: description, coverage: null };
    }

    let cleanDescription = description;
    let coverage: string | null = null;

    // Pattern 1: **Coverage**: text (markdown format with newlines)
    const markdownCoveragePattern = /\n\n\*\*Coverage\*\*:\s*(.+?)(?:\n|$)/i;
    const markdownMatch = cleanDescription.match(markdownCoveragePattern);

    if (markdownMatch) {
        coverage = markdownMatch[1].trim();
        cleanDescription = cleanDescription.replace(markdownCoveragePattern, '').trim();
    } else {
        // Pattern 2: Inline "Covers X." sentence (often followed by "Office at...")
        // Match "Covers [text]." but be careful not to match partial sentences
        const inlineCoveragePattern = /\s*Covers\s+([^.]+(?:District|Bengaluru|suburbs|Taluk|Taluks)[^.]*)\./i;
        const inlineMatch = cleanDescription.match(inlineCoveragePattern);

        if (inlineMatch) {
            coverage = `Covers ${inlineMatch[1].trim()}.`;
            cleanDescription = cleanDescription.replace(inlineCoveragePattern, '').trim();
        }
    }

    return { cleanDescription, coverage };
}

function processRTOFile(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const rto: RTOData = JSON.parse(content);

    if (!rto.description) {
        console.log(`  Skipping ${rto.code}: No description`);
        return;
    }

    // Skip if already has coverage
    if (rto.coverage) {
        console.log(`  Skipping ${rto.code}: Already has coverage`);
        return;
    }

    const { cleanDescription, coverage } = extractCoverage(rto.description);

    if (coverage) {
        console.log(`  ${rto.code}: Extracted coverage: "${coverage}"`);

        // Update the RTO data
        rto.description = cleanDescription;
        rto.coverage = coverage;

        // Write back to file with proper formatting
        const output = JSON.stringify(rto, null, 2) + '\n';
        fs.writeFileSync(filePath, output, 'utf-8');
    } else {
        console.log(`  ${rto.code}: No coverage pattern found`);
    }
}

function main(): void {
    console.log('Extracting coverage from RTO descriptions...\n');

    // Get all ka-*.json files
    const files = fs.readdirSync(DATA_DIR)
        .filter(f => f.match(/^ka-\d+\.json$/))
        .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.match(/\d+/)?.[0] || '0');
            return numA - numB;
        });

    console.log(`Found ${files.length} RTO files\n`);

    let extracted = 0;
    let skipped = 0;

    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        const beforeContent = fs.readFileSync(filePath, 'utf-8');

        processRTOFile(filePath);

        const afterContent = fs.readFileSync(filePath, 'utf-8');
        if (beforeContent !== afterContent) {
            extracted++;
        } else {
            skipped++;
        }
    }

    console.log(`\nDone! Extracted coverage from ${extracted} files, skipped ${skipped} files.`);
}

main();
