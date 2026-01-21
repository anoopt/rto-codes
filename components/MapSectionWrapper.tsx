'use client';

import dynamic from 'next/dynamic';
import { isOSMEnabled } from '@/lib/feature-flags';
import InteractiveMapSection from '@/components/InteractiveMapSection';
import type { RTOCode } from '@/types/rto';

// Dynamically import OSMDistrictMap with SSR disabled (Leaflet requires DOM)
const OSMDistrictMap = dynamic(() => import('@/components/OSMDistrictMap'), {
  ssr: false,
  loading: () => (
    <div className="h-64 md:h-80 lg:h-96 bg-gray-200 dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      <div className="text-gray-500 dark:text-gray-400 text-sm">Loading map...</div>
    </div>
  ),
});

interface RTOInfo {
  code: string;
  region: string;
  isInactive?: boolean;
  isDistrictHeadquarter?: boolean;
}

interface MapSectionWrapperProps {
  /** The current RTO data */
  rto: {
    state: string;
    stateCode: string;
    district?: string;
  };
  /** SVG map content for the SVG map mode */
  svgContent?: string | null;
  /** District mapping for SVG map mode */
  districtMapping?: Record<string, string>;
  /** SVG district IDs for SVG map mode */
  svgDistrictIds?: string[];
  /** Map of district names to their RTOs (for both map modes) */
  districtRTOsMap?: Record<string, RTOInfo[]>;
  /** Array of all RTOs in the current district (for OSM map markers) */
  districtRTOs?: RTOCode[];
}

/**
 * MapSectionWrapper - Conditionally renders OSM or SVG district map based on feature flag.
 * 
 * When NEXT_PUBLIC_OSM_ENABLED is true, renders the OSMDistrictMap component.
 * Otherwise, renders the existing InteractiveMapSection with SVG maps.
 * 
 * Both maps appear in the same location with similar styling.
 */
export default function MapSectionWrapper({
  rto,
  svgContent,
  districtMapping = {},
  svgDistrictIds = [],
  districtRTOsMap,
  districtRTOs = [],
}: MapSectionWrapperProps) {
  // Don't render if no district is available
  if (!rto.district) {
    return null;
  }

  // Check if OSM is enabled
  const useOSM = isOSMEnabled();

  if (useOSM) {
    // Render OSM map
    return (
      <div className="mt-8 flex flex-col items-center gap-3 relative">
        <div className="w-full max-w-md">
          <OSMDistrictMap
            state={rto.state}
            stateCode={rto.stateCode}
            district={rto.district}
            interactive={true}
            districtRTOsMap={districtRTOsMap}
            districtRTOs={districtRTOs}
            className="w-full h-64 md:h-72"
          />
        </div>
        <p className="text-xs text-[var(--muted-foreground)] opacity-70">
          Click on any district to explore its RTOs
        </p>
      </div>
    );
  }

  // Render SVG map (existing behavior)
  // Only render if SVG content exists
  if (!svgContent) {
    return null;
  }

  return (
    <InteractiveMapSection
      district={rto.district}
      svgContent={svgContent}
      districtMapping={districtMapping}
      svgDistrictIds={svgDistrictIds}
      districtRTOsMap={districtRTOsMap}
    />
  );
}
