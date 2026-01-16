#!/usr/bin/env bun
/**
 * RTO Data Validation & Fix Script
 * 
 * Uses Google Gemini to validate RTO JSON data and automatically fix issues.
 * Can update JSON files based on AI suggestions with human review.
 * 
 * Usage: 
 *   bun scripts/validate-and-fix-rto-data.ts [options] [state] [code]
 * 
 * Examples:
 *   bun scripts/validate-and-fix-rto-data.ts goa                    # Validate all Goa RTOs
 *   bun scripts/validate-and-fix-rto-data.ts karnataka ka-01        # Validate specific RTO
 *   bun scripts/validate-and-fix-rto-data.ts --all --limit=5        # Validate 5 RTOs from all states
 *   bun scripts/validate-and-fix-rto-data.ts goa --fix              # Validate and auto-fix issues
 *   bun scripts/validate-and-fix-rto-data.ts goa --fix --dry-run    # Preview fixes without saving
 *   bun scripts/validate-and-fix-rto-data.ts --state=goa --fix      # Alternative state syntax
 *   bun scripts/validate-and-fix-rto-data.ts kerala kl-49 --search  # Use Google Search grounding
 * 
 * Options:
 *   --all              Validate all available states
 *   --state=STATE      Specify state to validate
 *   --limit=N          Limit number of RTOs to validate per state
 *   --fix              Apply Gemini's suggested fixes to JSON files
 *   --dry-run          Preview changes without saving (use with --fix)
 *   --save             Save validation results to JSON file
 *   --skip-notinuse    Skip 'not-in-use' RTO codes
 *   --search           Use Google Search grounding for better accuracy
 *   --verbose          Show detailed output
 *   --help, -h         Show this help message
 * 
 * Environment variables required:
 *   GEMINI_API_KEY     Your Google Gemini API key
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-3-flash-preview';
const API_DELAY_MS = 1500; // Delay between API calls to avoid rate limiting

// ============================================================================
// Types
// ============================================================================

interface RTOData {
    code: string;
    region: string;
    city: string;
    state: string;
    stateCode: string;
    district?: string;
    division?: string;
    description?: string;
    coverage?: string;
    status?: 'not-in-use' | 'active';
    established?: string;
    address?: string;
    pinCode?: string;
    phone?: string;
    email?: string;
    jurisdictionAreas?: string[];
    additionalInfo?: string;
    note?: string;
    imageCredit?: string;
    imageCreditLink?: string;
}

interface StateConfig {
    stateCode: string;
    name: string;
    capital: string;
    totalRTOs: number;
    districtMapping: Record<string, string>;
}

interface ValidationResult {
    code: string;
    isValid: boolean;
    confidence: number;
    issues: string[];
    suggestions: string[];
    summary: string;
    correctedData?: Partial<RTOData>;
}

interface FixResult {
    code: string;
    fieldsUpdated: string[];
    beforeValues: Record<string, unknown>;
    afterValues: Record<string, unknown>;
}

interface CLIOptions {
    validateAll: boolean;
    fix: boolean;
    dryRun: boolean;
    saveResults: boolean;
    skipNotInUse: boolean;
    useSearch: boolean;
    verbose: boolean;
    limit: number;
    state?: string;
    specificCode?: string;
}

// ============================================================================
// Validation
// ============================================================================

if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is not set');
    console.error('   Set it with: export GEMINI_API_KEY=your-api-key');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ============================================================================
// Utility Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getAvailableStates(): string[] {
    const dataDir = path.join(process.cwd(), 'data');
    try {
        const entries = fs.readdirSync(dataDir, { withFileTypes: true });
        return entries
            .filter(entry => entry.isDirectory())
            .filter(entry => {
                const configPath = path.join(dataDir, entry.name, 'config.json');
                return fs.existsSync(configPath);
            })
            .map(entry => entry.name);
    } catch {
        return [];
    }
}

function loadStateConfig(state: string): StateConfig | null {
    const configPath = path.join(process.cwd(), 'data', state, 'config.json');
    if (!fs.existsSync(configPath)) return null;
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
        return null;
    }
}

function loadRTOData(state: string): RTOData[] {
    const indexPath = path.join(process.cwd(), 'data', state, 'index.json');
    if (!fs.existsSync(indexPath)) {
        console.error(`❌ Index file not found for state: ${state}`);
        return [];
    }
    try {
        return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    } catch (error) {
        console.error(`❌ Error reading index file for ${state}:`, error);
        return [];
    }
}

function loadSingleRTO(state: string, code: string): RTOData | null {
    const filePath = path.join(process.cwd(), 'data', state, `${code.toLowerCase()}.json`);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ RTO file not found: ${filePath}`);
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        console.error(`❌ Error reading RTO file:`, error);
        return null;
    }
}

function saveRTOData(state: string, code: string, data: RTOData): void {
    const filePath = path.join(process.cwd(), 'data', state, `${code.toLowerCase()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ============================================================================
// Gemini Validation & Fixing
// ============================================================================

async function validateAndFixWithGemini(
    rto: RTOData,
    stateConfig: StateConfig | null,
    shouldFix: boolean,
    useSearch: boolean = false
): Promise<ValidationResult> {
    try {
        // Configure model with or without Google Search grounding
        const modelConfig: { model: string; tools?: Array<{ googleSearch: Record<string, never> }> } = {
            model: MODEL_NAME,
        };

        if (useSearch) {
            modelConfig.tools = [{ googleSearch: {} }];
        }

        const model = genAI.getGenerativeModel(modelConfig);

        const searchInstruction = useSearch
            ? `\n\n## IMPORTANT: Use Google Search
You have access to Google Search. Before validating, SEARCH for "${rto.code} RTO" to find the correct city/location for this RTO code.
Use the search results to verify if the city/region in the JSON data is correct.
`
            : '';

        const prompt = `You are an expert on Indian Regional Transport Offices (RTOs) and vehicle registration systems.

Your task is to validate the following RTO data for accuracy, provide corrections if needed, AND fill in any missing information.
${searchInstruction}
## CRITICAL VALIDATION STEP - DO THIS FIRST:
**You MUST independently determine which city/region RTO Code ${rto.code} actually belongs to, based on your knowledge${useSearch ? ' and Google Search results' : ''}.**

Step 1: ${useSearch ? 'Search for "' + rto.code + ' RTO" and find ' : 'Ask yourself - '}"What city does RTO code ${rto.code} serve according to official Indian transport records?"
Step 2: Compare your answer to the city/region in the JSON data: "${rto.region}" / "${rto.city}"
Step 3: If they DO NOT match, this is a MAJOR ERROR. Set isValid: false immediately.

Example: If the JSON says the RTO is for "CityA" but ${useSearch ? 'search results show' : 'you know'} it is actually for "CityB", then:
- isValid MUST be false
- issues MUST include "RTO code [code] belongs to [correct city], not [wrong city]"
- correctedData MUST include "region", "city", "district", and any other affected fields with correct values

**DO NOT trust the JSON data blindly.** The JSON may contain completely wrong city/region/district information. Your job is to verify it independently.

## Additional Validation Checks:
1. Is the district assignment correct for the given city/region in that state?
2. Are the jurisdiction areas (talukas/mandals) correctly spelled and accurate for that RTO?
3. Is the description accurate and grammatically correct?
4. Is the division name correct for that RTO?
5. Are there any factual errors about the location or coverage?

## Missing Data to Fill:
Look for fields that have "N/A", empty strings "", or placeholder values and provide actual data if you know it:
- phone: Provide the actual RTO phone number if known (format: STD code + number, e.g., "0832-2262241")
- email: Provide the actual RTO email if known (usually format like rto-xxx.state@nic.in or similar)
- address: Provide the complete address if the current one is incomplete
- pinCode: Provide the correct 6-digit PIN code
- established: Year the RTO was established if known

## RTO Data to Validate:
\`\`\`json
${JSON.stringify(rto, null, 2)}
\`\`\`

${stateConfig ? `## State Context:
- State: ${stateConfig.name}
- State Code: ${stateConfig.stateCode}
- Capital: ${stateConfig.capital}
- Total RTOs: ${stateConfig.totalRTOs}
- Known Districts: ${Object.keys(stateConfig.districtMapping).join(', ')}
` : ''}

## Response Format:
Respond ONLY with a valid JSON object in this exact structure (no markdown, no explanation):
{
  "isValid": true or false,
  "confidence": 0-100,
  "issues": ["list of specific issues found - MUST include city mismatch if RTO code belongs to different city"],
  "suggestions": ["list of specific improvements"],
  "summary": "Brief overall assessment - MUST mention if city/region is wrong for this RTO code",
  "correctedData": {
    // CRITICAL: If the city/region is wrong, you MUST include corrected "region", "city", "district" here
    // Also include any other fields that need correction or have missing data
    // Example: "region": "CorrectCity", "city": "CorrectCity", "district": "CorrectDistrict"
    // Leave empty {} ONLY if ALL data including city/region is accurate
  }
}

**REMEMBER**: The most important check is whether ${rto.code} actually belongs to "${rto.region}". If not, the entire JSON data may be wrong and needs correction.`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Extract JSON from response (handle various formats)
        let jsonStr = response.trim();

        // Remove markdown code blocks if present
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }

        // Parse the JSON
        const parsed = JSON.parse(jsonStr);

        return {
            code: rto.code,
            isValid: parsed.isValid ?? true,
            confidence: parsed.confidence ?? 0,
            issues: parsed.issues ?? [],
            suggestions: parsed.suggestions ?? [],
            summary: parsed.summary ?? 'No summary provided',
            correctedData: shouldFix ? (parsed.correctedData ?? {}) : undefined,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ❌ Error validating ${rto.code}:`, errorMsg);

        return {
            code: rto.code,
            isValid: false,
            confidence: 0,
            issues: [`Failed to validate with Gemini: ${errorMsg}`],
            suggestions: ['Retry validation'],
            summary: `Validation error: ${errorMsg}`,
        };
    }
}

// ============================================================================
// Fix Application
// ============================================================================

function applyFixes(
    originalData: RTOData,
    corrections: Partial<RTOData>,
    verbose: boolean
): FixResult | null {
    const fieldsToFix = Object.keys(corrections).filter(
        key => corrections[key as keyof RTOData] !== undefined
    );

    if (fieldsToFix.length === 0) {
        return null;
    }

    const beforeValues: Record<string, unknown> = {};
    const afterValues: Record<string, unknown> = {};

    for (const field of fieldsToFix) {
        const key = field as keyof RTOData;
        beforeValues[field] = originalData[key];
        afterValues[field] = corrections[key];
    }

    return {
        code: originalData.code,
        fieldsUpdated: fieldsToFix,
        beforeValues,
        afterValues,
    };
}

function mergeRTOData(original: RTOData, corrections: Partial<RTOData>): RTOData {
    // Create a clean merge, preserving original field order
    const merged: RTOData = { ...original };

    for (const [key, value] of Object.entries(corrections)) {
        if (value !== undefined && value !== null && value !== '') {
            (merged as unknown as Record<string, unknown>)[key] = value;
        }
    }

    return merged;
}

// ============================================================================
// Display Functions
// ============================================================================

function printValidationResult(result: ValidationResult, verbose: boolean): void {
    const statusIcon = result.isValid ? '✅' : '❌';
    const confidencePercent = Math.round(result.confidence);
    const barLength = 20;
    const filledLength = Math.round((result.confidence / 100) * barLength);
    const confidenceBar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

    console.log(`\n${statusIcon} ${result.code}`);
    console.log(`   Confidence: [${confidenceBar}] ${confidencePercent}%`);
    console.log(`   Summary: ${result.summary}`);

    if (result.issues.length > 0) {
        console.log(`   Issues:`);
        for (const issue of result.issues) {
            console.log(`     ⚠️  ${issue}`);
        }
    }

    if (verbose && result.suggestions.length > 0) {
        console.log(`   Suggestions:`);
        for (const suggestion of result.suggestions) {
            console.log(`     💡 ${suggestion}`);
        }
    }

    if (result.correctedData && Object.keys(result.correctedData).length > 0) {
        console.log(`   Corrections available:`);
        for (const [field, value] of Object.entries(result.correctedData)) {
            console.log(`     🔧 ${field}: ${JSON.stringify(value)}`);
        }
    }
}

function printFixResult(fix: FixResult): void {
    console.log(`   📝 Applied fixes to ${fix.code}:`);
    for (const field of fix.fieldsUpdated) {
        console.log(`     ${field}:`);
        console.log(`       Before: ${JSON.stringify(fix.beforeValues[field])}`);
        console.log(`       After:  ${JSON.stringify(fix.afterValues[field])}`);
    }
}

function saveValidationResults(results: ValidationResult[], state: string): void {
    const outputPath = path.join(process.cwd(), 'data', state, 'validation-results.json');

    const output = {
        state,
        timestamp: new Date().toISOString(),
        model: MODEL_NAME,
        totalValidated: results.length,
        validCount: results.filter(r => r.isValid).length,
        invalidCount: results.filter(r => !r.isValid).length,
        averageConfidence: results.length > 0
            ? Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length)
            : 0,
        results: results.map(r => ({
            code: r.code,
            isValid: r.isValid,
            confidence: r.confidence,
            issues: r.issues,
            summary: r.summary,
        })),
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
    console.log(`\n📝 Results saved to: ${outputPath}`);
}

// ============================================================================
// CLI Parsing
// ============================================================================

function parseArgs(): CLIOptions {
    const args = process.argv.slice(2);

    const options: CLIOptions = {
        validateAll: false,
        fix: false,
        dryRun: false,
        saveResults: false,
        skipNotInUse: false,
        useSearch: false,
        verbose: false,
        limit: 0,
        state: undefined,
        specificCode: undefined,
    };

    const positionalArgs: string[] = [];

    for (const arg of args) {
        if (arg === '--all') {
            options.validateAll = true;
        } else if (arg === '--fix') {
            options.fix = true;
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--save') {
            options.saveResults = true;
        } else if (arg === '--skip-notinuse') {
            options.skipNotInUse = true;
        } else if (arg === '--search') {
            options.useSearch = true;
        } else if (arg === '--verbose' || arg === '-v') {
            options.verbose = true;
        } else if (arg.startsWith('--state=')) {
            options.state = arg.split('=')[1].toLowerCase();
        } else if (arg.startsWith('--limit=')) {
            options.limit = parseInt(arg.split('=')[1], 10) || 0;
        } else if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        } else if (!arg.startsWith('--')) {
            positionalArgs.push(arg);
        }
    }

    // Process positional arguments
    if (positionalArgs.length >= 1 && !options.state) {
        // First positional arg could be state
        const availableStates = getAvailableStates();
        if (availableStates.includes(positionalArgs[0].toLowerCase())) {
            options.state = positionalArgs[0].toLowerCase();
            if (positionalArgs.length >= 2) {
                options.specificCode = positionalArgs[1].toUpperCase();
            }
        } else {
            // Might be an RTO code like ka-01
            const codeMatch = positionalArgs[0].match(/^([a-z]{2})-(\d+)$/i);
            if (codeMatch) {
                const stateCode = codeMatch[1].toLowerCase();
                // Find state folder by code
                const stateCodeToFolder: Record<string, string> = {
                    'ka': 'karnataka',
                    'ga': 'goa',
                };
                options.state = stateCodeToFolder[stateCode];
                options.specificCode = positionalArgs[0].toUpperCase();
            }
        }
    }

    return options;
}

function printHelp(): void {
    console.log(`
🔍 RTO Data Validation & Fix Script

Usage:
  bun scripts/validate-and-fix-rto-data.ts [options] [state] [code]

Examples:
  bun scripts/validate-and-fix-rto-data.ts goa                    # Validate all Goa RTOs
  bun scripts/validate-and-fix-rto-data.ts karnataka ka-01        # Validate specific RTO
  bun scripts/validate-and-fix-rto-data.ts --all --limit=5        # Validate 5 RTOs from all states
  bun scripts/validate-and-fix-rto-data.ts goa --fix              # Validate and auto-fix issues
  bun scripts/validate-and-fix-rto-data.ts goa --fix --dry-run    # Preview fixes without saving
  bun scripts/validate-and-fix-rto-data.ts --state=goa --fix      # Alternative state syntax
  bun scripts/validate-and-fix-rto-data.ts kerala kl-49 --search  # Use Google Search for verification

Options:
  --all              Validate all available states
  --state=STATE      Specify state to validate (e.g., --state=goa)
  --limit=N          Limit number of RTOs to validate per state
  --fix              Apply Gemini's suggested fixes to JSON files
  --dry-run          Preview changes without saving (use with --fix)
  --save             Save validation results to JSON file
  --skip-notinuse    Skip 'not-in-use' RTO codes
  --search           Use Google Search grounding for better accuracy (recommended)
  --verbose, -v      Show detailed output including suggestions
  --help, -h         Show this help message

Environment Variables:
  GEMINI_API_KEY     Your Google Gemini API key (required)

Available States:
  ${getAvailableStates().join(', ') || 'None found'}
`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
    console.log('🔍 RTO Data Validation & Fix Script');
    console.log('='.repeat(60));

    const options = parseArgs();

    if (!options.validateAll && !options.state) {
        printHelp();
        process.exit(0);
    }

    // Determine which states to validate
    const states = options.validateAll
        ? getAvailableStates()
        : options.state
            ? [options.state]
            : [];

    if (states.length === 0) {
        console.error('❌ No states found to validate');
        process.exit(1);
    }

    console.log(`\nModel: ${MODEL_NAME}`);
    console.log(`States: ${states.join(', ')}`);
    if (options.specificCode) {
        console.log(`Specific code: ${options.specificCode}`);
    }
    if (options.limit > 0) {
        console.log(`Limit: ${options.limit} RTOs per state`);
    }
    if (options.useSearch) {
        console.log(`Search: 🔍 Google Search grounding enabled`);
    }
    if (options.fix) {
        console.log(`Mode: ${options.dryRun ? '🔍 FIX PREVIEW (dry-run)' : '🔧 FIX & SAVE'}`);
    }
    console.log('='.repeat(60));

    // Track overall statistics
    let totalValidated = 0;
    let totalValid = 0;
    let totalInvalid = 0;
    let totalFixed = 0;

    for (const state of states) {
        console.log(`\n📍 Processing ${state.toUpperCase()}`);
        console.log('-'.repeat(40));

        const stateConfig = loadStateConfig(state);
        if (!stateConfig) {
            console.log(`  ⚠️ No config found for ${state}, skipping`);
            continue;
        }

        // Load RTOs
        let rtosToValidate: RTOData[];

        if (options.specificCode) {
            const rto = loadSingleRTO(state, options.specificCode);
            if (!rto) {
                console.log(`  ❌ RTO ${options.specificCode} not found in ${state}`);
                continue;
            }
            rtosToValidate = [rto];
        } else {
            rtosToValidate = loadRTOData(state);
        }

        // Apply filters
        if (options.skipNotInUse) {
            rtosToValidate = rtosToValidate.filter(rto => rto.status !== 'not-in-use');
        }

        if (options.limit > 0) {
            rtosToValidate = rtosToValidate.slice(0, options.limit);
        }

        console.log(`  Found ${rtosToValidate.length} RTOs to validate`);

        const results: ValidationResult[] = [];
        const fixes: FixResult[] = [];

        for (const rto of rtosToValidate) {
            console.log(`\n  🔄 Validating ${rto.code}...`);

            const result = await validateAndFixWithGemini(rto, stateConfig, options.fix, options.useSearch);
            results.push(result);

            printValidationResult(result, options.verbose);

            // Apply fixes if requested
            if (options.fix && result.correctedData && Object.keys(result.correctedData).length > 0) {
                const fixResult = applyFixes(rto, result.correctedData, options.verbose);

                if (fixResult) {
                    fixes.push(fixResult);

                    if (options.dryRun) {
                        console.log(`\n   🔍 [DRY RUN] Would apply these fixes:`);
                        printFixResult(fixResult);
                    } else {
                        // Actually apply and save the fixes
                        const mergedData = mergeRTOData(rto, result.correctedData);
                        saveRTOData(state, rto.code, mergedData);

                        console.log(`\n   ✅ Applied and saved fixes:`);
                        printFixResult(fixResult);
                        totalFixed++;
                    }
                }
            }

            // Update statistics
            if (result.isValid) {
                totalValid++;
            } else {
                totalInvalid++;
            }
            totalValidated++;

            // Rate limiting
            await sleep(API_DELAY_MS);
        }

        // Save results if requested
        if (options.saveResults && results.length > 0) {
            saveValidationResults(results, state);
        }

        // Print state summary
        if (fixes.length > 0) {
            console.log(`\n  📊 ${state.toUpperCase()} Fix Summary:`);
            console.log(`     RTOs fixed: ${fixes.length}`);
            console.log(`     Total fields updated: ${fixes.reduce((sum, f) => sum + f.fieldsUpdated.length, 0)}`);
        }
    }

    // Print overall summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 OVERALL SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Total validated: ${totalValidated}`);
    console.log(`  ✅ Valid: ${totalValid} (${totalValidated > 0 ? Math.round((totalValid / totalValidated) * 100) : 0}%)`);
    console.log(`  ❌ Invalid: ${totalInvalid}`);
    if (options.fix) {
        console.log(`  🔧 Fixed: ${totalFixed}`);
    }
    console.log('='.repeat(60));

    // Reminder to regenerate index
    if (totalFixed > 0 && !options.dryRun) {
        console.log(`\n💡 Don't forget to regenerate the index files:`);
        console.log(`   bun scripts/generate-index.ts`);
    }
}

// Run
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
