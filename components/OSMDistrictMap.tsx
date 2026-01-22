'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapContainer, TileLayer, GeoJSON, Tooltip, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L, { type LatLngTuple, type LatLngBounds, type Layer, type LeafletMouseEvent, type PathOptions, type Icon, type DivIcon } from 'leaflet';
import type { GeoJsonObject, Feature } from 'geojson';
import 'leaflet/dist/leaflet.css';
import { fetchDistrictBoundary, type GeoJSONFeature, getBoundaryCenter } from '@/lib/osm-boundaries';
import { getRTOCoordinates } from '@/lib/osm-geocoding';
import type { RTOCode } from '@/types/rto';

/**
 * Component to fit the map view to the district boundary and keep zoom focused on district.
 * Uses useMap hook to access the map instance.
 */
function MapBoundsController({ boundary, center }: { boundary: GeoJSONFeature | null; center: LatLngTuple }) {
  const map = useMap();
  const hasInitialized = useRef(false);
  const isUserPanning = useRef(false);

  // Fit to boundary on first load
  useEffect(() => {
    if (boundary && boundary.bbox && !hasInitialized.current) {
      // bbox format: [minLon, minLat, maxLon, maxLat]
      const [minLon, minLat, maxLon, maxLat] = boundary.bbox;
      const bounds: LatLngBounds = L.latLngBounds(
        [minLat, minLon], // Southwest corner
        [maxLat, maxLon]  // Northeast corner
      );

      // Fit the map to the boundary with some padding
      map.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: 11,
        animate: true,
      });

      hasInitialized.current = true;
    }
  }, [map, boundary]);

  // Track when user is panning vs zooming
  useEffect(() => {
    const handleDragStart = () => {
      isUserPanning.current = true;
    };

    const handleDragEnd = () => {
      // Reset after a short delay
      setTimeout(() => {
        isUserPanning.current = false;
      }, 100);
    };

    // After zoom ends, recenter on district if user wasn't panning
    const handleZoomEnd = () => {
      if (!isUserPanning.current && hasInitialized.current) {
        const districtCenter = L.latLng(center[0], center[1]);
        const currentCenter = map.getCenter();

        // Only recenter if we're not already close to district center
        if (currentCenter.distanceTo(districtCenter) > 1000) {
          map.panTo(districtCenter, { animate: true, duration: 0.25 });
        }
      }
    };

    map.on('dragstart', handleDragStart);
    map.on('dragend', handleDragEnd);
    map.on('zoomend', handleZoomEnd);

    return () => {
      map.off('dragstart', handleDragStart);
      map.off('dragend', handleDragEnd);
      map.off('zoomend', handleZoomEnd);
    };
  }, [map, center]);

  return null;
}

/**
 * Loading spinner component for map loading states.
 * Uses a circular spinner with animate-spin for smooth animation.
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

interface RTOMarkerData {
  rto: RTOCode;
  position: LatLngTuple;
}

interface OSMDistrictMapProps {
  /** The state name (e.g., "Karnataka") */
  state: string;
  /** The state code (e.g., "KA") - used for fallback link to state page */
  stateCode?: string;
  /** The district name to center the map on */
  district: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to enable click-to-navigate functionality */
  interactive?: boolean;
  /** Map of district names to their RTOs (required for interactive mode) */
  districtRTOsMap?: Record<string, RTOInfo[]>;
  /** Array of all RTOs in the current district for marker display */
  districtRTOs?: RTOCode[];
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

// Default coordinates for Indian states (approximate center points)
const STATE_COORDINATES: Record<string, LatLngTuple> = {
  'Karnataka': [15.3173, 75.7139],
  'Goa': [15.2993, 74.1240],
  // Add more states as needed
};

