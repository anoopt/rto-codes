'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapContainer, TileLayer, GeoJSON, Tooltip } from 'react-leaflet';
import { type LatLngTuple, type Layer, type LeafletMouseEvent, type PathOptions, type LatLngBoundsExpression } from 'leaflet';
import type { GeoJsonObject, Feature, FeatureCollection } from 'geojson';
import 'leaflet/dist/leaflet.css';
import { fetchDistrictBoundary, type GeoJSONFeature } from '@/lib/osm-boundaries';

/**
 * Loading spinner component for map loading states.
 */
function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };
  
  return (
    <div 
      className={`${sizeClasses[size]} border-blue-200 border-t-blue-600 rounded-full animate-spin`}
      role="status"
      aria-label="Loading"
    />
  );
}

interface RTOInfo {
  code: string;
  region: string;
  isInactive?: boolean;
  isDistrictHeadquarter?: boolean;
}

interface OSMStateMapProps {
  /** The state name (e.g., "Karnataka") */
  state: string;
  /** The state code (e.g., "KA") - used for URLs and navigation */
  stateCode: string;
  /** List of district names in the state */
  districts: string[];
  /** Additional CSS classes */
  className?: string;
  /** Map of district names to their RTOs (for click navigation) */
  districtRTOsMap?: Record<string, RTOInfo[]>;
}

// Styles for district polygon
const defaultStyle: PathOptions = {
  fillColor: '#3b82f6',
  fillOpacity: 0.2,
  color: '#2563eb',
  weight: 2,
};

const hoverStyle: PathOptions = {
  fillColor: '#2563eb',
  fillOpacity: 0.4,
  color: '#1d4ed8',
  weight: 3,
};

const clickStyle: PathOptions = {
  fillColor: '#16a34a',
  fillOpacity: 0.5,
  color: '#15803d',
  weight: 4,
};

// State center coordinates and zoom levels
const STATE_CONFIG: Record<string, { center: LatLngTuple; zoom: number; bounds?: LatLngBoundsExpression }> = {
  'Karnataka': {
    center: [15.3173, 75.7139],
    zoom: 7,
    bounds: [[11.5, 74.0], [18.5, 78.5]],
  },
  'Goa': {
    center: [15.2993, 74.1240],
    zoom: 9,
    bounds: [[14.8, 73.6], [15.8, 74.5]],
  },
  // Add more states as needed
};

// Default India config for unlisted states
const DEFAULT_CONFIG = {
  center: [20.5937, 78.9629] as LatLngTuple,
  zoom: 6,
};

/**
 * Get the appropriate zoom level and center for a state
 */
function getStateConfig(state: string): { center: LatLngTuple; zoom: number; bounds?: LatLngBoundsExpression } {
  return STATE_CONFIG[state] || { ...DEFAULT_CONFIG };
}

interface DistrictBoundaryData {
  districtName: string;
  feature: GeoJSONFeature;
}

/**
 * OSMStateMap - An interactive OpenStreetMap component for state-level visualization.
 * 
 * Displays an OSM map showing all districts in a state with zoom/pan controls.
 * Fetches and displays district boundaries from Nominatim API.
 * Districts are clickable polygons that navigate to the RTO page.
 * Uses free OSM tile servers and includes required attribution.
 */
