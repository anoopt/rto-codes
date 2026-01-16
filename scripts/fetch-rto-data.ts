#!/usr/bin/env bun

/**
 * Script to fetch RTO data from rto64.in and create/update RTO JSON files
 * Uses Playwright to bypass bot detection and HTTP 403 errors
 * 
 * Usage:
 *   bun scripts/fetch-rto-data.ts <state-code> <start> <end> [options]
 * 
 * Options:
 *   --dry-run       Preview without writing files
 *   --headless      Run browser in headless mode (default: true)
 *   --headed        Run browser in headed mode (visible window)
 *   --slow          Add extra delays for slower connections
 * 
 * Examples:
 *   bun scripts/fetch-rto-data.ts ka 1 71          # Fetch Karnataka RTOs 1-71
 *   bun scripts/fetch-rto-data.ts ga 1 12          # Fetch Goa RTOs 1-12
 *   bun scripts/fetch-rto-data.ts tn 1 50          # Fetch Tamil Nadu RTOs 1-50
 *   bun scripts/fetch-rto-data.ts mh 1 10 --dry-run # Preview without writing files
 *   bun scripts/fetch-rto-data.ts ka 55            # Fetch single RTO KA-55
 *   bun scripts/fetch-rto-data.ts ga 3 12 --headed # Run with visible browser
 */

import { chromium, Browser, Page } from 'playwright';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = 'https://rto64.in';
const REQUEST_DELAY_MS = 1500; // Delay between requests to be respectful
const PAGE_LOAD_TIMEOUT = 30000; // 30 seconds timeout for page load

// State name mappings
const STATE_NAMES: Record<string, string> = {
  'ka': 'Karnataka',
  'tn': 'Tamil Nadu',
  'mh': 'Maharashtra',
  'ap': 'Andhra Pradesh',
  'ts': 'Telangana',
  'kl': 'Kerala',
  'gj': 'Gujarat',
  'rj': 'Rajasthan',
  'up': 'Uttar Pradesh',
  'mp': 'Madhya Pradesh',
  'wb': 'West Bengal',
  'br': 'Bihar',
  'or': 'Odisha',
  'pb': 'Punjab',
  'hr': 'Haryana',
  'jh': 'Jharkhand',
  'cg': 'Chhattisgarh',
  'uk': 'Uttarakhand',
  'hp': 'Himachal Pradesh',
  'as': 'Assam',
  'ga': 'Goa',
  'jk': 'Jammu and Kashmir',
  'dl': 'Delhi',
  'ch': 'Chandigarh',
  'py': 'Puducherry',
};

// State folder name mappings
const STATE_FOLDERS: Record<string, string> = {
  'ka': 'karnataka',
  'tn': 'tamilnadu',
  'mh': 'maharashtra',
  'ap': 'andhrapradesh',
  'ts': 'telangana',
  'kl': 'kerala',
  'gj': 'gujarat',
  'rj': 'rajasthan',
  'up': 'uttarpradesh',
  'mp': 'madhyapradesh',
  'wb': 'westbengal',
  'br': 'bihar',
  'or': 'odisha',
  'pb': 'punjab',
  'hr': 'haryana',
  'jh': 'jharkhand',
  'cg': 'chhattisgarh',
  'uk': 'uttarakhand',
  'hp': 'himachalpradesh',
  'as': 'assam',
  'ga': 'goa',
  'jk': 'jammukashmir',
  'dl': 'delhi',
  'ch': 'chandigarh',
  'py': 'puducherry',
};

// District mappings for various states
const STATE_DISTRICTS: Record<string, string[]> = {
  'ka': [
    'Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Mangaluru', 'Belagavi',
    'Dharwad', 'Tumakuru', 'Kolar', 'Shivamogga', 'Ballari', 'Kalaburagi',
    'Dakshina Kannada', 'Uttara Kannada', 'Hassan', 'Mandya', 'Kodagu',
    'Chikkamagaluru', 'Davanagere', 'Udupi', 'Raichur', 'Koppal', 'Bidar',
    'Vijayapura', 'Bagalkot', 'Gadag', 'Haveri', 'Yadgir', 'Chamarajanagar',
    'Chikkaballapura', 'Ramanagara', 'Vijayanagara', 'Chitradurga',
  ],
  'ga': ['North Goa', 'South Goa'],
};

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
  established: string;
  address: string;
  pinCode: string;
  phone: string;
  email: string;
  jurisdictionAreas: string[];
}

