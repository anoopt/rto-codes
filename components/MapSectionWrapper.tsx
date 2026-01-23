'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { isOSMEnabledForState } from '@/lib/feature-flags';
import type { RTOCode } from '@/types/rto';

// Dynamically import OSMStateMap with SSR disabled (Leaflet requires DOM)
const OSMStateMap = dynamic(() => import('@/components/OSMStateMap'), {
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

/** RTO data for OSM markers - simplified version with required fields */
interface RTOData {
  code: string;
  city: string;
  region: string;
  status?: 'active' | 'not-in-use' | 'discontinued';
  isDistrictHeadquarter?: boolean;
}

interface MapSectionWrapperProps {
  /** The current RTO data */
  rto: {
    code: string;
    state: string;
    stateCode: string;
    district?: string;
  };
  /** District mapping - keys are district names used for OSM */
  districtMapping?: Record<string, string>;
  /** Map of district names to their RTOs */
  districtRTOsMap?: Record<string, RTOInfo[]>;
  /** Array of all RTOs in the current district (for OSM map markers) */
  districtRTOs?: RTOCode[];
  /** Whether OSM is enabled for this state (from state config) */
  osmEnabled?: boolean;
}

/**
 * MapSectionWrapper - Renders OSM district map when enabled for the state.
 * 
 * Shows the map only when:
 * - NEXT_PUBLIC_OSM_ENABLED is true (global flag)
 * - State config has osmEnabled: true
 */
export default function MapSectionWrapper({
  rto,
  districtMapping = {},
  districtRTOsMap,
  districtRTOs = [],
  osmEnabled,
}: MapSectionWrapperProps) {
  // Don't render if no district is available
  if (!rto.district) {
    return null;
  }

  // Check if OSM is enabled globally AND for this state
  if (!isOSMEnabledForState(osmEnabled)) {
    return null;
  }

  // Get all district names from the districtMapping keys
  const districts = Object.keys(districtMapping);

  // Convert RTOCode[] to RTOData[] for OSMStateMap markers
  const rtoDataList: RTOData[] = districtRTOs.map(rtoItem => ({
    code: rtoItem.code,
    city: rtoItem.city,
    region: rtoItem.region,
    status: rtoItem.status,
    isDistrictHeadquarter: rtoItem.isDistrictHeadquarter,
  }));

  // Sort district RTOs by code number for the legend grid
  const sortedDistrictRTOs = [...districtRTOs].sort((a, b) => {
    const numA = parseInt(a.code.split('-')[1], 10);
    const numB = parseInt(b.code.split('-')[1], 10);
    return numA - numB;
  });

  // Prevent touch events from bubbling up to SwipeHandler
  // This allows map panning without triggering page navigation
  const handleTouchEvent = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="mt-8 flex flex-col items-center gap-3 relative"
      onTouchStart={handleTouchEvent}
      onTouchMove={handleTouchEvent}
      onTouchEnd={handleTouchEvent}
    >
      <div className="w-full max-w-md">
        <OSMStateMap
          state={rto.state}
          stateCode={rto.stateCode}
          districts={districts}
          districtRTOsMap={districtRTOsMap}
          districtMapping={districtMapping}
          currentDistrict={rto.district}
          districtRTOs={rtoDataList}
          currentRTOCode={rto.code}
          className="w-full h-64 md:h-72"
        />
      </div>

      {/* District RTOs Legend Grid */}
      {sortedDistrictRTOs.length > 1 && (
        <div className="w-full max-w-md mt-2">
          <p className="text-xs text-[var(--muted-foreground)] mb-2 text-center">
            RTOs in {rto.district}
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {sortedDistrictRTOs.map((rtoItem) => {
              const rtoNumber = rtoItem.code.split('-')[1];
              const isCurrent = rtoItem.code === rto.code;
              const isInactive = rtoItem.status === 'not-in-use' || rtoItem.status === 'discontinued';

              return (
                <Link
                  key={rtoItem.code}
                  href={`/rto/${rtoItem.code.toLowerCase()}`}
                  className={`
                    inline-flex items-center justify-center
                    min-w-[2.5rem] px-2 py-1 rounded-md text-sm font-medium
                    transition-all duration-200
                    ${isCurrent
                      ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400 ring-offset-1 ring-offset-[var(--card)]'
                      : isInactive
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                        : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-400'
                    }
                  `}
                  title={`${rtoItem.code} - ${rtoItem.region}`}
                >
                  {rtoNumber}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--muted-foreground)] opacity-70">
        Click on any district to explore its RTOs
      </p>
    </div>
  );
}