export default function OSMStateMap({
  state,
  stateCode,
  districts,
  className = '',
  districtRTOsMap,
}: OSMStateMapProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [boundaries, setBoundaries] = useState<DistrictBoundaryData[]>([]);
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });
  const [boundaryErrors, setBoundaryErrors] = useState<string[]>([]);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [clickedDistrict, setClickedDistrict] = useState<string | null>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stateConfig = getStateConfig(state);

  // Ensure component only renders on client (Leaflet requires DOM)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Required for client-side mounting
    setIsMounted(true);
    
    // Cleanup click timeout on unmount
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  // Fetch all district boundaries
  useEffect(() => {
    if (!isMounted || districts.length === 0) return;

    let cancelled = false;
    const loadedBoundaries: DistrictBoundaryData[] = [];
    const errors: string[] = [];
    
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Setting initial loading state before async fetch
    setLoadingProgress({ loaded: 0, total: districts.length });
    setBoundaryErrors([]);

    const fetchAllBoundaries = async () => {
      for (let i = 0; i < districts.length; i++) {
        if (cancelled) break;
        
        const districtName = districts[i];
        
        try {
          const feature = await fetchDistrictBoundary(state, districtName);
          
          if (feature && !cancelled) {
            loadedBoundaries.push({ districtName, feature });
            setBoundaries([...loadedBoundaries]);
          } else if (!feature) {
            errors.push(districtName);
          }
        } catch {
          errors.push(districtName);
        }
        
        if (!cancelled) {
          setLoadingProgress({ loaded: i + 1, total: districts.length });
        }
        
        // Small delay between requests to respect rate limits
        if (i < districts.length - 1 && !cancelled) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      if (!cancelled) {
        setBoundaryErrors(errors);
      }
    };

    fetchAllBoundaries();

    return () => {
      cancelled = true;
    };
  }, [isMounted, state, districts]);

  // Combine all boundaries into a FeatureCollection for rendering
  const featureCollection = useMemo((): FeatureCollection | null => {
    if (boundaries.length === 0) return null;
    
    return {
      type: 'FeatureCollection',
      features: boundaries.map(b => ({
        type: 'Feature' as const,
        properties: {
          ...b.feature.properties,
          districtName: b.districtName,
        },
        geometry: b.feature.geometry as Feature['geometry'],
        bbox: b.feature.bbox,
      })),
    };
  }, [boundaries]);

  /**
   * Get the primary RTO for a district.
   * Prioritizes: 1) Active RTOs, 2) District headquarters, 3) First by code
   */
  const getPrimaryRTO = useCallback((districtName: string): RTOInfo | null => {
    if (!districtRTOsMap) return null;
    
    const rtos = districtRTOsMap[districtName];
    if (!rtos || rtos.length === 0) return null;

    // Sort RTOs to find the primary one
    const sortedRTOs = [...rtos].sort((a, b) => {
      // 1. Prioritize active RTOs
      if (!a.isInactive && b.isInactive) return -1;
      if (a.isInactive && !b.isInactive) return 1;

      // 2. Prioritize district headquarters
      if (a.isDistrictHeadquarter && !b.isDistrictHeadquarter) return -1;
      if (!a.isDistrictHeadquarter && b.isDistrictHeadquarter) return 1;

      // 3. Sort by code
      return a.code.localeCompare(b.code);
    });

    return sortedRTOs[0];
  }, [districtRTOsMap]);

  /**
   * Handle click on district polygon.
   * Shows visual feedback and navigates to the primary RTO.
   */
  const handleDistrictClick = useCallback((districtName: string, layer: Layer & { setStyle: (s: PathOptions) => void }) => {
    const primaryRTO = getPrimaryRTO(districtName);
    if (!primaryRTO) return;

    // Show click visual feedback
    setClickedDistrict(districtName);
    layer.setStyle(clickStyle);

    // Clear any existing timeout
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    // Navigate after brief visual feedback (200ms)
    clickTimeoutRef.current = setTimeout(() => {
      router.push(`/rto/${primaryRTO.code.toLowerCase()}`);
    }, 200);
  }, [getPrimaryRTO, router]);

  /**
   * Get style for a district based on hover/click state
   */
  const getDistrictStyle = useCallback((districtName: string): PathOptions => {
    if (clickedDistrict === districtName) {
      return clickStyle;
    }
    if (hoveredDistrict === districtName) {
      return hoverStyle;
    }
    return defaultStyle;
  }, [clickedDistrict, hoveredDistrict]);

  // GeoJSON event handlers
  const onEachFeature = useCallback((feature: Feature, layer: Layer) => {
    const districtName = feature.properties?.districtName as string;
    if (!districtName) return;

    const styledLayer = layer as Layer & { setStyle: (s: PathOptions) => void };
    
    // Add hover and click events
    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        const target = e.target as Layer & { setStyle: (s: PathOptions) => void };
        if (clickedDistrict !== districtName) {
          target.setStyle(hoverStyle);
        }
        setHoveredDistrict(districtName);
      },
      mouseout: (e: LeafletMouseEvent) => {
        const target = e.target as Layer & { setStyle: (s: PathOptions) => void };
        if (clickedDistrict !== districtName) {
          target.setStyle(defaultStyle);
        }
        setHoveredDistrict(null);
      },
      click: () => {
        handleDistrictClick(districtName, styledLayer);
      },
    });
  }, [clickedDistrict, handleDistrictClick]);

  // Style function for GeoJSON
  const styleFunction = useCallback((feature: Feature | undefined): PathOptions => {
    if (!feature || !feature.properties) return defaultStyle;
    const districtName = feature.properties.districtName as string;
    return getDistrictStyle(districtName);
  }, [getDistrictStyle]);

  // Don't render on server side - show loading skeleton
  if (!isMounted) {
    return (
      <div className={`h-64 md:h-80 lg:h-96 bg-gray-200 dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center gap-3 ${className}`}>
        <LoadingSpinner size="lg" />
        <div className="text-gray-500 dark:text-gray-400 text-sm">Loading map...</div>
      </div>
    );
  }

  // Show error state if map completely fails to load
  if (mapLoadError) {
    return (
      <div className={`h-64 md:h-80 lg:h-96 bg-gray-100 dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center gap-3 p-4 ${className}`}>
        <div className="text-red-500 dark:text-red-400">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300 font-medium">Unable to load map</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{mapLoadError}</p>
        </div>
        <Link 
          href={`/state/${stateCode.toLowerCase()}`}
          className="mt-2 px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
        >
          Browse all {state} RTOs
        </Link>
      </div>
    );
  }

  const isLoading = loadingProgress.loaded < loadingProgress.total;

  return (
    <div className={`h-64 md:h-80 lg:h-96 rounded-lg overflow-hidden relative ${className}`}>
      {/* Loading overlay with progress */}
      {isLoading && boundaries.length === 0 && (
        <div className="absolute inset-0 z-[1000] bg-white/80 dark:bg-gray-900/80 flex flex-col items-center justify-center gap-2">
          <LoadingSpinner size="md" />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Loading districts ({loadingProgress.loaded}/{loadingProgress.total})...
          </span>
        </div>
      )}
      
      {/* Loading progress indicator (after initial load) */}
      {isLoading && boundaries.length > 0 && (
        <div className="absolute top-2 left-2 z-[1000] bg-white dark:bg-gray-800 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 shadow-md flex items-center gap-2">
          <LoadingSpinner size="sm" />
          <span>Loading districts ({loadingProgress.loaded}/{loadingProgress.total})</span>
        </div>
      )}
      
      {/* Warning for failed boundaries */}
      {!isLoading && boundaryErrors.length > 0 && (
        <div className="absolute top-2 left-2 right-2 z-[1000] bg-amber-50 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-700 px-3 py-2 rounded-lg shadow-md">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Could not load {boundaryErrors.length} district{boundaryErrors.length !== 1 ? 's' : ''}: {boundaryErrors.slice(0, 3).join(', ')}{boundaryErrors.length > 3 ? '...' : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      <MapContainer
        center={stateConfig.center}
        zoom={stateConfig.zoom}
        bounds={stateConfig.bounds}
        // Zoom controls
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        // Pan controls
        dragging={true}
        // Mobile touch gestures
        touchZoom={true}
        className="h-full w-full"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: () => {
              setMapLoadError('Map tiles failed to load. Please check your internet connection.');
            },
          }}
        />
        
        {/* District boundaries GeoJSON layer */}
        {featureCollection && (
          <GeoJSON
            key={`${state}-${boundaries.length}-${clickedDistrict}-${hoveredDistrict}`}
            data={featureCollection as GeoJsonObject}
            style={styleFunction}
            onEachFeature={onEachFeature}
          >
            {/* Tooltip for each district */}
            <Tooltip sticky>
              {hoveredDistrict && (
                <div>
                  <span className="font-medium">{hoveredDistrict}</span>
                  {districtRTOsMap && districtRTOsMap[hoveredDistrict] && (
                    <span className="block text-xs text-gray-400 mt-1">
                      Click to explore {districtRTOsMap[hoveredDistrict].length} RTO{districtRTOsMap[hoveredDistrict].length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </Tooltip>
          </GeoJSON>
        )}
      </MapContainer>
    </div>
  );
}
