#!/usr/bin/env bun
/**
 * RTO Data Population Script
 * 
 * Fetches RTO data from Wikipedia and uses Gemini to enrich, validate, and create
 * complete JSON files for RTOs. This combines data fetching + validation + fixing
 * in a single workflow.
 * 
 * Data Flow:
 *   1. Fetch state RTO table from Wikipedia
 *   2. Parse the table for basic code/location data
 *   3. Use Gemini to enrich with district, jurisdiction, description, etc.
 *   4. Validate the enriched data
 *   5. Save complete JSON files
 * 
 * Usage:
 *   bun scripts/populate-rto-data.ts <state-code> [options]
 *   bun scripts/populate-rto-data.ts <state-code> <start> <end> [options]
 * 
 * Examples:
 *   bun scripts/populate-rto-data.ts ga                    # All Goa RTOs
 *   bun scripts/populate-rto-data.ts ka 1 10               # Karnataka RTOs 1-10
 *   bun scripts/populate-rto-data.ts ga --dry-run          # Preview without saving
 *   bun scripts/populate-rto-data.ts ka 55 --verbose       # Single RTO with details
 *   bun scripts/populate-rto-data.ts tn --skip-existing    # Skip already populated files
 * 
 * Options:
 *   --dry-run          Preview without writing files
 *   --skip-existing    Skip RTOs that already have JSON files
 *   --verbose, -v      Show detailed output
 *   --force            Overwrite existing files
 *   --help, -h         Show help
 * 
 * Environment Variables:
 *   GEMINI_API_KEY     Your Google Gemini API key (required)
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

// Wikipedia API endpoint
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

// ============================================================================
// State Configurations
// ============================================================================

interface StateInfo {
    name: string;
    code: string;
    folder: string;
    capital: string;
    wikipediaTitle: string;
    totalRTOs: number;
    districts: string[];
}

const STATE_CONFIG: Record<string, StateInfo> = {
    'ka': {
        name: 'Karnataka',
        code: 'KA',
        folder: 'karnataka',
        capital: 'Bengaluru',
        wikipediaTitle: 'List of RTOs in Karnataka',
        totalRTOs: 71,
        districts: [
            'Bagalkot', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban',
            'Bidar', 'Chamarajanagar', 'Chikkaballapura', 'Chikkamagaluru', 'Chitradurga',
            'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri',
            'Kalaburagi', 'Kodagu', 'Kolar', 'Koppal', 'Mandya', 'Mysuru', 'Raichur',
            'Ramanagara', 'Shivamogga', 'Tumakuru', 'Udupi', 'Uttara Kannada',
            'Vijayanagara', 'Vijayapura', 'Yadgir'
        ]
    },
    'ga': {
        name: 'Goa',
        code: 'GA',
        folder: 'goa',
        capital: 'Panaji',
        wikipediaTitle: 'List of RTOs in Goa',
        totalRTOs: 12,
        districts: ['North Goa', 'South Goa']
    },
    'tn': {
        name: 'Tamil Nadu',
        code: 'TN',
        folder: 'tamil-nadu',
        capital: 'Chennai',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 143,
        districts: [
            'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore',
            'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram',
            'Kanyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai',
            'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai',
            'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi',
            'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli',
            'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur',
            'Vellore', 'Viluppuram', 'Virudhunagar'
        ]
    },
    'mh': {
        name: 'Maharashtra',
        code: 'MH',
        folder: 'maharashtra',
        capital: 'Mumbai',
        wikipediaTitle: 'List of RTOs in Maharashtra',
        totalRTOs: 53,
        districts: [
            'Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Beed', 'Bhandara',
            'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli',
            'Jalgaon', 'Jalna', 'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban',
            'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani',
            'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur',
            'Thane', 'Wardha', 'Washim', 'Yavatmal'
        ]
    },
    'ap': {
        name: 'Andhra Pradesh',
        code: 'AP',
        folder: 'andhra-pradesh',
        capital: 'Amaravati',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 40,
        districts: [
            'Anantapur', 'Chittoor', 'East Godavari', 'Guntur', 'Krishna', 'Kurnool',
            'Nellore', 'Prakasam', 'Srikakulam', 'Visakhapatnam', 'Vizianagaram',
            'West Godavari', 'YSR Kadapa'
        ]
    },
    'ts': {
        name: 'Telangana',
        code: 'TS',
        folder: 'telangana',
        capital: 'Hyderabad',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 38,
        districts: [
            'Adilabad', 'Hyderabad', 'Karimnagar', 'Khammam', 'Mahabubnagar',
            'Medak', 'Nalgonda', 'Nizamabad', 'Rangareddy', 'Warangal'
        ]
    },
    'kl': {
        name: 'Kerala',
        code: 'KL',
        folder: 'kerala',
        capital: 'Thiruvananthapuram',
        wikipediaTitle: 'List of RTOs in Kerala',
        totalRTOs: 87,
        districts: [
            'Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod', 'Kollam',
            'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta',
            'Thiruvananthapuram', 'Thrissur', 'Wayanad'
        ]
    },
    'dl': {
        name: 'Delhi',
        code: 'DL',
        folder: 'delhi',
        capital: 'New Delhi',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 16,
        districts: [
            'Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi',
            'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi',
            'South West Delhi', 'West Delhi'
        ]
    },
    'gj': {
        name: 'Gujarat',
        code: 'GJ',
        folder: 'gujarat',
        capital: 'Gandhinagar',
        wikipediaTitle: 'List of RTOs in Gujarat',
        totalRTOs: 37,
        districts: [
            'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch',
            'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka',
            'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch',
            'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal',
            'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar',
            'Tapi', 'Vadodara', 'Valsad'
        ]
    }
};

// Mapping from folder names to state codes for lookup
const FOLDER_TO_STATE_CODE: Record<string, string> = {};
for (const [stateCode, info] of Object.entries(STATE_CONFIG)) {
    FOLDER_TO_STATE_CODE[info.folder] = stateCode;
}

/**
 * Resolves a state identifier (code or folder name) to the actual state code.
 * Accepts: 'ka', 'karnataka', 'kl', 'kerala', etc.
 */