interface FetchResult {
  code: string;
  success: boolean;
  data?: RTOData;
  error?: string;
  url: string;
}

interface CLIOptions {
  dryRun: boolean;
  headless: boolean;
  slow: boolean;
}

// ============================================================================
// HTML Parsing Functions
// ============================================================================

/**
 * Parse table rows from HTML table
 */
function parseTableRows(html: string): Map<string, string> {
  const result = new Map<string, string>();
  const rowRegex = /<tr[^>]*>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<\/tr>/gi;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();
    result.set(key, value);
  }

  return result;
}

/**
 * Parse jurisdiction areas from HTML
 */
function parseJurisdictionAreas(html: string): string[] {
  const areas: string[] = [];
  const jurisdictionMatch = html.match(/Jurisdiction Area[^<]*<\/h3>[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!jurisdictionMatch) return areas;

  const tableHtml = jurisdictionMatch[1];
  const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>\d+\.?<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi;
  let match;

  while ((match = rowRegex.exec(tableHtml)) !== null) {
    const area = match[1].trim();
    if (area && !area.toLowerCase().includes('update soon')) {
      areas.push(area);
    }
  }

  if (areas.length === 0) {
    const listRegex = /<td[^>]*>(?:\d+\.?\s*)?([^<]+)<\/td>/gi;
    while ((match = listRegex.exec(tableHtml)) !== null) {
      const area = match[1].trim();
      if (area && !area.match(/^\d+\.?$/) && !area.toLowerCase().includes('update soon') && !area.toLowerCase().includes('s.no')) {
        areas.push(area);
      }
    }
  }

  return areas;
}

/**
 * Clean and normalize extracted values
 */
function cleanValue(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/\s+/g, ' ')
    .replace(/&#8211;/g, '-')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/–/g, '-')
    .replace(/\s*-\s*$/, '')
    .replace(/^\s*-\s*/, '')
    .trim();
}

/**
 * Extract RTO name from page title or heading
 */
function extractRTOName(html: string, code: string): string {
  const tableMatch = html.match(/RTO Office<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
  if (tableMatch) {
    return cleanValue(tableMatch[1]);
  }

  const h2Match = html.match(/Which Registration\?\s*\|\s*([^<]+?)(?:\s+Contact Details|\s*<)/i);
  if (h2Match) {
    const name = cleanValue(h2Match[1]).replace(/Office$/, '').trim();
    if (name && !name.includes('RTO Code List')) {
      return name;
    }
  }

  const codeUpper = code.toUpperCase().replace('-', ' ');
  const h3Regex = new RegExp(codeUpper + '\\s+([^<]+?)\\s*(?:RTO|ARTO)\\s*Office\\s*Details', 'i');
  const h3Match = html.match(h3Regex);
  if (h3Match) {
    const name = cleanValue(h3Match[1]);
    if (name) {
      return name + (html.includes('ARTO') ? ' ARTO' : ' RTO');
    }
  }

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1];
    const titleRTOMatch = title.match(/\|\s*([^|]+?)\s*(?:RTO|ARTO)\s*Office/i);
    if (titleRTOMatch) {
      return cleanValue(titleRTOMatch[1]) + ' RTO';
    }
  }

  return '';
}

/**
 * Extract division name from HTML
 */
function extractDivision(html: string, tableData: Map<string, string>): string {
  for (const [key, value] of tableData) {
    if (key.includes('division')) {
      return cleanValue(value);
    }
  }

  const divisionMatch = html.match(/<h3[^>]*>([^<]*Division)[^<]*(?:RTO|ARTO) Office List<\/h3>/i);
  if (divisionMatch) {
    return cleanValue(divisionMatch[1]);
  }

  return '';
}

/**
 * Infer district from RTO name, address, or division
 */
