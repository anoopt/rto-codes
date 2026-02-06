#!/usr/bin/env bun
/**
 * RTO City Image Generation Script
 * 
 * Uses Gemini 2.5 Flash to generate minimalist architectural sketches
 * of city landmarks and uploads them to Cloudinary.
 * 
 * Usage: 
 *   bun run scripts/generate-rto-images.ts [options]
 * 
 * Options:
 *   --state=STATE     Generate images for specific state only (e.g., --state=goa)
 *   --code=CODE       Generate image for specific RTO code (e.g., --code=KA-01)
 *   --limit=N         Limit number of images to generate
 *   --force           Regenerate even if image already exists
 *   --include-notinuse  Include RTOs marked as not-in-use
 * 
 * Examples:
 *   bun run scripts/generate-rto-images.ts                    # All states
 *   bun run scripts/generate-rto-images.ts --state=goa        # Goa only
 *   bun run scripts/generate-rto-images.ts --code=GA-07       # Single RTO
 *   bun run scripts/generate-rto-images.ts --state=goa --limit=5
 * 
 * Environment variables required:
 * - GEMINI_API_KEY
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';
import type { RTOCode } from '../types/rto.js';

// Load environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Validate environment variables
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not set');
  process.exit(1);
}

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error('❌ Cloudinary credentials are not set');
  process.exit(1);
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// VIBGYOR theme colors for variety
const VIBGYOR_COLORS = [
  { name: 'violet', hex: '#8B5CF6' },
  { name: 'indigo', hex: '#4F46E5' },
  { name: 'blue', hex: '#2563EB' },
  { name: 'green', hex: '#059669' },
  { name: 'yellow', hex: '#CA8A04' },
  { name: 'orange', hex: '#EA580C' },
  { name: 'red', hex: '#DC2626' },
];

/**
 * Get a random VIBGYOR color
 */
function getRandomColor(): { name: string; hex: string } {
  return VIBGYOR_COLORS[Math.floor(Math.random() * VIBGYOR_COLORS.length)];
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
      const indexPath = path.join(dataDir, entry.name, 'index.json');
      return fs.existsSync(indexPath);
    })
    .map(entry => entry.name);
}

/**
 * Load RTO data from the index file for a specific state
 */
function loadRTOData(state: string = 'karnataka'): RTOCode[] {
  const indexPath = path.join(process.cwd(), 'data', state, 'index.json');

  if (!fs.existsSync(indexPath)) {
    console.error('❌ RTO index file not found at:', indexPath);
    return [];
  }

  const data = fs.readFileSync(indexPath, 'utf-8');
  return JSON.parse(data) as RTOCode[];
}

/**
 * Load RTO data from all states
 */
function loadAllRTOData(): RTOCode[] {
  const states = getAvailableStates();
  const allRTOs: RTOCode[] = [];

  for (const state of states) {
    const rtos = loadRTOData(state);
    allRTOs.push(...rtos);
  }

  return allRTOs;
}

/**
 * Load the generated images tracking file
 */
function loadGeneratedImages(): Set<string> {
  const filePath = path.join(process.cwd(), 'data', 'rto-images.json');

  if (!fs.existsSync(filePath)) {
    return new Set();
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return new Set(data.generatedImages || []);
  } catch {
    return new Set();
  }
}

/**
 * Save the generated images tracking file
 */
function saveGeneratedImages(codes: Set<string>): void {
  const filePath = path.join(process.cwd(), 'data', 'rto-images.json');
  const data = {
    generatedImages: Array.from(codes).sort(),
    lastUpdated: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`\n📝 Updated ${filePath} with ${codes.size} image entries`);
}

/**
 * Check if an image already exists in Cloudinary
 */