function resolveStateCode(input: string): string | null {
    const normalized = input.toLowerCase().trim();

    // First, check if it's a direct state code
    if (STATE_CONFIG[normalized]) {
        return normalized;
    }

    // Then, check if it's a folder name
    if (FOLDER_TO_STATE_CODE[normalized]) {
        return FOLDER_TO_STATE_CODE[normalized];
    }

    return null;
}

// ============================================================================
// Types
// ============================================================================

interface RTOData {
    code: string;
    region: string;
    city: string;
    state: string;
    stateCode: string;
    district: string;
    division: string;
    description: string;
    status?: 'not-in-use' | 'active';
    established: string;
    address: string;
    pinCode: string;
    phone: string;
    email: string;
    jurisdictionAreas: string[];
}

interface WikipediaRTO {
    code: string;
    location: string;
    rawText: string;
}

interface PopulateResult {
    code: string;
    success: boolean;
    data?: RTOData;
    error?: string;
    source: 'wikipedia' | 'gemini' | 'cached';
}

interface CLIOptions {
    dryRun: boolean;
    skipExisting: boolean;
    verbose: boolean;
    force: boolean;
    stateCode: string;
    start: number;
    end: number;
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

function formatCode(stateCode: string, num: number): string {
    return `${stateCode.toUpperCase()}-${num.toString().padStart(2, '0')}`;
}

function rtoFileExists(stateFolder: string, code: string): boolean {
    const filePath = path.join(process.cwd(), 'data', stateFolder, `${code.toLowerCase()}.json`);
    return fs.existsSync(filePath);
}

function readExistingRTOData(stateFolder: string, code: string): RTOData | null {
    const filePath = path.join(process.cwd(), 'data', stateFolder, `${code.toLowerCase()}.json`);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as RTOData;
    } catch {
        return null;
    }
}

function ensureDirectoryExists(stateFolder: string): void {
    const dirPath = path.join(process.cwd(), 'data', stateFolder);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function saveRTOFile(stateFolder: string, data: RTOData): void {
    const filePath = path.join(process.cwd(), 'data', stateFolder, `${data.code.toLowerCase()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4) + '\n', 'utf-8');
}

// ============================================================================
// Wikipedia Fetching
// ============================================================================

async function fetchWikipediaRTOSection(stateCode: string): Promise<string> {
    // Try the main RTO list page first
    const mainPage = 'List of Regional Transport Office districts in India';

    const params = new URLSearchParams({
        action: 'parse',
        page: mainPage,
        format: 'json',
        prop: 'text',
        redirects: '1',
    });

    const response = await fetch(`${WIKIPEDIA_API}?${params}`);
    if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status}`);
    }

    const data = await response.json() as { parse?: { text?: { '*'?: string } }; error?: { info: string } };

    if (data.error) {
        throw new Error(`Wikipedia error: ${data.error.info}`);
    }

    return data.parse?.text?.['*'] || '';
}

