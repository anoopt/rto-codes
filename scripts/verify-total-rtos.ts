#!/usr/bin/env bun
/**
 * Verify Total RTOs Script
 * 
 * Uses Gemini AI to research and verify the total number of RTOs for each state/UT
 * and updates the config.json files with accurate counts.
 * 
 * Usage: 
 *   bun scripts/verify-total-rtos.ts [options]
 * 
 * Options:
 *   --state=STATE     Verify specific state only (e.g., --state=maharashtra)
 *   --dry-run         Show what would be updated without making changes
 *   --force           Update even if totalRTOs is already set (non-zero)
 * 
 * Examples:
 *   bun scripts/verify-total-rtos.ts                    # Verify all states with totalRTOs=0
 *   bun scripts/verify-total-rtos.ts --state=maharashtra  # Verify Maharashtra only
 *   bun scripts/verify-total-rtos.ts --dry-run         # Preview without changes
 *   bun scripts/verify-total-rtos.ts --force           # Update all states including complete ones
 * 
 * Environment variables required:
 * - GEMINI_API_KEY
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import type { StateConfig } from '../types/state-config.js';

// Validate environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is not set');
    process.exit(1);
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Get all state directories
 */
function getStateDirs(): string[] {
    const dataDir = path.join(process.cwd(), 'data');
    const entries = fs.readdirSync(dataDir, { withFileTypes: true });

    return entries
        .filter(entry => entry.isDirectory())
        .filter(entry => {
            const configPath = path.join(dataDir, entry.name, 'config.json');
            return fs.existsSync(configPath);
        })
        .map(entry => entry.name);
}

/**
 * Load state config
 */
function loadStateConfig(stateDir: string): StateConfig | null {
    const configPath = path.join(process.cwd(), 'data', stateDir, 'config.json');

    if (!fs.existsSync(configPath)) {
        return null;
    }

    try {
        const data = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(data) as StateConfig;
    } catch (error) {
        console.error(`❌ Error loading config for ${stateDir}:`, error);
        return null;
    }
}

/**
 * Save state config
 */
