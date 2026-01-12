/**
 * Cloudinary configuration utility
 * 
 * This module exports a configured Cloudinary v2 instance
 * for use in scripts and server-side operations.
 */

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default cloudinary;

/**
 * Get the Cloudinary public ID for an RTO code
 * @param rtoCode - The RTO code (e.g., "KA-01")
 * @returns The public ID in the format "rto-city-images/KA-01"
 */
export function getRTOImagePublicId(rtoCode: string): string {
  return `rto-city-images/${rtoCode.toUpperCase()}`;
}

/**
 * Check if Cloudinary is properly configured
 * @returns boolean indicating if all required env vars are set
 */
export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Import the list of generated RTO images
 * This is statically imported at build time
 */
import rtoImagesData from '@/data/rto-images.json';

/**
 * Set of RTO codes that have generated images
 */
export const generatedRTOImages: Set<string> = new Set(rtoImagesData.generatedImages);

/**
 * Check if an RTO code has a generated image
 * @param rtoCode - The RTO code (e.g., "KA-01")
 * @returns boolean indicating if the image exists
 */
export function hasRTOImage(rtoCode: string): boolean {
  return generatedRTOImages.has(rtoCode.toUpperCase());
}

/**
 * Get the list of RTO codes that have generated images
 * @returns Array of RTO codes
 */
export function getGeneratedImages(): string[] {
  return rtoImagesData.generatedImages;
}