// District coordinates cache (will be expanded in later user stories)
const DISTRICT_COORDINATES: Record<string, Record<string, LatLngTuple>> = {
  'Karnataka': {
    'Bengaluru Urban': [12.9716, 77.5946],
    'Bengaluru Rural': [13.1301, 77.4870],
    'Mysuru': [12.2958, 76.6394],
    'Mandya': [12.5218, 76.8951],
    'Hassan': [13.0068, 76.0996],
    'Chikkamagaluru': [13.3161, 75.7720],
    'Kodagu': [12.4218, 75.7388],
    'Dakshina Kannada': [12.8438, 75.2479],
    'Udupi': [13.3409, 74.7421],
    'Uttara Kannada': [14.6819, 74.4896],
    'Shivamogga': [13.9299, 75.5681],
    'Chitradurga': [14.2305, 76.3980],
    'Tumakuru': [13.3379, 77.1173],
    'Davanagere': [14.4644, 75.9218],
    'Belagavi': [15.8497, 74.4977],
    'Bagalkote': [16.1691, 75.6615],
    'Bagalkot': [16.1691, 75.6615],
    'Vijayapura': [16.8302, 75.7100],
    'Dharwad': [15.4589, 75.0078],
    'Gadag': [15.4314, 75.6355],
    'Haveri': [14.7951, 75.3991],
    'Ballari': [15.1394, 76.9214],
    'Raichur': [16.2076, 77.3463],
    'Koppal': [15.3476, 76.1551],
    'Kalaburagi': [17.3297, 76.8343],
    'Bidar': [17.9104, 77.5199],
    'Yadgir': [16.7701, 77.1380],
    'Kolar': [13.1360, 78.1292],
    'Chikkaballapur': [13.4355, 77.7315],
    'Chikkaballapura': [13.4355, 77.7315],
    'Ramanagara': [12.7238, 77.2809],
    'Chamarajanagar': [11.9236, 76.9437],
    'Vijayanagara': [15.3350, 76.4620],
  },
  'Goa': {
    'North Goa': [15.5469, 73.8225],
    'South Goa': [15.2000, 74.0500],
  },
};

/**
 * Get coordinates for a district within a state.
 * Falls back to state center if district not found.
 */
function getDistrictCoordinates(state: string, district: string): LatLngTuple {
  // Try to get district coordinates
  const stateDistricts = DISTRICT_COORDINATES[state];
  if (stateDistricts && stateDistricts[district]) {
    return stateDistricts[district];
  }

  // Fall back to state center
  if (STATE_COORDINATES[state]) {
    return STATE_COORDINATES[state];
  }

  // Ultimate fallback: center of India
  return [20.5937, 78.9629];
}

/**
 * Create a numbered marker icon using Leaflet's DivIcon
 * This avoids issues with default marker images not loading in Next.js
 */
