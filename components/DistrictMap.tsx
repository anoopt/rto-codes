'use client';

import { useRouter } from 'next/navigation';
import StateMapClient from './StateMapClient';

interface RTOInfo {
    code: string;
    region: string;
    isInactive?: boolean;
    isDistrictHeadquarter?: boolean;
}

interface DistrictMapProps {
    /** The district to highlight (modern spelling from RTO data) */
    district?: string;
    /** Pre-loaded SVG content from the server */
    svgContent: string;
    /** Mapping from modern district names to SVG IDs (e.g., "Belagavi" -> "Belgaum") */
    districtMapping: Record<string, string>;
    /** List of all valid district SVG IDs for this state */
    svgDistrictIds: string[];
    className?: string;
    /** Whether to enable click-to-navigate functionality */
    interactive?: boolean;
    /** Map of modern district names to their RTOs (required for interactive mode) */
    districtRTOsMap?: Record<string, RTOInfo[]>;
}

/**
 * Wrapper component that renders a state map with optional highlighting and navigation.
 * 
 * When `interactive` is true, clicking on a district navigates to the first RTO in that district.
 * 
 * This component is state-agnostic - all state-specific data is passed as props from
 * the server component, keeping this client component free of Node.js dependencies.
 * 
 * IMPORTANT: svgContent, districtMapping, and svgDistrictIds must be passed from a server component.
 */
export default function DistrictMap({
    district,
    svgContent,
    districtMapping,
    svgDistrictIds,
    className = '',
    interactive = false,
    districtRTOsMap
}: DistrictMapProps) {
    const router = useRouter();

    if (!svgContent || !districtMapping) {
        return null;
    }

    // Convert modern district name to SVG ID (old spelling) if provided
    const svgDistrictId = district ? (districtMapping[district] || null) : null;

    // Build reverse mapping: SVG ID -> list of modern district names that map to it
    // Multiple districts can map to the same SVG region (e.g., Ballari and Vijayanagara -> "Ballari")
    const svgIdToModernNames: Record<string, string[]> = {};
    Object.entries(districtMapping).forEach(([modernName, svgId]) => {
        if (!svgIdToModernNames[svgId]) {
            svgIdToModernNames[svgId] = [];
        }
        svgIdToModernNames[svgId].push(modernName);
    });

    // Build district info map for tooltips (SVG ID -> info)
    // When multiple districts map to the same SVG region (e.g., Ballari and Vijayanagara both map to "Ballari"),
    // we aggregate the RTO counts and use the SVG ID as the display name since that's what's shown on the map.
    const districtInfoMap: Record<string, { districtName: string; rtoCount: number }> = {};

    if (interactive && districtRTOsMap) {
        // Iterate over all districts that have mappings
        Object.entries(districtMapping).forEach(([modernName, svgId]) => {
            const rtos = districtRTOsMap[modernName];
            if (rtos && rtos.length > 0) {
                if (districtInfoMap[svgId]) {
                    // SVG region already has info - aggregate the RTO count
                    districtInfoMap[svgId].rtoCount += rtos.length;
                } else {
                    // First district mapping to this SVG region - use SVG ID as display name
                    districtInfoMap[svgId] = {
                        districtName: svgId,  // Use SVG ID (region name) not the RTO district name
                        rtoCount: rtos.length
                    };
                }
            }
        });
    }

    // Handle district click - navigate to the primary RTO of that district
    // When multiple districts map to the same SVG region, prioritize RTOs where
    // the district name matches the SVG ID (e.g., prefer KA-34 Ballari over KA-35 Vijayanagara
    // when clicking on the Ballari region)
    const handleDistrictClick = (svgId: string) => {
        if (!districtRTOsMap) return;

        const modernDistrictNames = svgIdToModernNames[svgId];
        if (!modernDistrictNames || modernDistrictNames.length === 0) return;

        // Collect all RTOs from all districts that map to this SVG region
        const allRtos: (RTOInfo & { district: string })[] = [];
        modernDistrictNames.forEach(districtName => {
            const rtos = districtRTOsMap[districtName];
            if (rtos) {
                rtos.forEach(rto => allRtos.push({ ...rto, district: districtName }));
            }
        });

        if (allRtos.length === 0) return;

        // Sort RTOs: prioritize those where district name matches the SVG ID
        // AND prioritize active RTOs and district headquarters
        allRtos.sort((a, b) => {
            // 1. Prioritize active RTOs
            if (!a.isInactive && b.isInactive) return -1;
            if (a.isInactive && !b.isInactive) return 1;

            // 2. Prioritize district headquarters
            if (a.isDistrictHeadquarter && !b.isDistrictHeadquarter) return -1;
            if (!a.isDistrictHeadquarter && b.isDistrictHeadquarter) return 1;

            // 3. Prioritize matching SVG ID district name
            const aMatchesSvgId = a.district === svgId;
            const bMatchesSvgId = b.district === svgId;
            if (aMatchesSvgId && !bMatchesSvgId) return -1;
            if (!aMatchesSvgId && bMatchesSvgId) return 1;

            // 4. Sort by code
            return a.code.localeCompare(b.code);
        });

        // Navigate to the first (highest priority) RTO
        router.push(`/rto/${allRtos[0].code.toLowerCase()}`);
    };

    return (
        <div className={`district-map-container ${className}`}>
            <StateMapClient
                svgContent={svgContent}
                highlightDistrictId={svgDistrictId}
                districtIds={svgDistrictIds}
                className="w-full h-full"
                interactive={interactive}
                districtInfoMap={interactive ? districtInfoMap : undefined}
                onDistrictClick={interactive ? handleDistrictClick : undefined}
            />
        </div>
    );
}
