import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getAvailableStates,
    getStateConfig,
    getStateConfigByCode,
    getStateFolderByCode,
    getSvgDistrictId,
    getDistrictFromSvgId,
} from '@/lib/state-config';

// Mock console.error to suppress expected error messages in tests
const originalConsoleError = console.error;
beforeEach(() => {
    console.error = vi.fn();
});

afterEach(() => {
    console.error = originalConsoleError;
});

describe('State Configuration Functions', () => {
    describe('getAvailableStates', () => {
        it('should return an array of state names', () => {
            const states = getAvailableStates();
            expect(states).toBeDefined();
            expect(Array.isArray(states)).toBe(true);
            expect(states.length).toBeGreaterThan(0);
        });

        it('should include karnataka and goa', () => {
            const states = getAvailableStates();
            expect(states).toContain('karnataka');
            expect(states).toContain('goa');
        });

        it('should only return folders with config.json', () => {
            const states = getAvailableStates();
            // Each state should have a valid config
            states.forEach(state => {
                const config = getStateConfig(state);
                expect(config).not.toBeNull();
            });
        });
    });

    describe('getStateConfig', () => {
        it('should load Karnataka config', () => {
            const config = getStateConfig('karnataka');
            expect(config).toBeDefined();
            expect(config?.stateCode).toBe('KA');
            expect(config?.name).toBe('Karnataka');
            expect(config?.capital).toBe('Bengaluru');
        });

        it('should load Goa config', () => {
            const config = getStateConfig('goa');
            expect(config).toBeDefined();
            expect(config?.stateCode).toBe('GA');
            expect(config?.name).toBe('Goa');
        });

        it('should return null for non-existent state', () => {
            const config = getStateConfig('non-existent-state');
            expect(config).toBeNull();
        });

        it('should include districtMapping', () => {
            const config = getStateConfig('karnataka');
            expect(config?.districtMapping).toBeDefined();
            expect(typeof config?.districtMapping).toBe('object');
            expect(Object.keys(config?.districtMapping || {}).length).toBeGreaterThan(0);
        });

        it('should cache config on subsequent calls', () => {
            const config1 = getStateConfig('karnataka');
            const config2 = getStateConfig('karnataka');
            // Should return the same object reference (cached)
            expect(config1).toBe(config2);
        });
    });

    describe('getStateConfigByCode', () => {
        it('should find Karnataka by code KA', () => {
            const config = getStateConfigByCode('KA');
            expect(config).toBeDefined();
            expect(config?.name).toBe('Karnataka');
        });

        it('should find Goa by code GA', () => {
            const config = getStateConfigByCode('GA');
            expect(config).toBeDefined();
            expect(config?.name).toBe('Goa');
        });

        it('should be case insensitive', () => {
            const config1 = getStateConfigByCode('KA');
            const config2 = getStateConfigByCode('ka');
            expect(config1?.stateCode).toBe(config2?.stateCode);
        });

        it('should return null for non-existent code', () => {
            const config = getStateConfigByCode('XX');
            expect(config).toBeNull();
        });
    });

    describe('getStateFolderByCode', () => {
        it('should return folder name for KA', () => {
            const folder = getStateFolderByCode('KA');
            expect(folder).toBe('karnataka');
        });

        it('should return folder name for GA', () => {
            const folder = getStateFolderByCode('GA');
            expect(folder).toBe('goa');
        });

        it('should be case insensitive', () => {
            const folder1 = getStateFolderByCode('KA');
            const folder2 = getStateFolderByCode('ka');
            expect(folder1).toBe(folder2);
        });

        it('should return null for non-existent code', () => {
            const folder = getStateFolderByCode('XX');
            expect(folder).toBeNull();
        });
    });

    describe('getSvgDistrictId', () => {
        it('should map modern district name to SVG ID', () => {
            const svgId = getSvgDistrictId('karnataka', 'Bengaluru Urban');
            expect(svgId).toBeDefined();
            expect(typeof svgId).toBe('string');
        });

        it('should return null for non-existent district', () => {
            const svgId = getSvgDistrictId('karnataka', 'Non-Existent District');
            expect(svgId).toBeNull();
        });

        it('should return null for non-existent state', () => {
            const svgId = getSvgDistrictId('non-existent-state', 'Some District');
            expect(svgId).toBeNull();
        });
    });

    describe('getDistrictFromSvgId', () => {
        it('should reverse map SVG ID to modern district name', () => {
            const config = getStateConfig('karnataka');
            if (config && config.districtMapping) {
                // Get a valid SVG ID from the mapping
                const [modernName, svgId] = Object.entries(config.districtMapping)[0];

                const reversedName = getDistrictFromSvgId('karnataka', svgId);
                expect(reversedName).toBe(modernName);
            }
        });

        it('should return null for non-existent SVG ID', () => {
            const district = getDistrictFromSvgId('karnataka', 'non-existent-svg-id');
            expect(district).toBeNull();
        });

        it('should return null for non-existent state', () => {
            const district = getDistrictFromSvgId('non-existent-state', 'some-id');
            expect(district).toBeNull();
        });
    });

    describe('District Mapping Integration', () => {
        it('should have bidirectional mapping working correctly', () => {
            const config = getStateConfig('karnataka');
            if (config) {
                // Test that forward mapping works (modern name -> SVG ID)
                Object.entries(config.districtMapping).forEach(([modernName, svgId]) => {
                    const retrievedSvgId = getSvgDistrictId('karnataka', modernName);
                    expect(retrievedSvgId).toBe(svgId);
                });

                // Test that reverse mapping returns a valid modern name
                // Note: Multiple districts can map to the same SVG ID, so we just verify
                // that getDistrictFromSvgId returns ONE of the valid modern names
                Object.entries(config.districtMapping).forEach(([, svgId]) => {
                    const retrievedModernName = getDistrictFromSvgId('karnataka', svgId);
                    expect(retrievedModernName).toBeDefined();
                    // The retrieved name should also map back to the same SVG ID
                    if (retrievedModernName) {
                        expect(config.districtMapping[retrievedModernName]).toBe(svgId);
                    }
                });
            }
        });
    });
});
