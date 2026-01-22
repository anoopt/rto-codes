import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MapSectionWrapper from '@/components/MapSectionWrapper';

// Mock feature flags module
vi.mock('@/lib/feature-flags', () => ({
    isOSMEnabledForState: vi.fn(),
}));

// Mock dynamic imports for OSM components
vi.mock('next/dynamic', () => ({
    default: () => {
        const MockOSMMap = () => <div data-testid="osm-state-map">OSM Map Mock</div>;
        return MockOSMMap;
    },
}));

import { isOSMEnabledForState } from '@/lib/feature-flags';

const mockIsOSMEnabledForState = vi.mocked(isOSMEnabledForState);

describe('MapSectionWrapper', () => {
    const defaultRto = {
        code: 'KA-01',
        state: 'Karnataka',
        stateCode: 'KA',
        district: 'Bengaluru Urban',
    };

    const defaultDistrictRTOs = [
        { code: 'KA-01', city: 'Bengaluru', region: 'Koramangala', status: 'active' as const },
        { code: 'KA-02', city: 'Bengaluru', region: 'Indiranagar', status: 'active' as const },
    ];

    beforeEach(() => {
        mockIsOSMEnabledForState.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('when no district is provided', () => {
        it('should render nothing', () => {
            mockIsOSMEnabledForState.mockReturnValue(true);

            const { container } = render(
                <MapSectionWrapper
                    rto={{ ...defaultRto, district: undefined }}
                    osmEnabled={true}
                />
            );

            expect(container.firstChild).toBeNull();
        });
    });

    describe('when OSM is enabled for state', () => {
        it('should render OSM map when global and state flags are true', () => {
            mockIsOSMEnabledForState.mockReturnValue(true);

            render(
                <MapSectionWrapper
                    rto={defaultRto}
                    osmEnabled={true}
                    districtRTOs={defaultDistrictRTOs}
                    districtMapping={{ 'Bengaluru Urban': 'bengaluru_urban' }}
                />
            );

            expect(screen.getByTestId('osm-state-map')).toBeInTheDocument();
        });

        it('should call isOSMEnabledForState with osmEnabled prop', () => {
            mockIsOSMEnabledForState.mockReturnValue(false);

            render(
                <MapSectionWrapper
                    rto={defaultRto}
                    osmEnabled={true}
                />
            );

            expect(mockIsOSMEnabledForState).toHaveBeenCalledWith(true);
        });

        it('should display district RTO legend when multiple RTOs exist', () => {
            mockIsOSMEnabledForState.mockReturnValue(true);

            render(
                <MapSectionWrapper
                    rto={defaultRto}
                    osmEnabled={true}
                    districtRTOs={defaultDistrictRTOs}
                    districtMapping={{ 'Bengaluru Urban': 'bengaluru_urban' }}
                />
            );

            expect(screen.getByText('RTOs in Bengaluru Urban')).toBeInTheDocument();
        });
    });

    describe('when OSM is disabled', () => {
        it('should render nothing', () => {
            mockIsOSMEnabledForState.mockReturnValue(false);

            const { container } = render(
                <MapSectionWrapper
                    rto={defaultRto}
                    osmEnabled={false}
                />
            );

            expect(container.firstChild).toBeNull();
        });
    });

    describe('osmEnabled flag behavior', () => {
        it('should pass undefined osmEnabled when not provided', () => {
            mockIsOSMEnabledForState.mockReturnValue(false);

            render(
                <MapSectionWrapper
                    rto={defaultRto}
                />
            );

            expect(mockIsOSMEnabledForState).toHaveBeenCalledWith(undefined);
        });

        it('should pass false osmEnabled when explicitly set', () => {
            mockIsOSMEnabledForState.mockReturnValue(false);

            render(
                <MapSectionWrapper
                    rto={defaultRto}
                    osmEnabled={false}
                />
            );

            expect(mockIsOSMEnabledForState).toHaveBeenCalledWith(false);
        });

        it('should pass true osmEnabled when explicitly set', () => {
            mockIsOSMEnabledForState.mockReturnValue(true);

            render(
                <MapSectionWrapper
                    rto={defaultRto}
                    osmEnabled={true}
                    districtMapping={{ 'Bengaluru Urban': 'bengaluru_urban' }}
                />
            );

            expect(mockIsOSMEnabledForState).toHaveBeenCalledWith(true);
        });
    });
});
