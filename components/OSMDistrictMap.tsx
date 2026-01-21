'use client';

import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, Tooltip } from 'react-leaflet';
import type { LatLngTuple, Layer, LeafletMouseEvent, PathOptions } from 'leaflet';
import type { GeoJsonObject, Feature } from 'geojson';
import 'leaflet/dist/leaflet.css';
import { fetchDistrictBoundary, type GeoJSONFeature, getBoundaryCenter } from '@/lib/osm-boundaries';

interface OSMDistrictMapProps {
  /** The state name (e.g., "Karnataka") */
  state: string;
  /** The district name to center the map on */
  district: string;
  /** Additional CSS classes */
  className?: string;
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
 * OSMDistrictMap - An interactive OpenStreetMap component for district visualization.
 * 
 * Displays an OSM map centered on the specified district with zoom/pan controls.
 * Fetches and displays district boundaries from Nominatim API with hover highlighting.
 * Uses free OSM tile servers and includes required attribution.
 */
export default function OSMDistrictMap({
  state,
  district,
  className = '',
}: OSMDistrictMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [boundary, setBoundary] = useState<GeoJSONFeature | null>(null);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const [isLoadingBoundary, setIsLoadingBoundary] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Ensure component only renders on client (Leaflet requires DOM)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
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

  // Get coordinates - prefer boundary center, fall back to hardcoded
  const center = boundary 
    ? getBoundaryCenter(boundary) 
    : getDistrictCoordinates(state, district);

  // GeoJSON event handlers
  const onEachFeature = useCallback((feature: Feature, layer: Layer) => {
    // Add hover events
    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        const target = e.target as Layer & { setStyle: (s: PathOptions) => void };
        target.setStyle(hoverStyle);
        setIsHovered(true);
      },
      mouseout: (e: LeafletMouseEvent) => {
        const target = e.target as Layer & { setStyle: (s: PathOptions) => void };
        target.setStyle(defaultStyle);
        setIsHovered(false);
      },
    });
  }, []);

  // Don't render on server side
  if (!isMounted) {
    return (
      <div className={`h-64 md:h-80 lg:h-96 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-gray-500 dark:text-gray-400">Loading map...</div>
      </div>
    );
  }

  return (
    <div className={`h-64 md:h-80 lg:h-96 rounded-lg overflow-hidden relative ${className}`}>
      {/* Loading indicator for boundary */}
      {isLoadingBoundary && (
        <div className="absolute top-2 left-2 z-[1000] bg-white dark:bg-gray-800 px-2 py-1 rounded text-sm text-gray-600 dark:text-gray-300 shadow">
          Loading boundary...
        </div>
      )}
      
      {/* Error message for boundary */}
      {boundaryError && !isLoadingBoundary && (
        <div className="absolute top-2 left-2 z-[1000] bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded text-sm text-amber-700 dark:text-amber-300 shadow max-w-[200px]">
          {boundaryError}
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
        />
        
        {/* District boundary GeoJSON layer */}
        {boundary && (
          <GeoJSON
            key={`${state}-${district}`}
            data={boundary as unknown as GeoJsonObject}
            style={isHovered ? hoverStyle : defaultStyle}
            onEachFeature={onEachFeature}
          >
            <Tooltip sticky>
              <span className="font-medium">{district}</span>
              <span className="text-gray-500 ml-1">({state})</span>
            </Tooltip>
          </GeoJSON>
        )}
      </MapContainer>
    </div>
  );
}
