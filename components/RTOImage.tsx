'use client';

import { useState } from 'react';
import { CldImage } from 'next-cloudinary';

interface RTOImageProps {
    rtoCode: string;
    city: string;
    variant: 'tile' | 'hero';
    className?: string;
    /** Whether this RTO has a generated image (passed from server) */
    hasImage: boolean;
    /** Whether this RTO is inactive (not-in-use or discontinued) */
    isInactive?: boolean;
}

/**
 * Get the Cloudinary public ID for an RTO code
 */
function getRTOImagePublicId(rtoCode: string): string {
    return `rto-city-images/${rtoCode.toUpperCase()}`;
}

/**
 * Client component for RTO images with graceful fallback
 * Only renders if hasImage is true (determined at build time)
 */
export default function RTOImage({ rtoCode, city, variant, className = '', hasImage, isInactive = false }: RTOImageProps) {
    const [hasError, setHasError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // Grayscale + desaturation filter for inactive RTOs
    const inactiveFilter = isInactive ? 'grayscale(100%) brightness(0.7) contrast(0.9)' : undefined;

    // Don't render if no image exists for this RTO
    if (!hasImage || hasError) {
        return null;
    }

    if (variant === 'tile') {
        return (
            <CldImage
                src={getRTOImagePublicId(rtoCode)}
                alt={`${city} landmark`}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                className={`object-cover transition-all duration-500 group-hover:scale-110 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
                style={inactiveFilter ? { filter: inactiveFilter } : undefined}
                loading="lazy"
                format="webp"
                quality="auto"
                onError={() => setHasError(true)}
                onLoad={() => setIsLoaded(true)}
            />
        );
    }

    // Hero variant
    return (
        <CldImage
            src={getRTOImagePublicId(rtoCode)}
            alt={`${city} landmark`}
            fill
            sizes="100vw"
            className={`object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-50' : 'opacity-0'} ${className}`}
            style={inactiveFilter ? { filter: inactiveFilter } : undefined}
            priority
            format="webp"
            quality="auto"
            onError={() => setHasError(true)}
            onLoad={() => setIsLoaded(true)}
        />
    );
}
