'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapContainer, TileLayer, GeoJSON, Tooltip, Marker, useMap } from 'react-leaflet';
import L, { type LatLngTuple, type Layer, type LeafletMouseEvent, type PathOptions, type LatLngBoundsExpression, type LatLngBounds } from 'leaflet';
import type { GeoJsonObject, Feature, FeatureCollection } from 'geojson';
import 'leaflet/dist/leaflet.css';
import { fetchDistrictBoundary, getCachedBoundary, type GeoJSONFeature, getBoundaryCenter } from '@/lib/osm-boundaries';
import { getRTOCoordinates } from '@/lib/osm-geocoding';

// Fix for default Leaflet marker icons not loading in webpack/bundler environments
// We use custom DivIcon markers, so we provide a transparent 1x1 pixel to prevent errors
const TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
// @ts-expect-error - Leaflet internal property
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: TRANSPARENT_PIXEL,
  iconRetinaUrl: TRANSPARENT_PIXEL,
  shadowUrl: TRANSPARENT_PIXEL,
});

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

/**
 * Component to control zoom behavior - positions map to show the current district.
 * Uses instant positioning on initial load (no animation since map just mounted).
 * Zooms toward the current RTO marker instead of district center.
 */
function ZoomToDistrictController({
  currentDistrictBoundary,
  currentRTOPosition,
}: {
  currentDistrictBoundary: GeoJSONFeature | null;
  currentRTOPosition: LatLngTuple | null;
}) {
  const map = useMap();
  const isUserPanning = useRef(false);
  const lastBoundaryId = useRef<string | null>(null);
  const hasInitialPositioned = useRef(false);

  // Use RTO position as zoom center, fall back to district center
  const zoomCenter = useMemo(() => {
    if (currentRTOPosition) {
      return currentRTOPosition;
    }
    if (currentDistrictBoundary) {
      return getBoundaryCenter(currentDistrictBoundary);
    }
    return null;
  }, [currentRTOPosition, currentDistrictBoundary]);

  // Generate a unique ID for the boundary to detect changes
  const boundaryId = useMemo(() => {
    if (!currentDistrictBoundary?.bbox) return null;
    return currentDistrictBoundary.bbox.join(',');
  }, [currentDistrictBoundary]);

  // Position map to district bounds
  useEffect(() => {
    if (!currentDistrictBoundary?.bbox) return;

    // Skip if this is the same boundary we already positioned to
    if (boundaryId === lastBoundaryId.current) return;

    const [minLon, minLat, maxLon, maxLat] = currentDistrictBoundary.bbox;
    const bounds: LatLngBounds = L.latLngBounds(
      [minLat, minLon],
      [maxLat, maxLon]
    );

    // On initial mount, use instant positioning (no animation)
    // The map just appeared, so animating from default position looks jarring
    if (!hasInitialPositioned.current) {
      map.fitBounds(bounds, {
        padding: [30, 30],
        maxZoom: 10,
        animate: false,
      });
      hasInitialPositioned.current = true;
    } else {
      // For subsequent changes (e.g., clicking districts), use smooth animation
      map.flyToBounds(bounds, {
        padding: [30, 30],
        maxZoom: 10,
        duration: 0.8,
      });
    }

    lastBoundaryId.current = boundaryId;
  }, [map, currentDistrictBoundary, boundaryId]);

  // Handle zoom controls - zoom toward current RTO instead of map center
  // We override the default zoom control behavior by intercepting clicks
  useEffect(() => {
    if (!zoomCenter) return;

    const handleDragStart = () => {
      isUserPanning.current = true;
    };

    const handleDragEnd = () => {
      setTimeout(() => {
        isUserPanning.current = false;
      }, 100);
    };

    // Override zoom control button clicks to zoom around RTO position
    const zoomInBtn = map.getContainer().querySelector('.leaflet-control-zoom-in');
    const zoomOutBtn = map.getContainer().querySelector('.leaflet-control-zoom-out');

    const handleZoomIn = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const targetLatLng = L.latLng(zoomCenter[0], zoomCenter[1]);
      map.setZoomAround(targetLatLng, map.getZoom() + 1, { animate: true });
    };

    const handleZoomOut = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const targetLatLng = L.latLng(zoomCenter[0], zoomCenter[1]);
      map.setZoomAround(targetLatLng, map.getZoom() - 1, { animate: true });
    };

    zoomInBtn?.addEventListener('click', handleZoomIn, { capture: true });
    zoomOutBtn?.addEventListener('click', handleZoomOut, { capture: true });

    map.on('dragstart', handleDragStart);
    map.on('dragend', handleDragEnd);

    return () => {
      zoomInBtn?.removeEventListener('click', handleZoomIn, { capture: true });
      zoomOutBtn?.removeEventListener('click', handleZoomOut, { capture: true });
      map.off('dragstart', handleDragStart);
      map.off('dragend', handleDragEnd);
    };
  }, [map, zoomCenter]);

  return null;
}