function parseRTOTableFromWikipedia(html: string, stateCode: string, stateName: string): WikipediaRTO[] {
    const rtos: WikipediaRTO[] = [];
    const codeUpper = stateCode.toUpperCase();

    // Multiple pattern approaches to capture RTO codes from Wikipedia HTML tables
    const patterns = [
        // Pattern 1: Simple table cell with GA-01 format
        new RegExp(`${codeUpper}[\\s\\-]*(\\d{1,2})`, 'gi'),
    ];

    // Also try to extract from text content directly
    // Look for patterns like "GA-01 | Panaji" or "|GA-07|Panaji|"
    const lines = html.split(/[\n\r]+/);

    for (const line of lines) {
        // Match RTO code pattern anywhere in the line
        const codeMatch = line.match(new RegExp(`${codeUpper}[\\s\\-]*(\\d{1,2})`, 'i'));
        if (!codeMatch) continue;

        const num = parseInt(codeMatch[1], 10);
        if (isNaN(num) || num < 1 || num > 200) continue;

        const code = formatCode(stateCode, num);

        // Skip if we already have this code
        if (rtos.find(r => r.code === code)) continue;

        // Try to extract location from the same line
        // Remove HTML tags and the code itself, then take the first meaningful text
        let cleanedLine = line
            .replace(/<[^>]+>/g, ' ')  // Remove HTML tags
            .replace(/&nbsp;/g, ' ')
            .replace(/&#160;/g, ' ')
            .replace(/\|/g, ' ')
            .replace(/\[[^\]]*\]/g, '') // Remove citation brackets
            .replace(new RegExp(`${codeUpper}[\\s\\-]*\\d{1,2}`, 'gi'), '')
            .trim();

        // Split by common delimiters and find a reasonable location name
        const parts = cleanedLine.split(/\s{2,}/).filter(p => p.trim().length > 2);
        let location = parts.length > 0 ? parts[0].trim() : '';

        // Clean up location
        location = location
            .replace(/^\d+\s*/, '') // Remove leading numbers
            .replace(/\s+/g, ' ')
            .trim();

        // Skip if location looks like a number or is too short
        if (!location || location.match(/^\d+$/) || location.length < 2) {
            location = '';
        }

        rtos.push({
            code,
            location,
            rawText: line
        });
    }

    // Sort by code number
    rtos.sort((a, b) => {
        const numA = parseInt(a.code.split('-')[1], 10);
        const numB = parseInt(b.code.split('-')[1], 10);
        return numA - numB;
    });

    // Remove duplicates, keeping the one with a location
    const uniqueRTOs = new Map<string, WikipediaRTO>();
    for (const rto of rtos) {
        const existing = uniqueRTOs.get(rto.code);
        if (!existing || (rto.location && !existing.location)) {
            uniqueRTOs.set(rto.code, rto);
        }
    }

    return Array.from(uniqueRTOs.values());
}

// ============================================================================
// Gemini Enrichment
// ============================================================================

