#!/usr/bin/env bun
/**
 * RTO Data Validation Script
 * 
 * Uses Google Gemini with structured output to validate RTO JSON data for accuracy.
 * Checks city names, district mappings, jurisdiction areas, and general correctness.
 * 
 * Usage: 
 *   bun run scripts/validate-rto-data.ts [state] [code]
 *   bun run scripts/validate-rto-data.ts karnataka
 *   bun run scripts/validate-rto-data.ts goa ga-07
 *   bun run scripts/validate-rto-data.ts --all
 *   bun run scripts/validate-rto-data.ts kerala kl-49 --search  # Use Google Search for verification
 * 
 * Environment variables required:
 * - GEMINI_API_KEY
 */

import { GoogleGenAI } from '@google/genai';
import { z, toJSONSchema } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// Helper to convert Zod schema to Gemini-compatible JSON schema
// Removes $schema and additionalProperties fields that Gemini API doesn't accept
function toGeminiSchema(schema: z.ZodType): object {
    const jsonSchema = toJSONSchema(schema) as Record<string, unknown>;
    const { $schema, additionalProperties, ...rest } = jsonSchema;
    return rest;
}

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-3-flash-preview';

// Validate environment variables
if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is not set');
    console.error('   Set it with: export GEMINI_API_KEY=your-api-key');
    process.exit(1);
}

// Initialize Gemini with new SDK
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ============================================================================
// Zod Schemas
// ============================================================================

const RTODataSchema = z.object({
    code: z.string().describe('RTO code like KA-01, KL-49'),
    region: z.string().describe('Region/area name this RTO serves'),
    city: z.string().describe('City name'),
    state: z.string().describe('Full state name'),
    stateCode: z.string().describe('2-letter state code'),
    district: z.string().describe('District name'),
    division: z.string().describe('Transport division name'),
    description: z.string().describe('Description of the RTO'),
    status: z.string().optional().describe('Status: active or not-in-use'),
    established: z.string().optional().describe('Year established or N/A'),
    address: z.string().optional().describe('Physical address'),
    pinCode: z.string().optional().describe('6-digit PIN code'),
    phone: z.string().optional().describe('Contact phone number'),
    email: z.string().optional().describe('Contact email'),
    jurisdictionAreas: z.array(z.string()).optional().describe('Areas under jurisdiction'),
    note: z.string().optional().describe('Additional notes'),
});

const ValidationResultSchema = z.object({
    isValid: z.boolean().describe('Whether the RTO data is valid and accurate'),
    confidence: z.number().min(0).max(100).describe('Confidence percentage 0-100'),
    issues: z.array(z.string()).describe('List of specific issues found - MUST include city mismatch if RTO code belongs to different city'),
    suggestions: z.array(z.string()).describe('List of specific corrections or improvements'),
    summary: z.string().describe('Brief overall assessment - MUST mention if city/region is wrong for this RTO code'),
});

type RTOData = z.infer<typeof RTODataSchema>;
type ValidationResult = z.infer<typeof ValidationResultSchema> & { code: string };

interface StateConfig {
    stateCode: string;
    name: string;
    capital: string;
    totalRTOs: number;
    districtMapping: Record<string, string>;
}

// ============================================================================
// Utility Functions
// ============================================================================

