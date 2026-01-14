#!/usr/bin/env bun
/**
 * RTO Data Validation Script
 * 
 * Uses Google Gemini to validate RTO JSON data for accuracy.
 * Checks city names, district mappings, jurisdiction areas, and general correctness.
 * 
 * Usage: 
 *   bun run scripts/validate-rto-data.ts [state] [code]
 *   bun run scripts/validate-rto-data.ts karnataka
 *   bun run scripts/validate-rto-data.ts goa ga-07
 *   bun run scripts/validate-rto-data.ts --all
 * 
 * Environment variables required:
 * - GEMINI_API_KEY
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Validate environment variables
if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is not set');
    console.error('   Set it with: export GEMINI_API_KEY=your-api-key');
    process.exit(1);
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

interface RTOData {
    code: string;
    region: string;
    city: string;
    state: string;
    stateCode: string;
    district: string;
    division: string;
    description: string;
    status?: string;
    established?: string;
    address?: string;
    pinCode?: string;
    phone?: string;
    email?: string;
    jurisdictionAreas?: string[];
    note?: string;
}

interface ValidationResult {
    code: string;
    isValid: boolean;
    confidence: number;
    issues: string[];
    suggestions: string[];
    summary: string;
}

interface StateConfig {
    stateCode: string;
    name: string;
    capital: string;
    totalRTOs: number;
    districtMapping: Record<string, string>;
}

/**
 * Get all available states from the data directory
 */
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

/**
 * Load state configuration
 */
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

/**
 * Load RTO data for a specific state
 */
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

/**
 * Load a single RTO JSON file
 */
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

/**
 * Validate RTO data using Gemini
 */
async function validateWithGemini(rto: RTOData, stateConfig: StateConfig | null): Promise<ValidationResult> {
    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-3-flash-preview',
        });

        const prompt = `You are an expert on Indian Regional Transport Offices (RTOs) and vehicle registration systems. 
    
Please validate the following RTO data for accuracy and completeness. Check:
1. Is the city/region name correct for this RTO code?
2. Is the district assignment correct?
3. Are the jurisdiction areas reasonable and correctly spelled?
4. Is the description accurate?
5. Are there any obvious errors or inconsistencies?

RTO Data to validate:
${JSON.stringify(rto, null, 2)}

${stateConfig ? `State Context:
- State: ${stateConfig.name}
- State Code: ${stateConfig.stateCode}
- Capital: ${stateConfig.capital}
- Total RTOs: ${stateConfig.totalRTOs}
` : ''}

Respond in JSON format with this exact structure:
{
  "isValid": true/false,
  "confidence": 0-100,
  "issues": ["list of specific issues found"],
  "suggestions": ["list of specific corrections or improvements"],
  "summary": "Brief overall assessment"
}

Be specific and factual. Only flag actual errors based on your knowledge of Indian geography and RTO systems.`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Extract JSON from response (handle markdown code blocks)
        let jsonStr = response;
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        }

        const parsed = JSON.parse(jsonStr);

        return {
            code: rto.code,
            isValid: parsed.isValid ?? true,
            confidence: parsed.confidence ?? 0,
            issues: parsed.issues ?? [],
            suggestions: parsed.suggestions ?? [],
            summary: parsed.summary ?? 'No summary provided',
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

/**
 * Print validation result
 */
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

/**
 * Save validation results to a file
 */
function saveResults(results: ValidationResult[], state: string, reportFormat: boolean = false): void {
    const filename = reportFormat ? 'validation-report.json' : 'validation-results.json';
    const outputPath = path.join(process.cwd(), 'data', state, filename);

    const output = reportFormat
        ? results // Simple array format for CI
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

/**
 * Main function
 */
async function main() {
    console.log('🔍 RTO Data Validation Script\n');
    console.log('='.repeat(60));

    // Parse arguments
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
  
Options:
  --all           Validate all available states
  --limit=N       Limit number of RTOs to validate per state
  --save          Save detailed results to JSON file
  --save-report   Save simple report format for CI (validation-report.json)
  --skip-notinuse Skip 'not-in-use' RTO codes
`);
        process.exit(0);
    }

    const validateAll = args.includes('--all');
    const saveToFile = args.includes('--save');
    const saveReport = args.includes('--save-report');
    const skipNotInUse = args.includes('--skip-notinuse');
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 0;

    // Get states to validate
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

        // Check for specific code
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

        // Apply filters
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

            const result = await validateWithGemini(rto, stateConfig);
            results.push(result);

            printResult(result);

            if (result.isValid) {
                totalValid++;
            } else {
                totalInvalid++;
            }
            totalValidated++;

            // Rate limiting - wait between API calls
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        if ((saveToFile || saveReport) && results.length > 0) {
            saveResults(results, state, saveReport);
        }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Total validated: ${totalValidated}`);
    console.log(`  ✅ Valid: ${totalValid}`);
    console.log(`  ❌ Invalid: ${totalInvalid}`);
    console.log(`  Success rate: ${totalValidated > 0 ? Math.round((totalValid / totalValidated) * 100) : 0}%`);
    console.log('='.repeat(60));
}

// Run
main().catch(console.error);