interface RTOInfo {
  code: string;
  region: string;
  isInactive?: boolean;
  isDistrictHeadquarter?: boolean;
}

/** RTO data for marker display - includes city info for geocoding */
interface RTOData {
  code: string;
  city: string;
  region: string;
  status?: 'active' | 'not-in-use' | 'discontinued';
  isDistrictHeadquarter?: boolean;
}

/** Marker position with RTO data */
interface MarkerData {
  rto: RTOData;
  coords: LatLngTuple;
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
  /** Mapping of OSM district names to normalized names used in RTO data */
  districtMapping?: Record<string, string>;
  /** The current district to highlight (e.g., district of the RTO being viewed) */
  currentDistrict?: string;
  /** RTOs within the current district for marker display */
  districtRTOs?: RTOData[];
  /** The code of the current RTO being viewed (for emphasis) */
  currentRTOCode?: string;
}

// Styles for district polygon
const defaultStyle: PathOptions = {
  fillColor: '#60a5fa', // Lighter blue for better visibility
  fillOpacity: 0.25,
  color: '#3b82f6', // Blue border
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

// Style for the current/highlighted district (persists regardless of hover)
const currentDistrictStyle: PathOptions = {
  fillColor: '#7c3aed', // Purple fill for emphasis
  fillOpacity: 0.5,
  color: '#6d28d9', // Darker purple border
  weight: 4,
};

// Style for current district on hover (slightly darker)
const currentDistrictHoverStyle: PathOptions = {
  fillColor: '#6d28d9',
  fillOpacity: 0.6,
  color: '#5b21b6',
  weight: 5,
};

// State center coordinates and zoom levels
const STATE_CONFIG: Record<string, { center: LatLngTuple; zoom: number; bounds?: LatLngBoundsExpression }> = {
  'Karnataka': {
    center: [15.3173, 75.7139],
    zoom: 6,
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
  districtMapping,
  currentDistrict,
  districtRTOs,
  currentRTOCode,
}: OSMStateMapProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(() => typeof window !== 'undefined');
  const [boundaries, setBoundaries] = useState<DistrictBoundaryData[]>([]);
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });
  const [boundaryErrors, setBoundaryErrors] = useState<string[]>([]);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [clickedDistrict, setClickedDistrict] = useState<string | null>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Marker state for RTOs in the current district
  const [markerPositions, setMarkerPositions] = useState<MarkerData[]>([]);
  const [loadingMarkers, setLoadingMarkers] = useState(false);

  const stateConfig = getStateConfig(state);

  /**
   * Normalize a district name using the districtMapping.
   * OSM might return "Bagalkote" but our RTO data uses "Bagalkot".
   */
  const normalizeDistrictName = useCallback((districtName: string): string => {
    if (!districtMapping) return districtName;
    // Check if there's a mapping for this exact name
    if (districtMapping[districtName]) {
      return districtMapping[districtName];
    }
    // Also try case-insensitive lookup
    const lowerName = districtName.toLowerCase();
    for (const [key, value] of Object.entries(districtMapping)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }
    return districtName;
  }, [districtMapping]);

  // Stabilize districts array - only use the string representation for dependency tracking
  const districtsKey = useMemo(() => districts.join(','), [districts]);

  // Ensure component only renders on client (Leaflet requires DOM)
  // Also cleanup click timeout on unmount
  useEffect(() => {
    // For SSR hydration: if not already mounted (server render), schedule mount
    if (!isMounted) {
      const timer = setTimeout(() => setIsMounted(true), 0);
      return () => clearTimeout(timer);
    }

    // Cleanup click timeout on unmount
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, [isMounted]);

  // Fetch all district boundaries - only when state changes, not on every render
  useEffect(() => {
    if (!isMounted || !districtsKey) return;

    const districtList = districtsKey.split(',');
    if (districtList.length === 0 || districtList[0] === '') return;


    // First, instantly load all cached boundaries (no async/delays)
    const cachedBoundaries: DistrictBoundaryData[] = [];
    const uncachedDistricts: string[] = [];

    for (const districtName of districtList) {
      const cached = getCachedBoundary(state, districtName);
      if (cached) {
        cachedBoundaries.push({ districtName, feature: cached });
      } else {
        uncachedDistricts.push(districtName);
      }
    }


    // If all districts are cached, we're done instantly
    if (uncachedDistricts.length === 0) {
      queueMicrotask(() => {
        setBoundaries(cachedBoundaries);
        setLoadingProgress({ loaded: districtList.length, total: districtList.length });
        setBoundaryErrors([]);
      });
      return;
    }

    // Set initial state with cached boundaries
    queueMicrotask(() => {
      setBoundaries(cachedBoundaries);
      setLoadingProgress({ loaded: cachedBoundaries.length, total: districtList.length });
      setBoundaryErrors([]);
    });

    let cancelled = false;
    const loadedBoundaries = [...cachedBoundaries];
    const errors: string[] = [];

    const fetchUncachedBoundaries = async () => {
      for (let i = 0; i < uncachedDistricts.length; i++) {
        if (cancelled) break;

        const districtName = uncachedDistricts[i];

        try {
          const feature = await fetchDistrictBoundary(state, districtName);

          if (feature && !cancelled) {
            loadedBoundaries.push({ districtName, feature });
            setBoundaries([...loadedBoundaries]);
          } else if (!feature) {
            errors.push(districtName);
          }
        } catch (err) {
          console.error(`[OSM] Error fetching ${districtName}:`, err);
          errors.push(districtName);
        }

        if (!cancelled) {
          setLoadingProgress({
            loaded: cachedBoundaries.length + i + 1,
            total: districtList.length
          });
        }

        // Small delay between API requests to respect rate limits
        if (i < uncachedDistricts.length - 1 && !cancelled) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (!cancelled) {
        setBoundaryErrors(errors);
      }
    };

    fetchUncachedBoundaries();

    return () => {
      cancelled = true;
    };

  }, [isMounted, state, districtsKey]);

  // Geocode RTO city locations for markers in current district
  useEffect(() => {
    if (!isMounted || !districtRTOs || districtRTOs.length === 0 || !currentDistrict) {
      queueMicrotask(() => setMarkerPositions([]));
      return;
    }

    let cancelled = false;
    queueMicrotask(() => setLoadingMarkers(true));

    const geocodeRTOs = async () => {
      const positions: MarkerData[] = [];

      for (const rto of districtRTOs) {
        if (cancelled) break;

        // Get coordinates by RTO code from static data
        const coords = await getRTOCoordinates(rto.code, state);

        if (coords) {
          // Offset overlapping markers (same city)
          const existingAtCity = positions.filter(
            p => p.rto.city.toLowerCase() === rto.city.toLowerCase()
          );

          let finalCoords = coords;
          if (existingAtCity.length > 0) {
            // Offset by small amount for visibility (~500m)
            const offset = existingAtCity.length * 0.005;
            finalCoords = [coords[0] + offset, coords[1] + offset];
          }

          positions.push({ rto, coords: finalCoords });
        }
      }

      if (!cancelled) {
        setMarkerPositions(positions);
        setLoadingMarkers(false);
      }
    };

    geocodeRTOs();

    return () => {
      cancelled = true;
    };
  }, [isMounted, districtRTOs, currentDistrict, state]);

  // Combine all boundaries into a FeatureCollection for rendering
  const featureCollection = useMemo((): FeatureCollection | null => {
    if (boundaries.length === 0) return null;


    return {
      type: 'FeatureCollection' as const,
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

  // Generate a stable key for GeoJSON based on actual content
  const geoJsonKey = useMemo(() => {
    return `${state}-${boundaries.map(b => b.districtName).sort().join(',')}`;
  }, [state, boundaries]);

  // Get the current district's boundary for zoom control
  const currentDistrictBoundary = useMemo((): GeoJSONFeature | null => {
    if (!currentDistrict || boundaries.length === 0) return null;

    const found = boundaries.find(b =>
      b.districtName.toLowerCase().trim() === currentDistrict.toLowerCase().trim()
    );

    return found?.feature || null;
  }, [boundaries, currentDistrict]);

  // Get the current RTO's position for zoom centering
  const currentRTOPosition = useMemo((): LatLngTuple | null => {
    if (!currentRTOCode || markerPositions.length === 0) return null;

    const currentMarker = markerPositions.find(m => m.rto.code === currentRTOCode);
    return currentMarker?.coords || null;
  }, [currentRTOCode, markerPositions]);

  /**
   * Create a Leaflet DivIcon for RTO markers.
   * Current RTO: larger, red/orange with pulsing animation
   * Other RTOs: smaller, blue secondary style
   */
  const createMarkerIcon = useCallback((rtoCode: string, isCurrentRTO: boolean, isInactive: boolean) => {
    const size = isCurrentRTO ? 32 : 24;
    const bgColor = isCurrentRTO
      ? '#ef4444' // Red for current
      : isInactive
        ? '#9ca3af' // Gray for inactive
        : '#3b82f6'; // Blue for active
    const borderColor = isCurrentRTO ? '#dc2626' : isInactive ? '#6b7280' : '#2563eb';
    const pulseAnimation = isCurrentRTO
      ? 'animation: pulse 2s infinite;'
      : '';

    return L.divIcon({
      className: 'custom-rto-marker',
      html: `
        <style>
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
        </style>
        <div style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${bgColor};
          border: 2px solid ${borderColor};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: ${isCurrentRTO ? '10px' : '8px'};
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ${pulseAnimation}
        ">
          ${rtoCode.split('-')[1] || ''}
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  }, []);

  /**
   * Handle click on RTO marker.
   * Only navigates for non-current RTOs.
   */
  const handleMarkerClick = useCallback((rtoCode: string) => {
    if (rtoCode === currentRTOCode) return;
    router.push(`/rto/${rtoCode.toLowerCase()}`);
  }, [currentRTOCode, router]);

  /**
   * Get the primary RTO for a district.
   * Prioritizes: 1) Active RTOs, 2) District headquarters, 3) First by code
   * Uses districtMapping to normalize OSM district names to RTO data names.
   */
  const getPrimaryRTO = useCallback((districtName: string): RTOInfo | null => {
    if (!districtRTOsMap) return null;

    // For OSM, try the exact district name first (matches RTO data)
    // Only fall back to normalized name if exact match fails
    let rtos = districtRTOsMap[districtName];

    if (!rtos || rtos.length === 0) {
      // Try case-insensitive match
      const lowerName = districtName.toLowerCase();
      for (const [key, value] of Object.entries(districtRTOsMap)) {
        if (key.toLowerCase() === lowerName) {
          rtos = value;
          break;
        }
      }
    }

    if (!rtos || rtos.length === 0) {
      // Try normalized name as last resort (for SVG ID mapping)
      const normalizedName = normalizeDistrictName(districtName);
      rtos = districtRTOsMap[normalizedName];
    }

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
  }, [districtRTOsMap, normalizeDistrictName]);

  /**
   * Get RTOs for a district, using direct name lookup first (for OSM compatibility).
   */
  const getDistrictRTOs = useCallback((districtName: string): RTOInfo[] => {
    if (!districtRTOsMap) return [];

    // Try exact match first
    let rtos = districtRTOsMap[districtName];

    if (!rtos || rtos.length === 0) {
      // Try case-insensitive match
      const lowerName = districtName.toLowerCase();
      for (const [key, value] of Object.entries(districtRTOsMap)) {
        if (key.toLowerCase() === lowerName) {
          return value;
        }
      }
    }

    if (!rtos || rtos.length === 0) {
      // Try normalized name as last resort
      const normalizedName = normalizeDistrictName(districtName);
      rtos = districtRTOsMap[normalizedName];
    }

    return rtos || [];
  }, [districtRTOsMap, normalizeDistrictName]);

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
   * Get style for a district based on current/hover/click state.
   * Current district always gets distinct styling regardless of hover.
   */
  const getDistrictStyle = useCallback((districtName: string): PathOptions => {
    // Normalize for case-insensitive comparison
    const isCurrentDistrict = currentDistrict &&
      districtName.toLowerCase().trim() === currentDistrict.toLowerCase().trim();

    if (clickedDistrict === districtName) {
      return clickStyle;
    }

    // Current district gets distinct persistent styling
    if (isCurrentDistrict) {
      if (hoveredDistrict === districtName) {
        return currentDistrictHoverStyle;
      }
      return currentDistrictStyle;
    }

    if (hoveredDistrict === districtName) {
      return hoverStyle;
    }
    return defaultStyle;
  }, [clickedDistrict, hoveredDistrict, currentDistrict]);

  // GeoJSON event handlers
  const onEachFeature = useCallback((feature: Feature, layer: Layer) => {
    const districtName = feature.properties?.districtName as string;
    if (!districtName) return;

    const styledLayer = layer as Layer & { setStyle: (s: PathOptions) => void };

    // Check if this is the current district (case-insensitive)
    const isCurrentDistrict = currentDistrict &&
      districtName.toLowerCase().trim() === currentDistrict.toLowerCase().trim();

    // Helper to safely apply style to a layer
    const safeSetStyle = (target: Layer, style: PathOptions) => {
      if (target && typeof (target as L.Path).setStyle === 'function') {
        (target as L.Path).setStyle(style);
      }
    };

    // Add hover and click events
    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        const target = e.target as Layer;
        if (clickedDistrict !== districtName) {
          safeSetStyle(target, isCurrentDistrict ? currentDistrictHoverStyle : hoverStyle);
        }
        setHoveredDistrict(districtName);
      },
      mouseout: (e: LeafletMouseEvent) => {
        const target = e.target as Layer;
        if (clickedDistrict !== districtName) {
          // Revert to appropriate style based on whether it's the current district
          safeSetStyle(target, isCurrentDistrict ? currentDistrictStyle : defaultStyle);
        }
        setHoveredDistrict(null);
      },
      click: () => {
        handleDistrictClick(districtName, styledLayer);
      },
    });
  }, [clickedDistrict, handleDistrictClick, currentDistrict]);

  // Style function for GeoJSON
  const styleFunction = useCallback((feature: Feature | undefined): PathOptions => {
    if (!feature || !feature.properties) return defaultStyle;
    const districtName = feature.properties.districtName as string;
    const style = getDistrictStyle(districtName);
    return style;
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

        {/* Controller to zoom toward current RTO */}
        <ZoomToDistrictController
          currentDistrictBoundary={currentDistrictBoundary}
          currentRTOPosition={currentRTOPosition}
        />

        {/* District boundaries GeoJSON layer */}
        {featureCollection && (
          <GeoJSON
            key={geoJsonKey}
            data={featureCollection as GeoJsonObject}
            style={styleFunction}
            onEachFeature={onEachFeature}
          >
            {/* Tooltip for each district */}
            <Tooltip sticky>
              {hoveredDistrict && (
                <div>
                  <span className="font-medium">{hoveredDistrict}</span>
                  {currentDistrict && hoveredDistrict.toLowerCase().trim() === currentDistrict.toLowerCase().trim() && (
                    <span className="block text-xs text-purple-500 font-medium mt-1">
                      Current district
                    </span>
                  )}
                  {(() => {
                    const rtos = getDistrictRTOs(hoveredDistrict);
                    return rtos.length > 0 && (
                      <span className="block text-xs text-gray-400 mt-1">
                        Click to explore {rtos.length} RTO{rtos.length !== 1 ? 's' : ''}
                      </span>
                    );
                  })()}
                </div>
              )}
            </Tooltip>
          </GeoJSON>
        )}

        {/* RTO markers within the current district */}
        {markerPositions.map(({ rto, coords }) => {
          const isCurrentRTO = rto.code === currentRTOCode;
          const isInactive = rto.status === 'not-in-use' || rto.status === 'discontinued';

          return (
            <Marker
              key={rto.code}
              position={coords}
              icon={createMarkerIcon(rto.code, isCurrentRTO, isInactive)}
              zIndexOffset={isCurrentRTO ? 1000 : 0}
              eventHandlers={{
                click: () => handleMarkerClick(rto.code),
              }}
            >
              <Tooltip direction="top" offset={[0, -12]}>
                <div>
                  <span className="font-bold">{rto.code}</span>
                  <span className="text-gray-500 ml-1">• {rto.city}</span>
                  {rto.region && rto.region !== rto.city && (
                    <span className="block text-xs text-gray-400">{rto.region}</span>
                  )}
                  {isCurrentRTO ? (
                    <span className="block text-xs text-red-500 font-medium mt-1">
                      Currently viewing
                    </span>
                  ) : (
                    <span className="block text-xs text-blue-500 mt-1">
                      Click to view
                    </span>
                  )}
                </div>
              </Tooltip>
            </Marker>
          );
        })}

        {/* Loading indicator for markers */}
        {loadingMarkers && (
          <div className="leaflet-top leaflet-right">
            <div className="leaflet-control bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-md text-xs text-gray-600 dark:text-gray-300">
              Loading markers...
            </div>
          </div>
        )}
      </MapContainer>

      {/* RTOs for hovered district (shown below the map) */}
      {hoveredDistrict && (() => {
        const rtos = getDistrictRTOs(hoveredDistrict);
        return rtos.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {rtos.map((rto) => (
              <Link
                key={rto.code}
                href={`/rto/${rto.code.toLowerCase()}`}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${rto.isInactive
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/40'
                  }`}
              >
                {rto.region}
              </Link>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