async function enrichRTOWithGemini(
    code: string,
    locationHint: string,
    stateInfo: StateInfo,
    existingData?: RTOData | null
): Promise<RTOData> {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // Build the prompt based on whether we have existing data
    let prompt: string;

    if (existingData) {
        // We have existing data - ask Gemini to validate and enhance only
        prompt = `You are an expert on Indian Regional Transport Offices (RTOs) and vehicle registration systems.

I have EXISTING DATA for the RTO ${code} that has been previously validated. Your task is to:
1. KEEP all the accurate information from the existing data (especially region, city, district, jurisdictionAreas)
2. ONLY correct obvious errors if you find any
3. **FILL IN any missing or placeholder fields** - look for "N/A", empty strings "", or generic values
4. Enhance the description if it's too generic

## IMPORTANT: Trust the existing data as ground truth unless it's clearly wrong!

## Existing Data (treat as ground truth):
${JSON.stringify(existingData, null, 2)}

## Fields to Fill if Missing (currently "N/A" or empty):
- phone: Provide actual RTO phone number if you know it (format: STD-number, e.g., "0832-2262241")
- email: Provide actual RTO email if you know it (usually rto-xxx.state@nic.in or dyrto-xxx.state@nic.in)
- address: Provide complete address if current one is incomplete
- established: Year established if known
- pinCode: Correct 6-digit PIN code

## Additional Context:
- Wikipedia Location Hint: ${locationHint || 'Not available'}
- State: ${stateInfo.name} (${stateInfo.code})
- State Capital: ${stateInfo.capital}
- Available Districts: ${stateInfo.districts.join(', ')}

## Your Task:
1. Keep all existing accurate data (region, city, district, jurisdictionAreas are likely correct)
2. **Replace "N/A" values with actual data if you know it** - especially phone and email
3. Improve the description if it's too generic or placeholder-like
4. Validate the district is one of the available districts for this state

## Response Format:
Respond ONLY with a valid JSON object (no markdown, no explanation).
The JSON must include ALL fields with the corrected/enhanced values:

{
    "code": "${code}",
    "region": "...",
    "city": "...",
    "state": "${stateInfo.name}",
    "stateCode": "${stateInfo.code}",
    "district": "...",
    "division": "...",
    "description": "...",
    "status": "active",
    "established": "...",
    "address": "...",
    "pinCode": "...",
    "phone": "...",
    "email": "...",
    "jurisdictionAreas": ["area1", "area2", "..."]
}`;
    } else {
        // No existing data - generate from scratch with Wikipedia hint
        prompt = `You are an expert on Indian Regional Transport Offices (RTOs) and vehicle registration systems.

Generate complete and accurate data for the following RTO:

## RTO Information:
- Code: ${code}
- State: ${stateInfo.name} (${stateInfo.code})
- Wikipedia Location: ${locationHint || 'Unknown - please determine based on RTO code patterns'}
- State Capital: ${stateInfo.capital}
- Available Districts: ${stateInfo.districts.join(', ')}

## Task:
Create a complete JSON object for this RTO with accurate information based on your knowledge of Indian RTOs, geography, and the ${stateInfo.name} state administrative divisions.

## IMPORTANT:
- The Wikipedia location "${locationHint}" is the most reliable source - use it as the primary city/region name
- If Wikipedia says "${locationHint}", that should be the city name

## Required Fields:
1. code: The RTO code (e.g., "${code}")
2. region: The region/city name this RTO serves (from Wikipedia: "${locationHint}")
3. city: The main city name (from Wikipedia: "${locationHint}")
4. state: Full state name (e.g., "${stateInfo.name}")
5. stateCode: State code (e.g., "${stateInfo.code}")
6. district: The district this RTO belongs to (must be one of the available districts)
7. division: The transport division (e.g., "North Goa Division", "Bengaluru Urban Division")
8. description: A 2-3 sentence description of this RTO, its coverage area, and significance
9. status: "active" or "not-in-use" (if the code is reserved but not operational)
10. established: Year established if known, otherwise "N/A"
11. address: Full address of the RTO office (best known address)
12. pinCode: PIN code of the RTO location (6 digits, or empty string if unknown)
13. phone: Phone number if known, otherwise "N/A"
14. email: Email if known, otherwise "N/A"
15. jurisdictionAreas: Array of talukas, mandals, or areas under this RTO's jurisdiction

## Important Guidelines:
- Be factually accurate based on your knowledge
- The Wikipedia location "${locationHint}" is the authoritative source for the city name
- If this is a well-known RTO (like state capital), provide detailed information
- If unsure about specific details, use reasonable defaults but mark status as needed
- For jurisdiction areas, list the actual talukas/mandals/areas covered
- The description should mention the RTO type (RTO/ARTO) and what it handles
- If the code appears to be not in use or reserved, set status to "not-in-use"

## Response Format:
Respond ONLY with a valid JSON object (no markdown, no explanation):
{
    "code": "${code}",
    "region": "...",
    "city": "...",
    "state": "${stateInfo.name}",
    "stateCode": "${stateInfo.code}",
    "district": "...",
    "division": "...",
    "description": "...",
    "status": "active",
    "established": "...",
    "address": "...",
    "pinCode": "...",
    "phone": "...",
    "email": "...",
    "jurisdictionAreas": ["area1", "area2", "..."]
}`;
    }

    try {
        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Extract JSON from response
        let jsonStr = response.trim();

        // Remove markdown code blocks if present
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }

        const parsed = JSON.parse(jsonStr) as RTOData;

        // Validate required fields
        if (!parsed.code || !parsed.region || !parsed.state) {
            throw new Error('Missing required fields in Gemini response');
        }

        // Ensure code matches
        parsed.code = code;
        parsed.state = stateInfo.name;
        parsed.stateCode = stateInfo.code;

        // Clean up and validate
        return {
            code: parsed.code,
            region: parsed.region || locationHint || 'Unknown',
            city: parsed.city || parsed.region || locationHint || 'Unknown',
            state: stateInfo.name,
            stateCode: stateInfo.code,
            district: parsed.district || '',
            division: parsed.division || '',
            description: parsed.description || `The ${code} Regional Transport Office handles vehicle registrations and transport services for this region in ${stateInfo.name}.`,
            status: parsed.status,
            established: parsed.established || 'N/A',
            address: parsed.address || `RTO Office, ${parsed.city || locationHint}, ${stateInfo.name}`,
            pinCode: (parsed.pinCode && /^\d{6}$/.test(parsed.pinCode)) ? parsed.pinCode : '',
            phone: parsed.phone || 'N/A',
            email: parsed.email || 'N/A',
            jurisdictionAreas: Array.isArray(parsed.jurisdictionAreas) ? parsed.jurisdictionAreas : [],
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Gemini enrichment failed: ${errorMsg}`);
    }
}

// ============================================================================
// Main Population Logic
// ============================================================================

async function populateRTO(
    code: string,
    locationHint: string,
    stateInfo: StateInfo,
    options: CLIOptions
): Promise<PopulateResult> {
    try {
        // Check for existing data
        const existingData = readExistingRTOData(stateInfo.folder, code);

        // If file exists and we're not forcing, maybe skip
        if (existingData && !options.force) {
            if (options.skipExisting) {
                return { code, success: true, source: 'cached', error: 'Skipped (already exists)' };
            }
        }

        // Enrich with Gemini (passing existing data if available)
        const data = await enrichRTOWithGemini(code, locationHint, stateInfo, existingData);

        // Save if not dry run
        if (!options.dryRun) {
            ensureDirectoryExists(stateInfo.folder);
            saveRTOFile(stateInfo.folder, data);
        }

        return { code, success: true, data, source: existingData ? 'gemini' : 'gemini' };
    } catch (error) {
        return {
            code,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            source: 'gemini'
        };
    }
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(): CLIOptions {
    const args = process.argv.slice(2);

    const options: CLIOptions = {
        dryRun: args.includes('--dry-run'),
        skipExisting: args.includes('--skip-existing'),
        verbose: args.includes('--verbose') || args.includes('-v'),
        force: args.includes('--force'),
        stateCode: '',
        start: 1,
        end: 0,
    };

    // Filter out flags
    const positionalArgs = args.filter(arg => !arg.startsWith('-'));

    if (positionalArgs.length >= 1) {
        options.stateCode = positionalArgs[0].toLowerCase();
    }

    if (positionalArgs.length >= 2) {
        const secondArg = positionalArgs[1];

        // Check if it's an RTO code format (e.g., "GA-07", "KA-55")
        const rtoCodeMatch = secondArg.match(/^([A-Za-z]{2})-(\d{1,3})$/i);
        if (rtoCodeMatch) {
            // Extract the numeric part from the RTO code
            options.start = parseInt(rtoCodeMatch[2], 10);
            options.end = options.start;
        } else {
            // It's a plain number
            options.start = parseInt(secondArg, 10) || 1;
        }
    }

    if (positionalArgs.length >= 3) {
        const thirdArg = positionalArgs[2];

        // Check if it's an RTO code format
        const rtoCodeMatch = thirdArg.match(/^([A-Za-z]{2})-(\d{1,3})$/i);
        if (rtoCodeMatch) {
            options.end = parseInt(rtoCodeMatch[2], 10);
        } else {
            options.end = parseInt(thirdArg, 10) || options.start;
        }
    } else if (positionalArgs.length === 2) {
        // Single RTO specified
        options.end = options.start;
    }

    return options;
}

function printHelp(): void {
    console.log(`
📦 RTO Data Population Script

Fetches RTO data from Wikipedia and enriches it with Gemini AI to create
complete, accurate JSON files.

Usage:
  bun scripts/populate-rto-data.ts <state> [start] [end] [options]

Arguments:
  state         State code OR folder name (e.g., ka, karnataka, kl, kerala)
  start         Starting RTO number (default: 1)
  end           Ending RTO number (default: all RTOs for the state)

Options:
  --dry-run        Preview without writing files
  --skip-existing  Skip RTOs that already have JSON files
  --force          Overwrite existing files
  --verbose, -v    Show detailed output
  --help, -h       Show this help message

Examples:
  bun scripts/populate-rto-data.ts ga                    # All Goa RTOs (GA-01 to GA-12)
  bun scripts/populate-rto-data.ts kerala 1 10           # Kerala RTOs 1-10 (using folder name)
  bun scripts/populate-rto-data.ts kl 1 10               # Kerala RTOs 1-10 (using state code)
  bun scripts/populate-rto-data.ts ga GA-07              # Single RTO GA-07 (using RTO code)
  bun scripts/populate-rto-data.ts ga 7                  # Single RTO GA-07 (using number)
  bun scripts/populate-rto-data.ts ga --dry-run          # Preview without saving
  bun scripts/populate-rto-data.ts ka 55                 # Single RTO KA-55
  bun scripts/populate-rto-data.ts tamil-nadu --skip-existing    # Only new RTOs

Supported States:
${Object.entries(STATE_CONFIG).map(([code, info]) => `  ${code.toUpperCase().padEnd(4)} | ${info.folder.padEnd(20)} - ${info.name} (${info.totalRTOs} RTOs)`).join('\n')}

Environment Variables:
  GEMINI_API_KEY   Your Google Gemini API key (required)

Data Sources:
  - Wikipedia for location hints and basic data
  - Gemini AI for enrichment, validation, and complete data generation
`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
    const options = parseArgs();

    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        printHelp();
        process.exit(0);
    }

    if (!options.stateCode) {
        printHelp();
        process.exit(1);
    }

    // Resolve state code (accepts both state codes like 'kl' and folder names like 'kerala')
    const resolvedStateCode = resolveStateCode(options.stateCode);
    if (!resolvedStateCode) {
        console.error(`❌ Unknown state code: ${options.stateCode}`);
        console.error(`   Supported state codes: ${Object.keys(STATE_CONFIG).join(', ')}`);
        console.error(`   Supported folder names: ${Object.values(STATE_CONFIG).map(s => s.folder).join(', ')}`);
        process.exit(1);
    }

    const stateInfo = STATE_CONFIG[resolvedStateCode];

    // Update options with resolved state code for use elsewhere
    options.stateCode = resolvedStateCode;

    // Determine range
    if (options.end === 0) {
        options.end = stateInfo.totalRTOs;
    }

    const total = options.end - options.start + 1;

    console.log(`
📦 RTO Data Population Script
${'='.repeat(60)}
State:        ${stateInfo.name} (${stateInfo.code})
Range:        ${formatCode(options.stateCode, options.start)} to ${formatCode(options.stateCode, options.end)}
Total:        ${total} RTO(s)
Mode:         ${options.dryRun ? '🔍 DRY RUN (no files will be written)' : '💾 WRITE MODE'}
Skip Existing: ${options.skipExisting ? 'Yes' : 'No'}
${'='.repeat(60)}
`);

    // Try to fetch Wikipedia data for location hints
    console.log('📖 Fetching Wikipedia data for location hints...');
    let wikipediaRTOs: WikipediaRTO[] = [];

    try {
        const html = await fetchWikipediaRTOSection(options.stateCode);
        wikipediaRTOs = parseRTOTableFromWikipedia(html, options.stateCode, stateInfo.name);
        console.log(`   Found ${wikipediaRTOs.length} RTOs in Wikipedia data\n`);
    } catch (error) {
        console.log(`   ⚠️  Could not fetch Wikipedia data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.log('   Continuing with Gemini-only enrichment...\n');
    }

    // Create a lookup map for Wikipedia data
    const wikiLookup = new Map<string, string>();
    for (const rto of wikipediaRTOs) {
        wikiLookup.set(rto.code, rto.location);
    }

    // Load valid codes from config if available (for non-sequential RTOs)
    const configPath = path.join(process.cwd(), 'data', stateInfo.folder, 'config.json');
    let validCodes: string[] | null = null;

    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (config.validCodes && Array.isArray(config.validCodes) && config.validCodes.length > 0) {
                validCodes = config.validCodes;
                console.log(`📋 Using valid codes list from config (${config.validCodes.length} codes)`);
                console.log(`   Sample codes: ${config.validCodes.slice(0, 5).join(', ')}...\n`);
            }
        } catch (error) {
            console.log(`   ⚠️  Could not load valid codes from config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Determine which codes to process
    let codesToProcess: string[];

    if (validCodes && validCodes.length > 0) {
        // Use valid codes list (handles non-sequential)
        const startIdx = options.start - 1; // Convert to 0-based index
        const endIdx = options.end; // End is inclusive, but slice is exclusive
        codesToProcess = validCodes.slice(startIdx, endIdx);

        if (codesToProcess.length === 0) {
            console.error(`❌ No valid codes found in range ${options.start} to ${options.end}`);
            console.error(`   Total valid codes: ${validCodes.length}`);
            process.exit(1);
        }
    } else {
        // Fallback to sequential generation (legacy behavior)
        console.log(`⚠️  No valid codes list found - using sequential generation`);
        console.log(`   This may create invalid codes if RTO numbering is non-sequential!\n`);
        codesToProcess = [];
        for (let i = options.start; i <= options.end; i++) {
            codesToProcess.push(formatCode(options.stateCode, i));
        }
    }

    console.log(`📝 Processing ${codesToProcess.length} RTO code(s): ${codesToProcess[0]}${codesToProcess.length > 1 ? ` to ${codesToProcess[codesToProcess.length - 1]}` : ''}\n`);


    // Process RTOs
    const results: PopulateResult[] = [];
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const code of codesToProcess) {
        const locationHint = wikiLookup.get(code) || '';

        process.stdout.write(`⏳ ${code}${locationHint ? ` (${locationHint})` : ''} ... `);

        const result = await populateRTO(code, locationHint, stateInfo, options);
        results.push(result);

        if (result.success) {
            if (result.source === 'cached') {
                console.log('⏭️  Skipped (exists)');
                skipCount++;
            } else {
                const statusInfo = result.data?.status === 'not-in-use' ? ' [not-in-use]' : '';
                console.log(`✅ ${result.data?.region || 'Unknown'}${statusInfo}`);

                if (options.verbose && result.data) {
                    console.log(`   District: ${result.data.district || 'Unknown'}`);
                    console.log(`   Division: ${result.data.division || 'Unknown'}`);
                    console.log(`   Areas: ${result.data.jurisdictionAreas.slice(0, 3).join(', ')}${result.data.jurisdictionAreas.length > 3 ? '...' : ''}`);
                }

                if (options.dryRun && options.verbose && result.data) {
                    console.log(`\n   📄 Would write:`);
                    console.log(JSON.stringify(result.data, null, 4).split('\n').map(l => '   ' + l).join('\n'));
                    console.log();
                }

                successCount++;
            }
        } else {
            console.log(`❌ ${result.error}`);
            failCount++;
        }

        // Rate limiting
        const isLastCode = code === codesToProcess[codesToProcess.length - 1];
        if (!isLastCode) {
            await sleep(API_DELAY_MS);
        }
    }

    // Summary
    console.log(`
${'='.repeat(60)}
📊 Summary
${'='.repeat(60)}
✅ Successful: ${successCount}
⏭️  Skipped:    ${skipCount}
❌ Failed:     ${failCount}
📁 Total:      ${total}
${'='.repeat(60)}`);

    if (!options.dryRun && successCount > 0) {
        console.log(`
💡 Next steps:
   1. Review the generated files in data/${stateInfo.folder}/
   2. Run: bun scripts/generate-index.ts
   3. Optionally validate: bun scripts/validate-and-fix-rto-data.ts ${stateInfo.folder}
   4. Generate images: bun scripts/generate-rto-images.ts --state=${stateInfo.folder}
   5. Test: bun run dev
`);
    }

    // List failures
    if (failCount > 0) {
        console.log('\nFailed RTOs:');
        for (const result of results) {
            if (!result.success) {
                console.log(`  - ${result.code}: ${result.error}`);
            }
        }
    }
}

// Run
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