function getAvailableStates(): string[] {
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

function loadStateConfig(state: string): StateConfig | null {
    const configPath = path.join(process.cwd(), 'data', state, 'config.json');

    if (!fs.existsSync(configPath)) {
        return null;
    }

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

// ============================================================================
// Gemini Validation with Structured Output
// ============================================================================

async function validateWithGemini(
    rto: RTOData,
    stateConfig: StateConfig | null,
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
${searchInstruction}
## CRITICAL VALIDATION RULES - READ CAREFULLY:

1. **EXISTENCE CHECK (Most Important)**: Does RTO Code ${rto.code} *actually exist*?
   - Many RTO lists online are incomplete or contain future planned codes.
   - If this RTO code does not exist (e.g., AN-03 for Andaman & Nicobar which stops at AN-02), you MUST set isValid: false.
   - Do NOT assume a code exists just because it follows a sequence.
   - If it is not in the official Ministry of Road Transport & Highways (Parivahan) database or standard RTO lists, valid is FALSE.

2. **LOCATION MATCH**: Does ${rto.code} belong to "${rto.region}" / "${rto.city}"?
   - Step 1: ${useSearch ? 'Search for "' + rto.code + ' RTO" and find ' : 'Determine '} what city RTO code ${rto.code} serves.
   - Step 2: Compare your answer to the city/region in the JSON data.
   - Step 3: If they DO NOT match, this is a MAJOR ERROR. Set isValid: false.

3. **HIERARCHY OF VALIDATION (Avoid Cascading Errors)**:
   - If Step 2 failed (City is wrong), DO NOT validate Pin Code, Phone, or Address against the *wrong* city listed in the JSON.
   - Instead, validate them against the **TRUE** city you found in Step 1.
   - If the Pin/Phone/Address match the TRUE city, report them as "Confirming Evidence" that the City name is the only error, NOT as "mismatches".
   - Example: "Pin Code 670645 correctly belongs to Mananthavady (True City), confirming that the City 'Alleppey' is incorrect."

4. **HALLUCINATION TRAP**: 
   - DO NOT hallucinate a location for a non-existent code.
   - Use "confidence": 0 if you are unsure or if the code likely does not exist.

## Additional Validation Checks:
1. Is the district assignment correct for the **TRUE** city/region?
2. Are the jurisdiction areas reasonable and correctly spelled?
3. Is the description accurate?
4. Are there any obvious errors or inconsistencies?

RTO Data to validate:
${JSON.stringify(rto, null, 2)}

${stateConfig ? `State Context:
- State: ${stateConfig.name}
- State Code: ${stateConfig.stateCode}
- Capital: ${stateConfig.capital}
- Total RTOs: ${stateConfig.totalRTOs}
` : ''}

**REMEMBER**: The most important check is existence. ${rto.code} might not exist at all. If it doesn't, isValid MUST be false.`;

        let searchContext = '';

        // If using Google Search, first make a search call to gather accurate information
        if (useSearch) {
            const searchPrompt = `Search for "${rto.code} RTO" and "${rto.code} Regional Transport Office ${rto.state}" to find:
1. The correct city/location name for this RTO code
2. Verify if ${rto.code} belongs to "${rto.region}" or a different location

Summarize the factual information about ${rto.code} RTO location.`;

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
            ...parsed,
        };
    } catch (error) {
        console.error(`  ❌ Error validating ${rto.code}:`, error);
        return {
            code: rto.code,
            isValid: false,
            confidence: 0,
            issues: ['Failed to validate with Gemini'],
            suggestions: ['Retry validation'],
            summary: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

// ============================================================================
// Display Functions
// ============================================================================

function printResult(result: ValidationResult): void {
    const statusIcon = result.isValid ? '✅' : '❌';
    const confidenceBar = '█'.repeat(Math.floor(result.confidence / 10)) +
        '░'.repeat(10 - Math.floor(result.confidence / 10));

    console.log(`\n${statusIcon} ${result.code}`);
    console.log(`   Confidence: [${confidenceBar}] ${result.confidence}%`);
    console.log(`   Summary: ${result.summary}`);

    if (result.issues.length > 0) {
        console.log(`   Issues:`);
        for (const issue of result.issues) {
            console.log(`     ⚠️  ${issue}`);
        }
    }

    if (result.suggestions.length > 0) {
        console.log(`   Suggestions:`);
        for (const suggestion of result.suggestions) {
            console.log(`     💡 ${suggestion}`);
        }
    }
}

function saveResults(results: ValidationResult[], state: string, reportFormat: boolean = false): void {
    const filename = reportFormat ? 'validation-report.json' : 'validation-results.json';
    const outputPath = path.join(process.cwd(), 'data', state, filename);

    const output = reportFormat
        ? results
        : {
            state,
            timestamp: new Date().toISOString(),
            totalValidated: results.length,
            validCount: results.filter(r => r.isValid).length,
            invalidCount: results.filter(r => !r.isValid).length,
            averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
            results,
        };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
    console.log(`\n📝 Results saved to: ${outputPath}`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    console.log('🔍 RTO Data Validation Script (using @google/genai + Zod)\n');
    console.log('='.repeat(60));

    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
Usage:
  bun run scripts/validate-rto-data.ts [state] [code]
  bun run scripts/validate-rto-data.ts --all
  
Examples:
  bun run scripts/validate-rto-data.ts karnataka          # Validate all Karnataka RTOs
  bun run scripts/validate-rto-data.ts goa ga-07          # Validate specific RTO
  bun run scripts/validate-rto-data.ts --all              # Validate all states
  bun run scripts/validate-rto-data.ts kerala kl-49 --search  # Use Google Search for verification
  
Options:
  --all           Validate all available states
  --limit=N       Limit number of RTOs to validate per state
  --save          Save detailed results to JSON file
  --save-report   Save simple report format for CI (validation-report.json)
  --skip-notinuse Skip 'not-in-use' RTO codes
  --search        Use Google Search grounding for better accuracy (recommended)
`);
        process.exit(0);
    }

    const validateAll = args.includes('--all');
    const saveToFile = args.includes('--save');
    const saveReport = args.includes('--save-report');
    const skipNotInUse = args.includes('--skip-notinuse');
    const useSearch = args.includes('--search');
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 0;

    let states: string[];
    let specificCode: string | null = null;

    if (validateAll) {
        states = getAvailableStates();
    } else {
        const state = args.find(arg => !arg.startsWith('--'));
        if (!state) {
            console.error('❌ Please specify a state or use --all');
            process.exit(1);
        }
        states = [state.toLowerCase()];

        const codeArg = args.find((arg, i) => !arg.startsWith('--') && i > 0);
        if (codeArg && !args.some(a => a.toLowerCase() === codeArg.toLowerCase() && getAvailableStates().includes(a.toLowerCase()))) {
            specificCode = codeArg.toUpperCase();
        }
    }

    console.log(`States to validate: ${states.join(', ')}`);
    if (specificCode) {
        console.log(`Specific code: ${specificCode}`);
    }
    if (limit > 0) {
        console.log(`Limit: ${limit} RTOs per state`);
    }
    if (useSearch) {
        console.log(`Search: 🔍 Google Search grounding enabled`);
    }
    console.log('='.repeat(60));

    let totalValidated = 0;
    let totalValid = 0;
    let totalInvalid = 0;

    for (const state of states) {
        console.log(`\n📍 Validating ${state.toUpperCase()}`);
        console.log('-'.repeat(40));

        const stateConfig = loadStateConfig(state);
        if (!stateConfig) {
            console.log(`  ⚠️ No config found for ${state}, skipping`);
            continue;
        }

        let rtosToValidate: RTOData[];

        if (specificCode) {
            const rto = loadSingleRTO(state, specificCode);
            if (!rto) {
                console.log(`  ❌ RTO ${specificCode} not found in ${state}`);
                continue;
            }
            rtosToValidate = [rto];
        } else {
            rtosToValidate = loadRTOData(state);
        }

        if (skipNotInUse) {
            rtosToValidate = rtosToValidate.filter(rto => rto.status !== 'not-in-use');
        }

        if (limit > 0) {
            rtosToValidate = rtosToValidate.slice(0, limit);
        }

        console.log(`  Found ${rtosToValidate.length} RTOs to validate`);

        const results: ValidationResult[] = [];

        for (const rto of rtosToValidate) {
            console.log(`\n  🔄 Validating ${rto.code}...`);

            const result = await validateWithGemini(rto, stateConfig, useSearch);
            results.push(result);

            printResult(result);

            if (result.isValid) {
                totalValid++;
            } else {
                totalInvalid++;
            }
            totalValidated++;

            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        if ((saveToFile || saveReport) && results.length > 0) {
            saveResults(results, state, saveReport);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Total validated: ${totalValidated}`);
    console.log(`  ✅ Valid: ${totalValid}`);
    console.log(`  ❌ Invalid: ${totalInvalid}`);
    console.log(`  Success rate: ${totalValidated > 0 ? Math.round((totalValid / totalValidated) * 100) : 0}%`);
    console.log('='.repeat(60));
}

main().catch(console.error);
