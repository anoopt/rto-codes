import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    fetchDistrictBoundary,
    loadAllBoundariesForState,
    getBoundaryCenter,
    getCachedBoundary,
    clearBoundaryCache,
    type GeoJSONFeature,
} from '@/lib/osm-boundaries';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        get length() { return Object.keys(store).length; },
        key: vi.fn((i: number) => Object.keys(store)[i] || null),
    };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Sample test data
const sampleFeature: GeoJSONFeature = {
    type: 'Feature',
    properties: {
        name: 'Bengaluru Urban',
        districtName: 'Bengaluru Urban',
        osm_id: 12345,
    },
    geometry: {
        type: 'Polygon',
        coordinates: [[[77.5, 12.9], [77.7, 12.9], [77.7, 13.1], [77.5, 13.1], [77.5, 12.9]]],
    },
    bbox: [77.5, 12.9, 77.7, 13.1],
};

const sampleStaticBoundaries = {
    type: 'FeatureCollection',
    generatedAt: '2024-01-22T00:00:00Z',
    state: 'Karnataka',
    districtCount: 1,
    successCount: 1,
    failedDistricts: [],
    features: [sampleFeature],
};

describe('osm-boundaries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
        clearBoundaryCache();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchDistrictBoundary', () => {
        it('should fetch boundary from static JSON file', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(sampleStaticBoundaries),
            });

            const result = await fetchDistrictBoundary('Karnataka', 'Bengaluru Urban');

            expect(result).not.toBeNull();
            expect(result?.properties.name).toBe('Bengaluru Urban');
            expect(mockFetch).toHaveBeenCalledWith('/data/karnataka/boundaries.json');
        });

        it('should return cached boundary on subsequent calls', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(sampleStaticBoundaries),
            });

            // First call - fetches from network
            await fetchDistrictBoundary('Karnataka', 'Bengaluru Urban');
            // Second call - should use cache
            const result = await fetchDistrictBoundary('Karnataka', 'Bengaluru Urban');

            expect(result).not.toBeNull();
            expect(mockFetch).toHaveBeenCalledTimes(1); // Only one fetch
        });

        it('should return null if boundary file does not exist', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            const result = await fetchDistrictBoundary('UnknownState', 'UnknownDistrict');

            expect(result).toBeNull();
        });

        it('should return null if district not found in boundaries', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(sampleStaticBoundaries),
            });

            const result = await fetchDistrictBoundary('Karnataka', 'NonexistentDistrict');

            expect(result).toBeNull();
        });

        it('should convert state name with spaces to folder name', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            await fetchDistrictBoundary('Andhra Pradesh', 'SomeDistrict');

            expect(mockFetch).toHaveBeenCalledWith('/data/andhra-pradesh/boundaries.json');
        });
    });

    describe('loadAllBoundariesForState', () => {
        it('should load all boundaries for a state', async () => {
            const multipleBoundaries = {
                ...sampleStaticBoundaries,
                districtCount: 2,
                features: [
                    sampleFeature,
                    { ...sampleFeature, properties: { name: 'Mysuru', districtName: 'Mysuru' } },
                ],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(multipleBoundaries),
            });

            const result = await loadAllBoundariesForState('Karnataka');

            expect(result.size).toBe(2);
            expect(result.has('Bengaluru Urban')).toBe(true);
            expect(result.has('Mysuru')).toBe(true);
        });

        it('should return empty map if state has no boundaries file', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            const result = await loadAllBoundariesForState('UnknownState');

            expect(result.size).toBe(0);
        });
    });

    describe('getBoundaryCenter', () => {
        it('should return center from bbox if available', () => {
            const result = getBoundaryCenter(sampleFeature);

            // bbox: [77.5, 12.9, 77.7, 13.1] => center: [13.0, 77.6]
            expect(result[0]).toBeCloseTo(13.0, 1); // lat
            expect(result[1]).toBeCloseTo(77.6, 1); // lon
        });

        it('should calculate center from coordinates if no bbox', () => {
            const featureWithoutBbox: GeoJSONFeature = {
                type: 'Feature',
                properties: { name: 'Test' },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[77.5, 12.9], [77.7, 12.9], [77.7, 13.1], [77.5, 13.1], [77.5, 12.9]]],
                },
            };

            const result = getBoundaryCenter(featureWithoutBbox);

            // Should be approximate center of the polygon
            expect(result[0]).toBeGreaterThan(12.8);
            expect(result[0]).toBeLessThan(13.2);
            expect(result[1]).toBeGreaterThan(77.4);
            expect(result[1]).toBeLessThan(77.8);
        });

        it('should return India center as fallback', () => {
            const emptyFeature: GeoJSONFeature = {
                type: 'Feature',
                properties: { name: 'Empty' },
                geometry: {
                    type: 'Polygon',
                    coordinates: [],
                },
            };

            const result = getBoundaryCenter(emptyFeature);

            expect(result[0]).toBeCloseTo(20.5937, 1); // India center lat
            expect(result[1]).toBeCloseTo(78.9629, 1); // India center lon
        });
    });

    describe('getCachedBoundary', () => {
        it('should return null when not cached', () => {
            const result = getCachedBoundary('Karnataka', 'SomeDistrict');

            expect(result).toBeNull();
        });

        it('should return boundary from memory cache after fetch', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(sampleStaticBoundaries),
            });

            // Fetch first to populate cache
            await fetchDistrictBoundary('Karnataka', 'Bengaluru Urban');

            // Now getCachedBoundary should work
            const result = getCachedBoundary('Karnataka', 'Bengaluru Urban');

            expect(result).not.toBeNull();
            expect(result?.properties.name).toBe('Bengaluru Urban');
        });
    });

    describe('clearBoundaryCache', () => {
        it('should clear memory cache and static boundaries cache', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(sampleStaticBoundaries),
            });

            // Populate cache by fetching
            await fetchDistrictBoundary('Karnataka', 'Bengaluru Urban');
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Fetch again - should use cache, no new network call
            await fetchDistrictBoundary('Karnataka', 'Bengaluru Urban');
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Clear all caches
            clearBoundaryCache();
            localStorageMock.clear(); // Also clear localStorage mock

            // Setup mock for new fetch
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(sampleStaticBoundaries),
            });

            // After clear, fetching should make a new network request
            await fetchDistrictBoundary('Karnataka', 'Bengaluru Urban');
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });
});
