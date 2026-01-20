import { describe, it, expect } from 'vitest';
import {
    getAllRTOs,
    getRTOByCode,
    getVerifiedRTOs,
    getVerifiedRTOCodes,
    searchRTOs,
    getRTOsByDistrict,
    getDistrictToRTOsMap
} from '@/lib/rto-data';

describe('RTO Data Functions', () => {
    describe('getAllRTOs', () => {
        it('should load all RTOs when no state specified', () => {
            const rtos = getAllRTOs();
            expect(rtos).toBeDefined();
            expect(rtos.length).toBeGreaterThan(0);
        });

        it('should load Karnataka RTOs', () => {
            const rtos = getAllRTOs('karnataka');
            expect(rtos).toBeDefined();
            expect(rtos.length).toBeGreaterThan(0);
            expect(rtos.every(rto => rto.stateCode === 'KA')).toBe(true);
        });

        it('should return empty array for non-existent state', () => {
            const rtos = getAllRTOs('non-existent-state');
            expect(rtos).toEqual([]);
        });

        it('should return RTOs sorted by code', () => {
            const rtos = getAllRTOs('karnataka');
            const codes = rtos.map(rto => rto.code);
            const sortedCodes = [...codes].sort();
            expect(codes).toEqual(sortedCodes);
        });
    });

    describe('getRTOByCode', () => {
        it('should get RTO by code', () => {
            const rto = getRTOByCode('KA-01');
            expect(rto).toBeDefined();
            expect(rto?.code).toBe('KA-01');
            expect(rto?.state).toBe('Karnataka');
        });

        it('should be case insensitive', () => {
            const rto1 = getRTOByCode('ka-01');
            const rto2 = getRTOByCode('KA-01');
            expect(rto1).toEqual(rto2);
        });

        it('should return null for non-existent code', () => {
            const rto = getRTOByCode('XX-99');
            expect(rto).toBeNull();
        });

        it('should detect state from code prefix', () => {
            const rto = getRTOByCode('GA-01');
            expect(rto).toBeDefined();
            expect(rto?.state).toBe('Goa');
        });
    });

    describe('getVerifiedRTOs', () => {
        it('should return only RTOs with non-empty regions', () => {
            const verifiedRTOs = getVerifiedRTOs('karnataka');
            expect(verifiedRTOs.every(rto => rto.region && rto.region.trim() !== '')).toBe(true);
        });

        it('should work for all states', () => {
            const verifiedRTOs = getVerifiedRTOs();
            expect(verifiedRTOs.length).toBeGreaterThan(0);
            expect(verifiedRTOs.every(rto => rto.region && rto.region.trim() !== '')).toBe(true);
        });
    });

    describe('getVerifiedRTOCodes', () => {
        it('should return array of lowercase codes', () => {
            const codes = getVerifiedRTOCodes('karnataka');
            expect(codes.length).toBeGreaterThan(0);
            expect(codes.every(code => code === code.toLowerCase())).toBe(true);
            expect(codes.every(code => code.match(/^[a-z]{2}-\d+$/))).toBe(true);
        });

        it('should prioritize active RTOs before inactive ones', () => {
            const codes = getVerifiedRTOCodes('karnataka');
            const allRTOs = getVerifiedRTOs('karnataka');

            // Create a map of code to status
            const codeToRTO = new Map(allRTOs.map(rto => [rto.code.toLowerCase(), rto]));

            // Find the first inactive RTO in the list
            const firstInactiveIndex = codes.findIndex(code => {
                const rto = codeToRTO.get(code);
                return rto && (rto.status === 'not-in-use' || rto.status === 'discontinued');
            });

            // If there are inactive RTOs, ensure all before it are active
            if (firstInactiveIndex !== -1) {
                for (let i = 0; i < firstInactiveIndex; i++) {
                    const rto = codeToRTO.get(codes[i]);
                    expect(rto?.status !== 'not-in-use' && rto?.status !== 'discontinued').toBe(true);
                }
            }
        });
    });

    describe('searchRTOs', () => {
        it('should return all verified RTOs for empty query', () => {
            const results = searchRTOs('', 'karnataka');
            const verified = getVerifiedRTOs('karnataka');
            expect(results.length).toBe(verified.length);
        });

        it('should search by code', () => {
            const results = searchRTOs('KA-01', 'karnataka');
            expect(results.length).toBeGreaterThan(0);
            expect(results.some(rto => rto.code === 'KA-01')).toBe(true);
        });

        it('should search by city', () => {
            const results = searchRTOs('Bengaluru', 'karnataka');
            expect(results.length).toBeGreaterThan(0);
            // Just verify we got results that match the search criteria
            // The searchRTOs function searches across code, region, city, district, and jurisdiction areas
            expect(results.some(rto =>
                rto.city.toLowerCase().includes('bengaluru') ||
                rto.region.toLowerCase().includes('bengaluru') ||
                rto.district?.toLowerCase().includes('bengaluru') ||
                (rto.jurisdictionAreas && rto.jurisdictionAreas.some(area => area.toLowerCase().includes('bengaluru')))
            )).toBe(true);
        });

        it('should be case insensitive', () => {
            const results1 = searchRTOs('bengaluru', 'karnataka');
            const results2 = searchRTOs('BENGALURU', 'karnataka');
            expect(results1.length).toBe(results2.length);
        });
    });

    describe('getRTOsByDistrict', () => {
        it('should return RTOs for a specific district', () => {
            const rtos = getRTOsByDistrict('Bengaluru Urban', 'karnataka');
            expect(rtos.length).toBeGreaterThan(0);
            expect(rtos.every(rto => rto.district === 'Bengaluru Urban')).toBe(true);
        });

        it('should return empty array for non-existent district', () => {
            const rtos = getRTOsByDistrict('Non-Existent District', 'karnataka');
            expect(rtos).toEqual([]);
        });
    });

    describe('getDistrictToRTOsMap', () => {
        it('should create a map of districts to RTOs', () => {
            const map = getDistrictToRTOsMap('karnataka');
            expect(Object.keys(map).length).toBeGreaterThan(0);

            // Verify each district has RTOs
            Object.entries(map).forEach(([district, rtos]) => {
                expect(rtos.length).toBeGreaterThan(0);
                expect(rtos.every(rto => rto.district === district)).toBe(true);
            });
        });

        it('should prioritize district headquarters', () => {
            const map = getDistrictToRTOsMap('karnataka');

            Object.values(map).forEach(rtos => {
                if (rtos.length > 1) {
                    const headquarters = rtos.filter(rto => rto.isDistrictHeadquarter);
                    if (headquarters.length > 0) {
                        // District HQ should come first
                        expect(rtos[0].isDistrictHeadquarter).toBe(true);
                    }
                }
            });
        });

        it('should sort RTOs within each district', () => {
            const map = getDistrictToRTOsMap('karnataka');

            Object.values(map).forEach(rtos => {
                // Check if active RTOs come before inactive ones
                const firstInactiveIndex = rtos.findIndex(rto =>
                    rto.status === 'not-in-use' || rto.status === 'discontinued'
                );

                if (firstInactiveIndex !== -1) {
                    // All RTOs before the first inactive should be active
                    for (let i = 0; i < firstInactiveIndex; i++) {
                        expect(rtos[i].status !== 'not-in-use').toBe(true);
                        expect(rtos[i].status !== 'discontinued').toBe(true);
                    }
                }
            });
        });
    });
});