function inferDistrict(name: string, address: string, division: string, stateCode: string): string {
  const divisionToDistrict: Record<string, string> = {
    'Bengaluru Urban Division': 'Bengaluru Urban',
    'Bengaluru Rural Division': 'Bengaluru Rural',
    'North Goa Division': 'North Goa',
    'South Goa Division': 'South Goa',
  };

  if (division && divisionToDistrict[division]) {
    return divisionToDistrict[division];
  }

  const districts = STATE_DISTRICTS[stateCode.toLowerCase()] || [];
  const nameLower = name.toLowerCase();
  for (const district of districts) {
    if (nameLower.includes(district.toLowerCase())) {
      return district;
    }
  }

  const addressLower = address.toLowerCase();
  for (const district of districts) {
    if (addressLower.includes(district.toLowerCase())) {
      return district;
    }
  }

  if (stateCode.toLowerCase() === 'ga') {
    const northGoaTalukas = ['bardez', 'bicholim', 'pernem', 'sattari', 'tiswadi', 'ponda'];
    const southGoaTalukas = ['salcete', 'mormugao', 'quepem', 'canacona', 'sanguem', 'dharbandora'];
    const combined = (name + ' ' + address).toLowerCase();
    for (const taluka of northGoaTalukas) {
      if (combined.includes(taluka)) return 'North Goa';
    }
    for (const taluka of southGoaTalukas) {
      if (combined.includes(taluka)) return 'South Goa';
    }
  }

  return '';
}

/**
 * Parse RTO data from HTML content
 */
function parseRTOData(html: string, code: string, stateCode: string): RTOData | null {
  if (html.includes('All India RTO Code List PDF') && !html.includes(code.toUpperCase() + ' Which Registration')) {
    return null;
  }

  if (html.includes('Page not found') || html.includes('404')) {
    return null;
  }

  const tableData = parseTableRows(html);
  let name = extractRTOName(html, code);
  if (!name) {
    const rtoOffice = tableData.get('rto office');
    if (rtoOffice) {
      name = cleanValue(rtoOffice);
    }
  }

  if (!name) {
    const contentMatch = html.match(new RegExp('([A-Za-z\\s]+)\\s+(?:RTO|ARTO)\\s+Office', 'i'));
    if (contentMatch) {
      name = cleanValue(contentMatch[1]) + ' RTO';
    }
  }

  const address = cleanValue(tableData.get('address'));
  let pinCode = cleanValue(tableData.get('pin code'));
  const phone = cleanValue(tableData.get('phone number'));
  const email = cleanValue(tableData.get('email id'));
  const division = extractDivision(html, tableData);

  if (pinCode && (pinCode.includes('-') || pinCode.length > 6)) {
    pinCode = '';
  }
  pinCode = pinCode.replace(/\s+/g, '');

  const jurisdictionAreas = parseJurisdictionAreas(html).map(area => cleanValue(area));
  const district = inferDistrict(name, address, division, stateCode);
  const region = name.replace(/\s*(RTO|ARTO)$/i, '').trim();
  const stateName = STATE_NAMES[stateCode.toLowerCase()] || stateCode.toUpperCase();
  let city = region;
  if (district.includes('Bengaluru')) {
    city = 'Bengaluru';
  }

  const officeType = name.includes('ARTO') ? 'Assistant Regional Transport Office' : 'Regional Transport Office';
  const description = 'The ' + code.toUpperCase() + ' ' + officeType + ' (' + name + ') handles vehicle registrations and transport services for this region' + (district ? ' in ' + district + ' district' : '') + '.';

  return {
    code: code.toUpperCase(),
    region,
    city,
    state: stateName,
    stateCode: stateCode.toUpperCase(),
    district,
    division,
    description,
    established: 'N/A',
    address,
    pinCode,
    phone,
    email,
    jurisdictionAreas,
  };
}

// ============================================================================
// Playwright Browser Functions
// ============================================================================

async function launchBrowser(headless: boolean): Promise<Browser> {
  console.log('🌐 Launching ' + (headless ? 'headless' : 'headed') + ' browser...');

  const browser = await chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-infobars',
      '--disable-extensions',
      '--window-size=1920,1080',
      '--start-maximized',
    ],
  });

  return browser;
}

async function createPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
  });

  const page = await context.newPage();

  // Comprehensive stealth scripts
  await page.addInitScript(() => {
    // Remove webdriver property
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // Add chrome object
    // @ts-expect-error - chrome property doesn't exist on window type
    window.chrome = {
      runtime: {},
      loadTimes: function () { },
      csi: function () { },
      app: {},
    };

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.navigator.permissions.query = (parameters: any) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission } as PermissionStatus) :
        originalQuery(parameters)
    );

    // Add plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Add languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-IN', 'en-GB', 'en-US', 'en'],
    });

    // Mask automation indicators
    Object.defineProperty(navigator, 'maxTouchPoints', {
      get: () => 0,
    });

    // Override toString to prevent detection
    const originalFunction = Function.prototype.toString;
    Function.prototype.toString = function () {
      if (this === Function.prototype.toString) {
        return 'function toString() { [native code] }';
      }
      return originalFunction.call(this);
    };
  });

  return page;
}

