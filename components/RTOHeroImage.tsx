'use client';

import { useState } from 'react';
import { CldImage } from 'next-cloudinary';

interface RTOHeroImageProps {
    rtoCode: string;
    city: string;
    /** Whether this RTO has a generated image (passed from server) */
    hasImage: boolean;
    /** Whether this RTO is inactive (not-in-use or discontinued) */
    isInactive?: boolean;
}

/**
 * Check if Cloudinary is configured (client-side)
 */
const isCloudinaryConfigured = !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/**
 * Get the Cloudinary public ID for an RTO code
 */
function getRTOImagePublicId(rtoCode: string): string {
    return `rto-city-images/${rtoCode.toUpperCase()}`;
}

/**
 * Hero background image for RTO detail pages
 * Only renders if hasImage is true (determined at build time)
 */
export default function RTOHeroImage({ rtoCode, city, hasImage, isInactive = false }: RTOHeroImageProps) {
    const [hasError, setHasError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // Grayscale + desaturation filter for inactive RTOs
    const inactiveFilter = isInactive ? 'grayscale(100%) brightness(0.7) contrast(0.9)' : undefined;

    // Don't render if Cloudinary is not configured or no image exists
    if (!isCloudinaryConfigured || !hasImage || hasError) {
        return null;
    }

    return (
        <div className="absolute inset-0 z-0">
            <CldImage
                src={getRTOImagePublicId(rtoCode)}
                alt={`${city} landmark`}
                fill
                sizes="100vw"
                className={`object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-50' : 'opacity-0'}`}
                style={inactiveFilter ? { filter: inactiveFilter } : undefined}
                priority
                format="webp"
                quality="auto"
                onError={() => setHasError(true)}
                onLoad={() => setIsLoaded(true)}
            />
        </div>
    );
}