function createNumberedIcon(number: number, isActive: boolean = true): DivIcon {
  const bgColor = isActive ? '#3b82f6' : '#9ca3af'; // Blue for active, gray for inactive
  const borderColor = isActive ? '#1d4ed8' : '#6b7280';

  return L.divIcon({
    className: 'custom-rto-marker',
    html: `
      <div style="
        background-color: ${bgColor};
        border: 2px solid ${borderColor};
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">${number}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

/**
 * Create the default Leaflet icon (fixes missing marker images in Next.js)
 */
function createDefaultIcon(): Icon {
  return L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

/**
 * Create a custom cluster icon showing the count of RTOs in the cluster
 */
function createClusterCustomIcon(cluster: { getChildCount: () => number }): DivIcon {
  const count = cluster.getChildCount();

  // Size and color based on cluster size
  let size = 36;
  let bgColor = '#3b82f6'; // blue-500
  let borderColor = '#1d4ed8'; // blue-700

  if (count >= 10) {
    size = 44;
    bgColor = '#8b5cf6'; // violet-500
    borderColor = '#6d28d9'; // violet-700
  } else if (count >= 5) {
    size = 40;
    bgColor = '#06b6d4'; // cyan-500
    borderColor = '#0891b2'; // cyan-600
  }

  return L.divIcon({
    html: `
      <div style="
        background-color: ${bgColor};
        border: 3px solid ${borderColor};
        border-radius: 50%;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${count >= 10 ? 14 : 13}px;
        box-shadow: 0 3px 6px rgba(0,0,0,0.3);
      ">${count}</div>
    `,
    className: 'custom-cluster-icon',
    iconSize: L.point(size, size),
    iconAnchor: L.point(size / 2, size / 2),
  });
}

/**
 * OSMDistrictMap - An interactive OpenStreetMap component for district visualization.
 * 
 * Displays an OSM map centered on the specified district with zoom/pan controls.
 * Fetches and displays district boundaries from Nominatim API with hover highlighting.
 * When interactive is true, clicking on a district navigates to the primary RTO.
 * Displays city/town markers for multi-RTO districts.
 * Uses free OSM tile servers and includes required attribution.
 */
export default function OSMDistrictMap({
  state,
  stateCode,
  district,
  className = '',
  interactive = false,
  districtRTOsMap,
  districtRTOs = [],
}: OSMDistrictMapProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [boundary, setBoundary] = useState<GeoJSONFeature | null>(null);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const [isLoadingBoundary, setIsLoadingBoundary] = useState(false);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [markers, setMarkers] = useState<RTOMarkerData[]>([]);
  const [isLoadingMarkers, setIsLoadingMarkers] = useState(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ensure component only renders on client (Leaflet requires DOM)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);

    // Cleanup click timeout on unmount
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  // Fetch district boundary
  useEffect(() => {
    if (!isMounted) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Setting loading state before async operation
    setIsLoadingBoundary(true);
    setBoundaryError(null);

    fetchDistrictBoundary(state, district)
      .then((feature) => {
        if (cancelled) return;
        if (feature) {
          setBoundary(feature);
        } else {
          setBoundaryError(`Could not load boundary for ${district}, ${state}`);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setBoundaryError('Failed to load district boundary. Please try again later.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingBoundary(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isMounted, state, district]);

  // Geocode and create markers for multi-RTO districts
  useEffect(() => {
    if (!isMounted || districtRTOs.length <= 1) {
      // Only show markers for districts with multiple RTOs
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Clearing markers when condition not met
      setMarkers([]);
      return;
    }

    let cancelled = false;
    setIsLoadingMarkers(true);

    const geocodeRTOs = async () => {
      const newMarkers: RTOMarkerData[] = [];

      // Sort RTOs by code to assign consistent numbers
      const sortedRTOs = [...districtRTOs].sort((a, b) => a.code.localeCompare(b.code));

      for (const rto of sortedRTOs) {
        if (cancelled) break;

        // Skip RTOs without city or that are discontinued
        if (!rto.city || rto.status === 'discontinued') continue;

        try {
          // Use RTO code for lookup - more reliable than city name matching
          const coords = await getRTOCoordinates(rto.code, state);
          if (coords && !cancelled) {
            // Add small offset for overlapping markers (same city)
            const existingInSameCity = newMarkers.filter(m => m.rto.city === rto.city);
            let position = coords;

            if (existingInSameCity.length > 0) {
              // Offset by a small amount for each marker in the same city
              const offset = 0.005 * existingInSameCity.length; // ~500m offset
              position = [coords[0] + offset, coords[1] + offset];
            }

            newMarkers.push({ rto, position });
          }
        } catch {
          // Continue with other RTOs if one fails
        }
      }

      if (!cancelled) {
        setMarkers(newMarkers);
        setIsLoadingMarkers(false);
      }
    };

    geocodeRTOs();

    return () => {
      cancelled = true;
    };
  }, [isMounted, districtRTOs, district, state]);

  // Memoize marker icons to prevent re-creation on each render
  const markerIcons = useMemo(() => {
    const icons: Map<string, DivIcon> = new Map();

    // Sort RTOs by code to assign consistent numbers
    const sortedRTOs = [...districtRTOs].sort((a, b) => a.code.localeCompare(b.code));

    sortedRTOs.forEach((rto, index) => {
      const isActive = rto.status !== 'not-in-use' && rto.status !== 'discontinued';
      icons.set(rto.code, createNumberedIcon(index + 1, isActive));
    });

    return icons;
  }, [districtRTOs]);

  // Handle marker click - navigate to RTO page
  const handleMarkerClick = useCallback((rtoCode: string) => {
    router.push(`/rto/${rtoCode.toLowerCase()}`);
  }, [router]);

  // Get coordinates - prefer boundary center, fall back to hardcoded
  const center = boundary
    ? getBoundaryCenter(boundary)
    : getDistrictCoordinates(state, district);

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
  const handleDistrictClick = useCallback((layer: Layer & { setStyle: (s: PathOptions) => void }) => {
    if (!interactive) return;

    const primaryRTO = getPrimaryRTO(district);
    if (!primaryRTO) return;

    // Show click visual feedback
    setIsClicked(true);
    layer.setStyle(clickStyle);

    // Clear any existing timeout
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    // Navigate after brief visual feedback (200ms)
    clickTimeoutRef.current = setTimeout(() => {
      router.push(`/rto/${primaryRTO.code.toLowerCase()}`);
    }, 200);
  }, [interactive, district, getPrimaryRTO, router]);

  // GeoJSON event handlers
  const onEachFeature = useCallback((feature: Feature, layer: Layer) => {
    const styledLayer = layer as Layer & { setStyle: (s: PathOptions) => void };

    // Add hover events
    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        const target = e.target as Layer & { setStyle: (s: PathOptions) => void };
        if (!isClicked) {
          target.setStyle(hoverStyle);
        }
        setIsHovered(true);
      },
      mouseout: (e: LeafletMouseEvent) => {
        const target = e.target as Layer & { setStyle: (s: PathOptions) => void };
        if (!isClicked) {
          target.setStyle(defaultStyle);
        }
        setIsHovered(false);
      },
      click: () => {
        handleDistrictClick(styledLayer);
      },
    });
  }, [isClicked, handleDistrictClick]);

  // Don't render on server side - show loading skeleton
  if (!isMounted) {
    return (
      <div className={`h-64 md:h-80 lg:h-96 bg-gray-200 dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center gap-3 ${className}`}>
        <LoadingSpinner size="lg" />
        <div className="text-gray-500 dark:text-gray-400 text-sm">Loading map...</div>
      </div>
    );
  }

  // Show error state if map completely fails to load (preserves layout)
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
        {stateCode && (
          <Link
            href={`/state/${stateCode.toLowerCase()}`}
            className="mt-2 px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
          >
            Browse all {state} RTOs
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={`h-64 md:h-80 lg:h-96 rounded-lg overflow-hidden relative ${className}`}>
      {/* Loading overlay with spinner for initial boundary load */}
      {isLoadingBoundary && !boundary && (
        <div className="absolute inset-0 z-[1000] bg-white/80 dark:bg-gray-900/80 flex flex-col items-center justify-center gap-2">
          <LoadingSpinner size="md" />
          <span className="text-sm text-gray-600 dark:text-gray-300">Loading district boundary...</span>
        </div>
      )}

      {/* Loading indicator for boundary (after initial load) */}
      {isLoadingBoundary && boundary && (
        <div className="absolute top-2 left-2 z-[1000] bg-white dark:bg-gray-800 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 shadow-md flex items-center gap-2">
          <LoadingSpinner size="sm" />
          <span>Updating...</span>
        </div>
      )}

      {/* Loading indicator for markers */}
      {isLoadingMarkers && districtRTOs.length > 1 && (
        <div className="absolute top-2 right-2 z-[1000] bg-white dark:bg-gray-800 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 shadow-md flex items-center gap-2">
          <LoadingSpinner size="sm" />
          <span>Loading markers...</span>
        </div>
      )}

      {/* Error message for boundary with fallback link */}
      {boundaryError && !isLoadingBoundary && (
        <div className="absolute top-2 left-2 right-2 z-[1000] bg-amber-50 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-700 px-3 py-2 rounded-lg shadow-md">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-700 dark:text-amber-300">{boundaryError}</p>
              {stateCode && (
                <Link
                  href={`/state/${stateCode.toLowerCase()}`}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                >
                  View all {state} RTOs →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={9}
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
              // Set error only if we haven't already loaded any tiles
              // This prevents showing error for individual tile failures
              setMapLoadError('Map tiles failed to load. Please check your internet connection.');
            },
          }}
        />

        {/* Controller to fit map to district boundary */}
        <MapBoundsController boundary={boundary} center={center} />

        {/* District boundary GeoJSON layer */}
        {boundary && (
          <GeoJSON
            key={`${state}-${district}-${isClicked}`}
            data={boundary as unknown as GeoJsonObject}
            style={isClicked ? clickStyle : (isHovered ? hoverStyle : defaultStyle)}
            onEachFeature={onEachFeature}
          >
            <Tooltip sticky>
              <span className="font-medium">{district}</span>
              <span className="text-gray-500 ml-1">({state})</span>
              {interactive && districtRTOsMap && districtRTOsMap[district] && (
                <span className="block text-xs text-gray-400 mt-1">
                  Click to explore {districtRTOsMap[district].length} RTO{districtRTOsMap[district].length !== 1 ? 's' : ''}
                </span>
              )}
            </Tooltip>
          </GeoJSON>
        )}

        {/* City/Town markers for multi-RTO districts with clustering */}
        {markers.length > 0 && (
          <MarkerClusterGroup
            chunkedLoading
            iconCreateFunction={createClusterCustomIcon}
            maxClusterRadius={50}
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
            zoomToBoundsOnClick={true}
            disableClusteringAtZoom={13}
          >
            {markers.map((markerData) => {
              const icon = markerIcons.get(markerData.rto.code) || createDefaultIcon();
              const isActive = markerData.rto.status !== 'not-in-use' && markerData.rto.status !== 'discontinued';

              return (
                <Marker
                  key={markerData.rto.code}
                  position={markerData.position}
                  icon={icon}
                  eventHandlers={{
                    click: () => handleMarkerClick(markerData.rto.code),
                  }}
                >
                  <Popup>
                    <div className="text-center">
                      <div className="font-bold text-blue-600">{markerData.rto.code}</div>
                      <div className="text-sm font-medium">{markerData.rto.city}</div>
                      <div className="text-xs text-gray-500">{markerData.rto.region}</div>
                      {!isActive && (
                        <div className="text-xs text-amber-600 mt-1">
                          {markerData.rto.status === 'not-in-use' ? 'Not in use' : 'Discontinued'}
                        </div>
                      )}
                      <button
                        onClick={() => handleMarkerClick(markerData.rto.code)}
                        className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                      >
                        View Details
                      </button>
                    </div>
                  </Popup>
                  <Tooltip>
                    <span className="font-medium">{markerData.rto.code}</span>
                    <span className="text-gray-500 ml-1">- {markerData.rto.city}</span>
                  </Tooltip>
                </Marker>
              );
            })}
          </MarkerClusterGroup>
        )}
      </MapContainer>
    </div>
  );
}