function saveStateConfig(stateDir: string, config: StateConfig): void {
    const configPath = path.join(process.cwd(), 'data', stateDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

/**
 * Research total RTOs and valid codes for a state using Gemini
 */
async function researchTotalRTOs(stateName: string, stateCode: string): Promise<{ count: number; validCodes: string[] } | null> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        const prompt = `You are a research assistant helping to build a comprehensive RTO (Regional Transport Office) database for India.

Research task: Find ALL VALID RTO codes currently in use for ${stateName}, India.

CRITICAL: RTO codes are often NON-SEQUENTIAL and may include VERY HIGH NUMBERS (e.g., AP-01, AP-02, AP-03, then AP-135, AP-137, AP-141, AP-202, AP-203, AP-707, AP-905 - note the huge gaps!)

IMPORTANT: Include BOTH main RTOs AND Unit Offices/Sub-offices:
- Main RTO offices typically use 2-digit codes (e.g., AP-01, AP-02, AP-07, AP-08)
- Unit Offices and sub-offices often use 3-digit codes (e.g., AP-707 for Tenali Unit Office under Guntur)
- Some states have "700 series", "800 series", or even "900 series" codes for sub-offices

SEARCH REQUIREMENTS:
1. Search MULTIPLE sources: official transport department websites, Wikipedia, vehicle registration sites, Parivahan portal, unit office lists
2. Look for codes in ALL number ranges: 01-99, 100-999
3. Specifically search for terms like "Unit Office", "Sub-office", "700 series", "800 series"
4. List ALL valid RTO codes you find - do not assume sequential numbering or filter out "minor" offices
5. Include codes that may be discontinued but were officially assigned
6. State code is: ${stateCode}
7. RTO codes follow format: ${stateCode}-01, ${stateCode}-02, ${stateCode}-707, ${stateCode}-905, etc.

Return ONLY a JSON object in this exact format:
{
  "totalRTOs": <actual count of valid codes>,
  "validCodes": ["${stateCode}-01", "${stateCode}-02", "${stateCode}-03", ...],
  "highestCode": "<highest RTO code found>",
  "confidence": <0-100 confidence score>,
  "sources": "<brief list of sources used>",
  "notes": "<any important notes about gaps, discontinued codes, etc.>"
}

Example response for a fictional state with non-sequential codes:
{
  "totalRTOs": 5,
  "validCodes": ["XX-01", "XX-02", "XX-03", "XX-135", "XX-202"],
  "highestCode": "XX-202",
  "confidence": 90,
  "sources": "State Transport Department website, Wikipedia",
  "notes": "Codes are non-sequential. XX-04 through XX-134 and XX-136 through XX-201 do not exist."

Now research ${stateName} (${stateCode}):`;

        console.log(`  🔍 Researching ${stateName}...`);

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Extract JSON from response (handle code blocks)
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error(`  ❌ Invalid response format for ${stateName}`);
            return null;
        }

        const data = JSON.parse(jsonMatch[0]);

        console.log(`  📊 Results:`);
        console.log(`     Total RTOs: ${data.totalRTOs}`);
        console.log(`     Valid Codes: ${data.validCodes?.length || 0} codes`);
        if (data.validCodes && data.validCodes.length > 0) {
            console.log(`     Sample: ${data.validCodes.slice(0, 5).join(', ')}${data.validCodes.length > 5 ? '...' : ''}`);
        }
        console.log(`     Highest Code: ${data.highestCode}`);
        console.log(`     Confidence: ${data.confidence}%`);
        console.log(`     Sources: ${data.sources}`);
        if (data.notes) {
            console.log(`     Notes: ${data.notes}`);
        }

        // Validate response
        if (typeof data.totalRTOs !== 'number' || data.totalRTOs < 0 || data.totalRTOs > 999) {
            console.error(`  ⚠️ Suspicious totalRTOs value: ${data.totalRTOs}`);
            return null;
        }

        if (!Array.isArray(data.validCodes) || data.validCodes.length === 0) {
            console.error(`  ⚠️ No valid codes array in response`);
            return null;
        }

        if (data.validCodes.length !== data.totalRTOs) {
            console.warn(`  ⚠️ Mismatch: totalRTOs=${data.totalRTOs} but validCodes has ${data.validCodes.length} codes`);
            // Use the actual array length as source of truth
            data.totalRTOs = data.validCodes.length;
        }

        if (data.confidence < 50) {
            console.warn(`  ⚠️ Low confidence score: ${data.confidence}%`);
        }

        return { count: data.totalRTOs, validCodes: data.validCodes };
    } catch (error) {
        console.error(`  ❌ Error researching ${stateName}:`, error);
        return null;
    }
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 Starting RTO Count Verification\n');
    console.log('='.repeat(70));

    // Parse command line arguments
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const force = args.includes('--force');
    const singleState = args.find(arg => arg.startsWith('--state='))?.split('=')[1];

    console.log(`Options:`);
    console.log(`  Dry run: ${dryRun}`);
    console.log(`  Force update: ${force}`);
    console.log(`  Single state: ${singleState || 'all states'}`);
    console.log('='.repeat(70));

    // Get state directories
    let stateDirs = getStateDirs();

    if (singleState) {
        stateDirs = stateDirs.filter(dir =>
            dir.toLowerCase() === singleState.toLowerCase()
        );

        if (stateDirs.length === 0) {
            console.error(`❌ State not found: ${singleState}`);
            process.exit(1);
        }
    }

    console.log(`\n📂 Found ${stateDirs.length} state(s) to process\n`);

    // Process each state
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const stateDir of stateDirs) {
        console.log(`\n${'─'.repeat(70)}`);
        console.log(`📍 Processing: ${stateDir}`);
        console.log(`${'─'.repeat(70)}`);

        const config = loadStateConfig(stateDir);
        if (!config) {
            console.error(`  ❌ Failed to load config`);
            errorCount++;
            continue;
        }

        // Skip if already has totalRTOs set (unless force flag)
        if (config.totalRTOs > 0 && !force) {
            console.log(`  ⏭️  Skipping - totalRTOs already set to ${config.totalRTOs}`);
            console.log(`     (use --force to update anyway)`);
            skippedCount++;
            continue;
        }

        // Research total RTOs and valid codes
        const result = await researchTotalRTOs(config.displayName || config.name, config.stateCode);

        if (result === null) {
            console.error(`  ❌ Failed to get RTO data`);
            errorCount++;
            continue;
        }

        // Update config
        const oldValue = config.totalRTOs;
        config.totalRTOs = result.count;
        config.validCodes = result.validCodes;

        if (dryRun) {
            console.log(`  🔍 DRY RUN: Would update totalRTOs: ${oldValue} → ${result.count}`);
            console.log(`  🔍 DRY RUN: Would save ${result.validCodes.length} valid codes`);
            console.log(`  📋 Sample codes: ${result.validCodes.slice(0, 5).join(', ')}${result.validCodes.length > 5 ? ', ...' : ''}`);
        } else {
            saveStateConfig(stateDir, config);
            console.log(`  ✅ Updated: totalRTOs ${oldValue} → ${result.count}`);
            console.log(`  ✅ Saved ${result.validCodes.length} valid codes`);
            console.log(`  📋 Sample codes: ${result.validCodes.slice(0, 5).join(', ')}${result.validCodes.length > 5 ? ', ...' : ''}`);
        }

        updatedCount++;

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 Summary:');
    console.log(`  ✅ Updated: ${updatedCount}`);
    console.log(`  ⏭️  Skipped: ${skippedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);

    if (dryRun) {
        console.log('\n  ℹ️  This was a dry run - no changes were made');
        console.log('     Run without --dry-run to apply changes');
    }

    console.log('='.repeat(70));
}

// Run
main().catch(console.error);
