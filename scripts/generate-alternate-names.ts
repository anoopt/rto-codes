#!/usr/bin/env bun
/**
 * Generate Alternate Names for RTO Cities and Districts
 *
 * Scans all RTO data, extracts unique city and district names, then uses
 * Google Gemini to generate well-known alternate/historical names for each.
 * Outputs to data/alternate-names.json, which is consumed by search-utils.ts.
 *
 * Usage:
 *   bun scripts/generate-alternate-names.ts              # Generate for all names
 *   bun scripts/generate-alternate-names.ts --dry-run    # Preview without saving
 *   bun scripts/generate-alternate-names.ts --merge      # Merge with existing file (keep manual edits)
 *
 * Environment Variables:
 *   GEMINI_API_KEY    Your Google Gemini API key (required)
 */

import { GoogleGenAI } from '@google/genai';
import { z, toJSONSchema } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import type { RTOCode } from '../types/rto.js';

// Helper to convert Zod schema to Gemini-compatible JSON schema
function toGeminiSchema(schema: z.ZodType): object {
    const jsonSchema = toJSONSchema(schema) as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { $schema, additionalProperties, ...rest } = jsonSchema;
    return rest;
}

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-3-flash-preview';
const DATA_DIR = path.join(process.cwd(), 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'alternate-names.json');

// Maximum names per Gemini request to stay within token limits
const BATCH_SIZE = 80;
const API_DELAY_MS = 2000;

// ============================================================================
// Zod Schemas
// ============================================================================

const AlternateNameEntry = z.object({
    name: z.string().describe('The official/current name as it appears in the data'),
    alternates: z
        .array(z.string())
        .describe(
            'Up to 5 well-known alternate, historical, or colloquial names. ' +
            'Only include names that real people commonly use. Empty array if none.',
        ),
});

const AlternateNamesResponse = z.object({
    entries: z.array(AlternateNameEntry),
});

// ============================================================================
// CLI Parsing
// ============================================================================

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const merge = args.includes('--merge');

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: bun scripts/generate-alternate-names.ts [options]

Options:
  --dry-run    Preview without saving
  --merge      Merge with existing alternate-names.json (preserves manual edits)
  --help, -h   Show this help

Environment:
  GEMINI_API_KEY   Required. Your Google Gemini API key.
`);
    process.exit(0);
}

// ============================================================================
// Validate environment
// ============================================================================

if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is not set');
    console.error('   Set it with: export GEMINI_API_KEY=your-api-key');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ============================================================================
// Helpers
// ============================================================================

function getAvailableStates(): string[] {
    const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
    return entries
        .filter(
            (e) =>
                e.isDirectory() &&
                (fs.existsSync(path.join(DATA_DIR, e.name, 'index.json')) ||
                    fs.existsSync(path.join(DATA_DIR, e.name, 'config.json'))),
        )
        .map((e) => e.name);
}

function loadAllRTOs(): RTOCode[] {
    const states = getAvailableStates();
    const all: RTOCode[] = [];

    for (const state of states) {
        const indexPath = path.join(DATA_DIR, state, 'index.json');
        if (fs.existsSync(indexPath)) {
            const content = fs.readFileSync(indexPath, 'utf8');
            const rtos = JSON.parse(content) as RTOCode[];
            all.push(...rtos);
        }
    }

    return all;
}

function extractUniqueNames(rtos: RTOCode[]): string[] {
    const names = new Set<string>();

    for (const rto of rtos) {
        if (rto.city) names.add(rto.city);
        if (rto.district) names.add(rto.district);
        if (rto.region && rto.region !== rto.city) names.add(rto.region);
    }

    return Array.from(names).sort();
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Gemini
// ============================================================================

async function fetchAlternateNames(
    names: string[],
): Promise<Record<string, string[]>> {
    const prompt = `You are an expert on Indian geography, history, and local naming conventions.

