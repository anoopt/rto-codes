'use client';

import { useState, useEffect } from 'react';
import DistrictMap from '@/components/DistrictMap';

const STORAGE_KEY = 'rto-map-hint-dismissed';

interface RTOInfo {
    code: string;
    region: string;
    isInactive?: boolean;
    isDistrictHeadquarter?: boolean;
}

interface InteractiveMapSectionProps {
    district: string;
    svgContent: string;
    /** Mapping from modern district names to SVG IDs */
    districtMapping: Record<string, string>;
    /** List of all valid district SVG IDs for this state */
    svgDistrictIds: string[];
    districtRTOsMap?: Record<string, RTOInfo[]>;
}

/**
 * Interactive map section with first-time user hint.
 * The hint only shows once per browser using localStorage.
 * 
 * State-specific data (districtMapping, svgDistrictIds) must be passed
 * from the server component to keep this client component free of Node.js deps.
 * 
 * Returns null if no valid SVG content is provided (e.g., state has no map file yet).
 */
export default function InteractiveMapSection({
    district,
    svgContent,
    districtMapping,
    svgDistrictIds,
    districtRTOsMap
}: InteractiveMapSectionProps) {
    const [showHint, setShowHint] = useState(false);
    const [hintVisible, setHintVisible] = useState(false);

    // Check if we have valid SVG content
    const hasValidSvg = svgContent && svgContent.trim() !== '';

    useEffect(() => {
        // Only run if we have valid SVG content
        if (!hasValidSvg) return;

        // Check if hint was already dismissed (must be exactly 'true')
        const dismissed = localStorage.getItem(STORAGE_KEY) === 'true';
        if (!dismissed) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setShowHint(true);
            // Small delay before showing for smoother UX
            const timer = setTimeout(() => setHintVisible(true), 500);
            return () => clearTimeout(timer);
        }
    }, [hasValidSvg]);

    const dismissHint = () => {
        setHintVisible(false);
        localStorage.setItem(STORAGE_KEY, 'true');
        setTimeout(() => setShowHint(false), 300);
    };

    // Auto-dismiss after 8 seconds
    useEffect(() => {
        if (hintVisible) {
            const timer = setTimeout(() => dismissHint(), 8000);
            return () => clearTimeout(timer);
        }
    }, [hintVisible]);

    // Don't render anything if there's no valid SVG content
    if (!hasValidSvg) {
        return null;
    }

    return (
        <div className="mt-8 flex flex-col items-center gap-3 relative">
            {/* Map */}
            <div
                className="w-48 h-60 md:w-56 md:h-72 opacity-80 hover:opacity-100 transition-opacity"
                onClick={dismissHint}
            >
                <DistrictMap
                    district={district}
                    svgContent={svgContent}
                    districtMapping={districtMapping}
                    svgDistrictIds={svgDistrictIds}
                    className="w-full h-full"
                    interactive={true}
                    districtRTOsMap={districtRTOsMap}
                />
            </div>

            {/* First-time hint - floating above map */}
            {showHint && (
                <div
                    className={`
            absolute -top-12 left-1/2 -translate-x-1/2
            flex items-center justify-center gap-2
            bg-[var(--accent)] text-white
            px-4 py-2 rounded-lg
            text-sm font-medium
            shadow-lg
            transition-all duration-300
            z-20
            whitespace-nowrap
            ${hintVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
          `}
                >
                    <span className="text-base">💡</span>
                    <span>Click any district to explore its RTOs</span>
                    <button
                        onClick={dismissHint}
                        className="ml-2 p-1 hover:bg-white/20 rounded transition-colors"
                        aria-label="Dismiss hint"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                    {/* Arrow pointing down */}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-[var(--accent)]" />
                </div>
            )}

            {/* Static hint for all users */}
            <p className="text-xs text-[var(--muted-foreground)] opacity-70">
                Click on any district to explore its RTOs
            </p>
        </div>
    );
}
