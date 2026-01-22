import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getRTOCoordinates,
    loadAllCoordinatesForState,
    clearGeocodeCache,
    geocodeCity,
} from '@/lib/osm-geocoding';

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
const sampleStaticCoordinates = {
    generatedAt: '2024-01-22T00:00:00Z',
    state: 'Karnataka',
    rtoCount: 3,
    successCount: 3,
    failedRTOs: [],
    coordinates: {
        'KA-01': { lat: 12.9716, lon: 77.5946, displayName: 'Bengaluru, Karnataka, India' },
        'KA-02': { lat: 12.9141, lon: 74.8560, displayName: 'Mangaluru, Karnataka, India' },
        'KA-09': { lat: 12.2958, lon: 76.6394, displayName: 'Mysuru, Karnataka, India' },
    },
};

describe('osm-geocoding', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
        clearGeocodeCache();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getRTOCoordinates', () => {
        it('should fetch coordinates from static JSON file', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(sampleStaticCoordinates),
            });

            const result = await getRTOCoordinates('KA-01', 'Karnataka');

            expect(result).not.toBeNull();
            expect(result![0]).toBeCloseTo(12.9716, 4); // lat
            expect(result![1]).toBeCloseTo(77.5946, 4); // lon
            expect(mockFetch).toHaveBeenCalledWith('/data/karnataka/coordinates.json');
        });

        it('should return cached coordinates on subsequent calls', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(sampleStaticCoordinates),
            });

            // First call - fetches from network
            await getRTOCoordinates('KA-01', 'Karnataka');
            // Second call - should use cache
            const result = await getRTOCoordinates('KA-01', 'Karnataka');

            expect(result).not.toBeNull();
            expect(mockFetch).toHaveBeenCalledTimes(1); // Only one fetch
        });

        it('should normalize RTO code to uppercase', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(sampleStaticCoordinates),
            });

            const result = await getRTOCoordinates('ka-01', 'Karnataka');

            expect(result).not.toBeNull();
            expect(result![0]).toBeCloseTo(12.9716, 4);
        });

        it('should return null if coordinates file does not exist', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            const result = await getRTOCoordinates('XX-99', 'UnknownState');

            expect(result).toBeNull();
        });

        it('should return null if RTO not found in coordinates', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(sampleStaticCoordinates),
            });

            const result = await getRTOCoordinates('KA-99', 'Karnataka');

            expect(result).toBeNull();
        });

        it('should convert state name with spaces to folder name', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            await getRTOCoordinates('AP-01', 'Andhra Pradesh');

            expect(mockFetch).toHaveBeenCalledWith('/data/andhra-pradesh/coordinates.json');
        });

        it('should use localStorage as fallback when static file unavailable', async () => {
            // Simulate cached data in localStorage
            const cachedData = {
                lat: 15.3173,
                lon: 75.7139,
                timestamp: Date.now(),
            };
            localStorageMock.setItem('osm_geocode_ka-50', JSON.stringify(cachedData));

            // Static file not available
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            const result = await getRTOCoordinates('KA-50', 'Karnataka');

            expect(result).not.toBeNull();
            expect(result![0]).toBeCloseTo(15.3173, 4);
            expect(result![1]).toBeCloseTo(75.7139, 4);
        });
    });

    describe('loadAllCoordinatesForState', () => {
        it('should load all coordinates for a state', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(sampleStaticCoordinates),
            });

            const result = await loadAllCoordinatesForState('Karnataka');

            expect(result.size).toBe(3);
            expect(result.has('KA-01')).toBe(true);
            expect(result.has('KA-02')).toBe(true);
            expect(result.has('KA-09')).toBe(true);
        });

        it('should return empty map if state has no coordinates file', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            const result = await loadAllCoordinatesForState('UnknownState');

            expect(result.size).toBe(0);
        });

        it('should populate memory cache for subsequent calls', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(sampleStaticCoordinates),
            });

            await loadAllCoordinatesForState('Karnataka');

            // Now getRTOCoordinates should use cache
            const result = await getRTOCoordinates('KA-01', 'Karnataka');

            expect(result).not.toBeNull();
            expect(mockFetch).toHaveBeenCalledTimes(1); // Only one fetch for loadAll
        });
    });

    describe('geocodeCity (deprecated)', () => {
        it('should find coordinates by city name', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(sampleStaticCoordinates),
            });

            const result = await geocodeCity('Bengaluru', 'Bengaluru Urban', 'Karnataka');

            expect(result).not.toBeNull();
            expect(result![0]).toBeCloseTo(12.9716, 4);
        });

        it('should return null if city not found', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(sampleStaticCoordinates),
            });

            const result = await geocodeCity('UnknownCity', 'UnknownDistrict', 'Karnataka');

            expect(result).toBeNull();
        });
    });

    describe('clearGeocodeCache', () => {
        it('should clear all caches', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(sampleStaticCoordinates),
            });

            // Populate cache
            await getRTOCoordinates('KA-01', 'Karnataka');

            // Clear cache
            clearGeocodeCache();

            // Should need to fetch again
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(sampleStaticCoordinates),
            });

            await getRTOCoordinates('KA-01', 'Karnataka');

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });
});