async function fetchRTOWithPlaywright(
  page: Page,
  stateCode: string,
  rtoNumber: number,
  slow: boolean
): Promise<FetchResult> {
  const code = stateCode.toLowerCase() + '-' + rtoNumber.toString().padStart(2, '0');
  const url = BASE_URL + '/' + code + '-which-registration/';

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: PAGE_LOAD_TIMEOUT,
    });

    if (!response) {
      return { code, success: false, error: 'No response received', url };
    }

    // Check for browser verification challenge
    let html = await page.content();
    const maxWaitTime = 30000; // Max 30 seconds to wait for challenge
    const checkInterval = 2000;
    let waited = 0;

    while (html.includes('Checking your browser') || html.includes('Just a moment')) {
      if (waited >= maxWaitTime) {
        return { code, success: false, error: 'Bot challenge timeout', url };
      }
      console.log('\n   ⏳ Waiting for browser verification...');
      await page.waitForTimeout(checkInterval);
      waited += checkInterval;
      html = await page.content();
    }

    // Re-check status after potential redirect
    const finalUrl = page.url();
    const currentStatus = response.status();

    // If we're now on the actual page (URL changed), it worked
    if (finalUrl !== url && finalUrl.includes(code)) {
      // Successfully passed challenge
    } else if (currentStatus === 403 && !html.includes('Checking your browser')) {
      // Still 403 but not a challenge page - real block
      const isCloudflare = html.includes('cloudflare') || html.includes('cf-');
      const isSucuri = html.includes('sucuri');
      const errorType = isCloudflare ? 'Cloudflare' : isSucuri ? 'Sucuri WAF' : 'Server';
      return { code, success: false, error: 'HTTP 403 (' + errorType + ' block)', url };
    }

    await page.waitForTimeout(slow ? 2000 : 1000);
    html = await page.content();
    const data = parseRTOData(html, code, stateCode);

    if (!data) {
      // Check if still showing challenge page
      if (html.includes('Checking your browser') || html.includes('Access Denied')) {
        return { code, success: false, error: 'Failed to pass bot verification', url };
      }
      return { code, success: false, error: 'No dedicated page found or could not parse content', url };
    }

    if (!data.region) {
      return { code, success: false, error: 'Could not parse RTO name from page', url };
    }

    return { code, success: true, data, url };
  } catch (error) {
    return { code, success: false, error: error instanceof Error ? error.message : String(error), url };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function writeRTOFile(stateCode: string, data: RTOData, dryRun: boolean): void {
  const folderName = STATE_FOLDERS[stateCode.toLowerCase()] || stateCode.toLowerCase();
  const dataDir = join(process.cwd(), 'data', folderName);

  if (!dryRun && !existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    console.log('📁 Created directory: ' + dataDir);
  }

  const fileName = data.code.toLowerCase() + '.json';
  const filePath = join(dataDir, fileName);
  const jsonContent = JSON.stringify(data, null, 2);

  if (dryRun) {
    console.log('\n📄 Would write to ' + filePath + ':');
    console.log(jsonContent);
  } else {
    writeFileSync(filePath, jsonContent + '\n', 'utf-8');
    console.log('  ✅ Written: ' + filePath);
  }
}

function parseArgs(): { options: CLIOptions; stateCode: string | null; start: number; end: number } {
  const args = process.argv.slice(2);

  const options: CLIOptions = {
    dryRun: args.includes('--dry-run'),
    headless: !args.includes('--headed'),
    slow: args.includes('--slow'),
  };

  const filteredArgs = args.filter(arg => !arg.startsWith('--'));

  if (filteredArgs.length < 2) {
    return { options, stateCode: null, start: 0, end: 0 };
  }

  const stateCode = filteredArgs[0].toLowerCase();
  const start = parseInt(filteredArgs[1], 10);
  const end = filteredArgs.length >= 3 ? parseInt(filteredArgs[2], 10) : start;

  return { options, stateCode, start, end };
}

function printHelp(): void {
  console.log('\n📋 RTO Data Fetcher - Fetch RTO data from rto64.in using Playwright\n');
  console.log('Usage:');
  console.log('  bun scripts/fetch-rto-data.ts <state-code> <start> [end] [options]\n');
  console.log('Arguments:');
  console.log('  state-code  Two-letter state code (e.g., ka, ga, tn, mh)');
  console.log('  start       Starting RTO number');
  console.log('  end         Ending RTO number (optional, defaults to start)\n');
  console.log('Options:');
  console.log('  --dry-run   Preview without writing files');
  console.log('  --headed    Run browser in visible mode (for debugging)');
  console.log('  --slow      Add extra delays for slower connections\n');
  console.log('Examples:');
  console.log('  bun scripts/fetch-rto-data.ts ka 1 71          # Fetch Karnataka RTOs 1-71');
  console.log('  bun scripts/fetch-rto-data.ts ga 1 12          # Fetch all Goa RTOs');
  console.log('  bun scripts/fetch-rto-data.ts ga 3 12          # Fetch Goa RTOs 3-12');
  console.log('  bun scripts/fetch-rto-data.ts mh 1 10 --dry-run # Preview without writing');
  console.log('  bun scripts/fetch-rto-data.ts ga 7 --headed    # Debug with visible browser\n');
  console.log('Supported State Codes:');
  Object.entries(STATE_NAMES).forEach(([code, name]) => {
    console.log('  ' + code.toUpperCase() + ' - ' + name);
  });
  console.log('\nNote: This script uses Playwright (Chromium) to bypass bot detection.\n');
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const { options, stateCode, start, end } = parseArgs();

  if (!stateCode) {
    printHelp();
    process.exit(1);
  }

  if (!STATE_NAMES[stateCode]) {
    console.error('❌ Unknown state code: ' + stateCode);
    console.error('   Supported codes: ' + Object.keys(STATE_NAMES).join(', '));
    process.exit(1);
  }

  if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
    console.error('❌ Invalid RTO number range');
    process.exit(1);
  }

  const stateName = STATE_NAMES[stateCode];
  const total = end - start + 1;

  console.log('\n🚗 RTO Data Fetcher (Playwright Edition)');
  console.log('='.repeat(50));
  console.log('State:      ' + stateName + ' (' + stateCode.toUpperCase() + ')');
  console.log('Range:      ' + stateCode.toUpperCase() + '-' + start.toString().padStart(2, '0') + ' to ' + stateCode.toUpperCase() + '-' + end.toString().padStart(2, '0'));
  console.log('Total:      ' + total + ' RTO(s)');
  console.log('Mode:       ' + (options.dryRun ? '🔍 DRY RUN (no files will be written)' : '💾 WRITE MODE'));
  console.log('Browser:    ' + (options.headless ? 'Headless' : 'Headed (visible)'));
  console.log('='.repeat(50) + '\n');

  const browser = await launchBrowser(options.headless);
  const page = await createPage(browser);

  // Warm-up: Visit homepage first to appear more natural
  console.log('🏠 Warming up with homepage visit...');
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT });
    await page.waitForTimeout(2000);
    console.log('✅ Homepage loaded successfully\n');
  } catch {
    console.log('⚠️  Homepage warm-up failed, continuing anyway...\n');
  }

  const results: FetchResult[] = [];
  let successCount = 0;
  let failCount = 0;

  try {
    for (let i = start; i <= end; i++) {
      const code = stateCode.toUpperCase() + '-' + i.toString().padStart(2, '0');
      process.stdout.write('⏳ Fetching ' + code + '... ');

      const result = await fetchRTOWithPlaywright(page, stateCode, i, options.slow);
      results.push(result);

      if (result.success && result.data) {
        console.log('✅ ' + result.data.region + ' (' + result.data.city + ')');
        writeRTOFile(stateCode, result.data, options.dryRun);
        successCount++;
      } else {
        console.log('⚠️  ' + result.error);
        failCount++;
      }

      if (i < end) {
        await sleep(REQUEST_DELAY_MS);
      }
    }
  } finally {
    await browser.close();
    console.log('\n🔒 Browser closed');
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log('✅ Successful: ' + successCount);
  console.log('⚠️  Failed:     ' + failCount);
  console.log('📁 Total:      ' + total);

  if (failCount > 0) {
    console.log('\nFailed RTOs:');
    for (const result of results) {
      if (!result.success) {
        console.log('  - ' + result.code + ': ' + result.error);
      }
    }
  }

  if (!options.dryRun && successCount > 0) {
    const folderName = STATE_FOLDERS[stateCode];
    console.log('\n💡 Next steps:');
    console.log('   1. Review the generated files in data/' + folderName + '/');
    console.log('   2. Run: bun scripts/generate-index.ts');
    console.log('   3. Run: bun scripts/validate-and-fix-rto-data.ts ' + folderName + ' --fix');
    console.log('   4. Test the application: bun run dev');
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
