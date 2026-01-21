import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isOSMEnabled, isDistrictMapEnabled } from '@/lib/feature-flags';

describe('Feature Flags', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('isOSMEnabled', () => {
        it('should return false when NEXT_PUBLIC_OSM_ENABLED is not set', () => {
            delete process.env.NEXT_PUBLIC_OSM_ENABLED;
            expect(isOSMEnabled()).toBe(false);
        });

        it('should return false when NEXT_PUBLIC_OSM_ENABLED is empty string', () => {
            process.env.NEXT_PUBLIC_OSM_ENABLED = '';
            expect(isOSMEnabled()).toBe(false);
        });

        it('should return false when NEXT_PUBLIC_OSM_ENABLED is "false"', () => {
            process.env.NEXT_PUBLIC_OSM_ENABLED = 'false';
            expect(isOSMEnabled()).toBe(false);
        });

        it('should return true when NEXT_PUBLIC_OSM_ENABLED is "true"', () => {
            process.env.NEXT_PUBLIC_OSM_ENABLED = 'true';
            expect(isOSMEnabled()).toBe(true);
        });

        it('should return false for any other value', () => {
            process.env.NEXT_PUBLIC_OSM_ENABLED = 'TRUE';
            expect(isOSMEnabled()).toBe(false);

            process.env.NEXT_PUBLIC_OSM_ENABLED = '1';
            expect(isOSMEnabled()).toBe(false);

            process.env.NEXT_PUBLIC_OSM_ENABLED = 'yes';
            expect(isOSMEnabled()).toBe(false);
        });
    });

    describe('isDistrictMapEnabled', () => {
        it('should return false when NEXT_PUBLIC_ENABLE_DISTRICT_MAP is not set', () => {
            delete process.env.NEXT_PUBLIC_ENABLE_DISTRICT_MAP;
            expect(isDistrictMapEnabled()).toBe(false);
        });

        it('should return true when NEXT_PUBLIC_ENABLE_DISTRICT_MAP is "true"', () => {
            process.env.NEXT_PUBLIC_ENABLE_DISTRICT_MAP = 'true';
            expect(isDistrictMapEnabled()).toBe(true);
        });

        it('should return false when NEXT_PUBLIC_ENABLE_DISTRICT_MAP is "false"', () => {
            process.env.NEXT_PUBLIC_ENABLE_DISTRICT_MAP = 'false';
            expect(isDistrictMapEnabled()).toBe(false);
        });
    });
});
