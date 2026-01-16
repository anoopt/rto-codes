#!/usr/bin/env bun
/**
 * RTO Data Validation & Fix Script
 * 
 * Uses Google Gemini with structured output to validate RTO JSON data and automatically fix issues.
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

import { GoogleGenAI } from '@google/genai';
import { z, toJSONSchema } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// Helper to convert Zod schema to Gemini-compatible JSON schema
// Removes $schema and additionalProperties fields that Gemini API doesn't accept
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
const API_DELAY_MS = 1500;

// ============================================================================
// Zod Schemas
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const RTODataSchema = z.object({
    code: z.string().describe('RTO code like KA-01, KL-49'),
    region: z.string().describe('Region/area name this RTO serves'),
    city: z.string().describe('City name'),
    state: z.string().describe('Full state name'),
    stateCode: z.string().describe('2-letter state code'),
    district: z.string().optional().describe('District name'),
    division: z.string().optional().describe('Transport division name'),
    description: z.string().optional().describe('Description of the RTO'),
    coverage: z.string().optional().describe('Coverage area'),
    status: z.enum(['active', 'not-in-use']).optional().describe('Status'),
    established: z.string().optional().describe('Year established or N/A'),
    address: z.string().optional().describe('Physical address'),
    pinCode: z.string().optional().describe('6-digit PIN code'),
    phone: z.string().optional().describe('Contact phone number'),
    email: z.string().optional().describe('Contact email'),
    jurisdictionAreas: z.array(z.string()).optional().describe('Areas under jurisdiction'),
    additionalInfo: z.string().optional().describe('Additional information'),
    note: z.string().optional().describe('Additional notes'),
    imageCredit: z.string().optional().describe('Image credit'),
    imageCreditLink: z.string().optional().describe('Image credit link'),
});

const CorrectedDataSchema = z.object({
    region: z.string().optional().describe('Corrected region name'),
    city: z.string().optional().describe('Corrected city name'),
    district: z.string().optional().describe('Corrected district name'),
    division: z.string().optional().describe('Corrected division name'),
    description: z.string().optional().describe('Improved description'),
    address: z.string().optional().describe('Corrected address'),
    pinCode: z.string().optional().describe('Corrected PIN code'),
    phone: z.string().optional().describe('Corrected phone number'),
    email: z.string().optional().describe('Corrected email'),
    jurisdictionAreas: z.array(z.string()).optional().describe('Corrected jurisdiction areas'),
}).describe('Fields that need correction - only include fields that need to be changed');

const ValidationResultSchema = z.object({
    isValid: z.boolean().describe('Whether the RTO data is valid and accurate'),
    confidence: z.number().min(0).max(100).describe('Confidence percentage 0-100'),
    issues: z.array(z.string()).describe('List of specific issues found'),
    suggestions: z.array(z.string()).describe('List of specific improvements'),
    summary: z.string().describe('Brief overall assessment'),
    correctedData: CorrectedDataSchema.optional().describe('Corrected field values - only include fields that need fixing'),
});

type RTOData = z.infer<typeof RTODataSchema>;
type ValidationResult = { code: string } & z.infer<typeof ValidationResultSchema>;

interface StateConfig {
    stateCode: string;
    name: string;
    capital: string;
    totalRTOs: number;
    districtMapping: Record<string, string>;
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

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

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
// Gemini Validation & Fixing with Structured Output
// ============================================================================

async function validateAndFixWithGemini(
    rto: RTOData,
    stateConfig: StateConfig | null,
    shouldFix: boolean,
    useSearch: boolean = false
): Promise<ValidationResult> {
    try {
        const searchInstruction = useSearch
            ? `\n\n## IMPORTANT: Use Google Search
You have access to Google Search. Before validating, SEARCH for "${rto.code} RTO" to find the correct city/location for this RTO code.
Use the search results to verify if the city/region in the JSON data is correct.
`
            : '';

        const prompt = `You are an expert on Indian Regional Transport Offices (RTOs) and vehicle registration systems.

Your task is to validate the following RTO data for accuracy, provide corrections if needed, AND fill in any missing information.
${searchInstruction}
## CRITICAL VALIDATION RULES - READ CAREFULLY:

1. **EXISTENCE CHECK (Most Important)**: Does RTO Code ${rto.code} *actually exist*?
   - Many RTO lists online are incomplete or contain future planned codes.
   - If this RTO code does not exist (e.g., AN-03 for Andaman & Nicobar which stops at AN-02), you MUST set isValid: false.
   - Do NOT assume a code exists just because it follows a sequence.
   - If it is not in the official Ministry of Road Transport & Highways (Parivahan) database or standard RTO lists, valid is FALSE.
   - **Fix Action**: If the code does not exist, check the "status". If it's invalid, mark isValid=false. If it's "not-in-use", verify that.

2. **LOCATION MATCH**: Does ${rto.code} belong to "${rto.region}" / "${rto.city}"?
   - Step 1: ${useSearch ? 'Search for "' + rto.code + ' RTO" and find ' : 'Ask yourself - '}"What city does RTO code ${rto.code} serve according to official Indian transport records?"
   - Step 2: Compare your answer to the city/region in the JSON data.
   - Step 3: If they DO NOT match, this is a MAJOR ERROR. Set isValid: false immediately.

3. **HIERARCHY OF VALIDATION (Avoid Cascading Errors)**:
   - If Step 2 failed (City is wrong), DO NOT validate Pin Code, Phone, or Address against the *wrong* city listed in the JSON.
   - Instead, validate them against the **TRUE** city you found in Step 1.
   - If the Pin/Phone/Address match the TRUE city, report them as "Confirming Evidence" that the City name is the only error, NOT as "mismatches".
   - Example: "Pin Code 670645 correctly belongs to Mananthavady (True City), confirming that the City 'Alleppey' is incorrect."

4. **HALLUCINATION TRAP**: 
   - DO NOT hallucinate a location for a non-existent code.
   - Use "confidence": 0 if you are unsure or if the code likely does not exist.

## Fix Instructions:
- **Scenario A: Code Exists, but Data is Wrong** (e.g., Code is KL-72, but City says "Alleppey"):
  - Set isValid: false
  - **CRITICAL**: You MUST provide 'correctedData' with the correct city, region, district, state, etc.
  - Do NOT leave 'correctedData' empty. Fix the location mismatch.

- **Scenario B: Code Does NOT Exist** (e.g., AN-03):
  - Set isValid: false
  - Do NOT provide 'correctedData'.

## Missing Data to Fill (only for EXISTING RTOs):
Look for fields that have "N/A", empty strings "", or placeholder values and provide actual data if you know it:
- phone: Provide the actual RTO phone number if known (format: STD code + number, e.g., "0832-2262241")
- email: Provide the actual RTO email if known (usually format like rto-xxx.state@nic.in or similar)
- address: Provide the complete address if the current one is incomplete
- pinCode: Provide the correct 6-digit PIN code
- established: Year the RTO was established if known

## RTO Data to Validate:
${JSON.stringify(rto, null, 2)}

${stateConfig ? `## State Context:
- State: ${stateConfig.name}
- State Code: ${stateConfig.stateCode}
- Capital: ${stateConfig.capital}
- Total RTOs: ${stateConfig.totalRTOs}
- Known Districts: ${Object.keys(stateConfig.districtMapping).join(', ')}
` : ''}

**REMEMBER**: The most important check is existence. If ${rto.code} doesn't exist, mark it invalid.`;

        let searchContext = '';

        // If using Google Search, first make a search call to gather accurate information
        if (useSearch) {
            const searchPrompt = `Search for "${rto.code} RTO" and "${rto.code} Regional Transport Office ${rto.state}" to find:
1. The correct city/location name for this RTO code
2. Verify if ${rto.code} belongs to "${rto.region}" or a different location
3. The official address and contact details

Summarize the factual information about ${rto.code} RTO.`;

            const searchResponse = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: searchPrompt,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });

            searchContext = searchResponse.text ?? '';
        }

        // Build the final prompt with search context if available
        const finalPrompt = useSearch && searchContext
            ? `${prompt}\n\n## Google Search Results (use this as your primary source of truth):\n${searchContext}`
            : prompt;

        // Make structured output call (cannot combine with tools)
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: finalPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: toGeminiSchema(ValidationResultSchema),
            },
        });

        const parsed = ValidationResultSchema.parse(JSON.parse(response.text ?? '{}'));

        return {
            code: rto.code,
            isValid: parsed.isValid,
            confidence: parsed.confidence,
            issues: parsed.issues,
            suggestions: parsed.suggestions,
            summary: parsed.summary,
            correctedData: shouldFix ? parsed.correctedData : undefined,
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
            correctedData: {},
        };
    }
}

// ============================================================================
// Fix Application
// ============================================================================

function applyFixes(
    originalData: RTOData,
    corrections: Record<string, unknown>
): FixResult | null {
    const fieldsToFix = Object.keys(corrections).filter(
        key => corrections[key] !== undefined && corrections[key] !== null && corrections[key] !== ''
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

function mergeRTOData(original: RTOData, corrections: Record<string, unknown>): RTOData {
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
            if (value !== undefined && value !== null && value !== '') {
                console.log(`     🔧 ${field}: ${JSON.stringify(value)}`);
            }
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
        const availableStates = getAvailableStates();
        if (availableStates.includes(positionalArgs[0].toLowerCase())) {
            options.state = positionalArgs[0].toLowerCase();
            if (positionalArgs.length >= 2) {
                options.specificCode = positionalArgs[1].toUpperCase();
            }
        } else {
            const codeMatch = positionalArgs[0].match(/^([a-z]{2})-(\d+)$/i);
            if (codeMatch) {
                const stateCode = codeMatch[1].toLowerCase();
                const stateCodeToFolder: Record<string, string> = {
                    'ka': 'karnataka',
                    'ga': 'goa',
                    'kl': 'kerala',
                    'tn': 'tamil-nadu',
                    'mh': 'maharashtra',
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
🔍 RTO Data Validation & Fix Script (using @google/genai + Zod)

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
    console.log('🔍 RTO Data Validation & Fix Script (using @google/genai + Zod)');
    console.log('='.repeat(60));

    const options = parseArgs();

    if (!options.validateAll && !options.state) {
        printHelp();
        process.exit(0);
    }

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

            if (options.fix && result.correctedData && Object.keys(result.correctedData).length > 0) {
                const fixResult = applyFixes(rto, result.correctedData);

                if (fixResult) {
                    fixes.push(fixResult);

                    if (options.dryRun) {
                        console.log(`\n   🔍 [DRY RUN] Would apply these fixes:`);
                        printFixResult(fixResult);
                    } else {
                        const mergedData = mergeRTOData(rto, result.correctedData);
                        saveRTOData(state, rto.code, mergedData);

                        console.log(`\n   ✅ Applied and saved fixes:`);
                        printFixResult(fixResult);
                        totalFixed++;
                    }
                }
            }

            if (result.isValid) {
                totalValid++;
            } else {
                totalInvalid++;
            }
            totalValidated++;

            await sleep(API_DELAY_MS);
        }

        if (options.saveResults && results.length > 0) {
            saveValidationResults(results, state);
        }

        if (fixes.length > 0) {
            console.log(`\n  📊 ${state.toUpperCase()} Fix Summary:`);
            console.log(`     RTOs fixed: ${fixes.length}`);
            console.log(`     Total fields updated: ${fixes.reduce((sum, f) => sum + f.fieldsUpdated.length, 0)}`);
        }
    }

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

    if (totalFixed > 0 && !options.dryRun) {
        console.log(`\n💡 Don't forget to regenerate the index files:`);
        console.log(`   bun scripts/generate-index.ts`);
    }
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