async function imageExists(publicId: string): Promise<boolean> {
  try {
    await cloudinary.api.resource(publicId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate an image using Gemini and return base64 data
 */
async function generateImage(city: string, region: string, state: string): Promise<string | null> {
  try {
    // Use Gemini 2.5 Flash stable model with image-only output
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
      generationConfig: {
        // @ts-expect-error - responseModalities is a valid config for image generation
        responseModalities: ['Image'],
      },
    });

    // Build location context - use region if different from city for more variety
    const locationContext = region && region.toLowerCase() !== city.toLowerCase()
      ? `${region} area of ${city}`
      : city;

    // Pick a random VIBGYOR color for variety
    const themeColor = getRandomColor();
    console.log(`  🎨 Theme color: ${themeColor.name} (${themeColor.hex})`);

    const prompt = `Generate an image: A minimalist architectural sketch of a landmark, monument, or notable building in ${locationContext}, ${state}, India. Style: Soft watercolor washes, clean white background, professional travel guide aesthetic, theme color: ${themeColor.name}. Use ${themeColor.name} tones. The image should be elegant, simple, and suitable as a background for a website card. IMPORTANT: Do NOT include any text, labels, words, letters, or writing in the image - only the architectural illustration.`;

    console.log(`  📝 Prompt: ${prompt.substring(0, 100)}...`);

    const result = await model.generateContent(prompt);
    const response = result.response;

    // Extract image from response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }

    console.warn(`  ⚠️ No image generated for ${city}`);
    return null;
  } catch (error) {
    console.error(`  ❌ Error generating image for ${city}:`, error);
    return null;
  }
}

/**
 * Upload base64 image to Cloudinary
 */
async function uploadToCloudinary(
  base64Data: string,
  rtoCode: string
): Promise<string | null> {
  try {
    const publicId = `rto-city-images/${rtoCode.toUpperCase()}`;

    const result = await cloudinary.uploader.upload(
      `data:image/png;base64,${base64Data}`,
      {
        public_id: publicId,
        folder: '', // Already included in public_id
        format: 'webp',
        overwrite: true,
        invalidate: true, // Invalidate CDN cache
        transformation: [
          { width: 800, height: 800, crop: 'fill', gravity: 'center' },
          { quality: 'auto:good' },
        ],
      }
    );

    return result.secure_url;
  } catch (error) {
    console.error(`  ❌ Error uploading to Cloudinary:`, error);
    return null;
  }
}

/**
 * Process a single RTO entry
 */
async function processRTO(rto: RTOCode, skipExisting: boolean = true): Promise<boolean> {
  const publicId = `rto-city-images/${rto.code.toUpperCase()}`;

  console.log(`\n🚗 Processing ${rto.code} - ${rto.city}, ${rto.region}`);

  // Check if image already exists
  if (skipExisting) {
    const exists = await imageExists(publicId);
    if (exists) {
      console.log(`  ✅ Image already exists, skipping`);
      return true;
    }
  }

  // Generate image
  console.log(`  🖼️ Generating image...`);
  const imageData = await generateImage(rto.city, rto.region, rto.state);

  if (!imageData) {
    console.log(`  ⚠️ Failed to generate image`);
    return false;
  }

  // Upload to Cloudinary
  console.log(`  ☁️ Uploading to Cloudinary...`);
  const url = await uploadToCloudinary(imageData, rto.code);

  if (url) {
    console.log(`  ✅ Uploaded: ${url}`);
    return true;
  }

  return false;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting RTO Image Generation\n');
  console.log('='.repeat(50));

  // Parse command line arguments
  const args = process.argv.slice(2);
  const skipExisting = !args.includes('--force');
  const singleCode = args.find(arg => arg.startsWith('--code='))?.split('=')[1];
  const stateArg = args.find(arg => arg.startsWith('--state='))?.split('=')[1];
  const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0');
  const skipNotInUse = !args.includes('--include-notinuse');

  console.log(`Options:`);
  console.log(`  Skip existing: ${skipExisting}`);
  console.log(`  Single code: ${singleCode || 'none'}`);
  console.log(`  State filter: ${stateArg || 'all states'}`);
  console.log(`  Skip not-in-use: ${skipNotInUse}`);
  console.log(`  Limit: ${limit || 'none'}`);
  console.log('='.repeat(50));

  // Load RTO data
  let rtos: RTOCode[];
  if (stateArg) {
    rtos = loadRTOData(stateArg.toLowerCase());
    if (rtos.length === 0) {
      console.error(`❌ No RTOs found for state: ${stateArg}`);
      process.exit(1);
    }
  } else {
    rtos = loadAllRTOData();
  }
  console.log(`\n📊 Loaded ${rtos.length} RTO entries`);

  // Filter RTOs
  let rtosToProcess = rtos.filter(rto => rto.region && rto.region.trim() !== '');

  // Skip not-in-use RTOs by default
  if (skipNotInUse) {
    rtosToProcess = rtosToProcess.filter(rto => rto.status !== 'not-in-use');
  }

  if (singleCode) {
    rtosToProcess = rtosToProcess.filter(
      rto => rto.code.toLowerCase() === singleCode.toLowerCase()
    );
    if (rtosToProcess.length === 0) {
      console.error(`❌ RTO code ${singleCode} not found`);
      process.exit(1);
    }
  }

  if (limit > 0) {
    rtosToProcess = rtosToProcess.slice(0, limit);
  }

  console.log(`📋 Processing ${rtosToProcess.length} RTOs`);

  // Load existing generated images
  const generatedImages = loadGeneratedImages();
  console.log(`📦 Already generated: ${generatedImages.size} images`);

  // Process RTOs
  let successCount = 0;
  let failCount = 0;

  for (const rto of rtosToProcess) {
    const success = await processRTO(rto, skipExisting);
    if (success) {
      successCount++;
      generatedImages.add(rto.code.toUpperCase());
      // Save after each successful generation to handle interruptions
      saveGeneratedImages(generatedImages);
    } else {
      failCount++;
    }

    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
  console.log('='.repeat(50));
}

// Run
main().catch(console.error);