For each of the following Indian city/district/locality names, provide up to 5 well-known **alternate names** that people commonly use to refer to the same place.

## What counts as an alternate name:
- **Historical/colonial names**: Bombay for Mumbai, Madras for Chennai, Calcutta for Kolkata
- **Pre-rename official names**: Belgaum for Belagavi, Shimoga for Shivamogga, Hubli for Hubballi
- **Common colloquial names**: Bangalore for Bengaluru, Poona for Pune
- **Widely-used spelling variants**: Mysore for Mysuru, Mangalore for Mangaluru

## What does NOT count:
- Transliterations or minor spelling differences (Kochi vs Kochin is OK, but not trivial typos)
- Completely unrelated names
- Names only used in specific languages unless they are widely known in English
- Generic descriptions like "Silicon Valley of India"

## Rules:
- Only include names that an average Indian person might actually type when searching
- Return an EMPTY array [] if no well-known alternate names exist
- Maximum 5 alternates per name
- All names should be in English/Roman script

## Names to process:
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Return results for ALL ${names.length} names, even if the alternates array is empty.`;

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: toGeminiSchema(AlternateNamesResponse),
        },
    });

    const text = response.text ?? '{}';
    const parsed = AlternateNamesResponse.parse(JSON.parse(text));

    const result: Record<string, string[]> = {};
    for (const entry of parsed.entries) {
        if (entry.alternates.length > 0) {
            result[entry.name] = entry.alternates;
        }
    }

    return result;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    console.log('🔍 Scanning RTO data for unique names...\n');

    const rtos = loadAllRTOs();
    const uniqueNames = extractUniqueNames(rtos);

    console.log(`   Found ${uniqueNames.length} unique city/district/region names from ${rtos.length} RTOs\n`);

    // Load existing data if merging
    let existing: Record<string, string[]> = {};
    if (merge && fs.existsSync(OUTPUT_FILE)) {
        existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        console.log(`   Loaded ${Object.keys(existing).length} existing entries (--merge mode)\n`);
    }

    // Process in batches
    const batches: string[][] = [];
    for (let i = 0; i < uniqueNames.length; i += BATCH_SIZE) {
        batches.push(uniqueNames.slice(i, i + BATCH_SIZE));
    }

    console.log(`🤖 Sending ${batches.length} batch(es) to Gemini...\n`);

    const allResults: Record<string, string[]> = {};

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`   Batch ${i + 1}/${batches.length} (${batch.length} names)...`);

        try {
            const results = await fetchAlternateNames(batch);
            Object.assign(allResults, results);
            console.log(`   ✅ Got alternates for ${Object.keys(results).length} names`);
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`   ❌ Batch ${i + 1} failed: ${msg}`);
        }

        // Rate limiting between batches
        if (i < batches.length - 1) {
            await sleep(API_DELAY_MS);
        }
    }

    // Merge with existing if requested
    const finalResult = merge ? { ...existing, ...allResults } : allResults;

    // Sort by key for readability
    const sorted = Object.fromEntries(
        Object.entries(finalResult).sort(([a], [b]) => a.localeCompare(b)),
    );

    const namesWithAlternates = Object.keys(sorted).length;

    console.log(`\n📊 Summary:`);
    console.log(`   ${uniqueNames.length} unique names scanned`);
    console.log(`   ${namesWithAlternates} names have alternate names`);
    console.log(
        `   ${Object.values(sorted).reduce((sum, arr) => sum + arr.length, 0)} total alternates`,
    );

    if (dryRun) {
        console.log(`\n🔍 Dry run — preview:\n`);
        for (const [name, alternates] of Object.entries(sorted)) {
            console.log(`   ${name} → ${alternates.join(', ')}`);
        }
        console.log(`\n   (--dry-run: not saved)`);
    } else {
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
        console.log(`\n✅ Saved to ${path.relative(process.cwd(), OUTPUT_FILE)}`);
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
