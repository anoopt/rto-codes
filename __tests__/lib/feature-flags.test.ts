import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isOSMEnabled, isOSMEnabledForState } from '@/lib/feature-flags';

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

    describe('isOSMEnabledForState', () => {
        it('should return false when global OSM is disabled', () => {
            delete process.env.NEXT_PUBLIC_OSM_ENABLED;
            expect(isOSMEnabledForState(true)).toBe(false);
            expect(isOSMEnabledForState(false)).toBe(false);
            expect(isOSMEnabledForState(undefined)).toBe(false);
        });

        it('should return false when global OSM is enabled but state osmEnabled is false', () => {
            process.env.NEXT_PUBLIC_OSM_ENABLED = 'true';
            expect(isOSMEnabledForState(false)).toBe(false);
        });

        it('should return false when global OSM is enabled but state osmEnabled is undefined', () => {
            process.env.NEXT_PUBLIC_OSM_ENABLED = 'true';
            expect(isOSMEnabledForState(undefined)).toBe(false);
        });

        it('should return true when global OSM is enabled AND state osmEnabled is true', () => {
            process.env.NEXT_PUBLIC_OSM_ENABLED = 'true';
            expect(isOSMEnabledForState(true)).toBe(true);
        });
    });
});
