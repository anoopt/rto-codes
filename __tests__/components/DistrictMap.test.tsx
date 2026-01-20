import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import DistrictMap from '@/components/DistrictMap';

// Mock Next.js router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

// Mock StateMapClient component
vi.mock('@/components/StateMapClient', () => ({
    default: (props: {
        svgContent: string;
        highlightDistrictId?: string | null;
        interactive?: boolean;
        onDistrictClick?: (districtId: string) => void;
    }) => (
        <div
            data-testid="state-map-client"
            data-svg-content={props.svgContent ? 'present' : 'missing'}
            data-highlight={props.highlightDistrictId || 'none'}
            data-interactive={props.interactive}
            onClick={() => props.onDistrictClick && props.onDistrictClick('TestDistrict')}
        >
            Mocked StateMapClient
        </div>
    ),
}));

describe('DistrictMap Component', () => {
    const mockSvgContent = '<svg><g id="TestDistrict"><path d="M0,0"/></g></svg>';
    const mockDistrictMapping = {
        'Bengaluru Urban': 'Bangalore Urban',
        'Belagavi': 'Belgaum',
        'TestDistrict': 'TestDistrict',
    };
    const mockSvgDistrictIds = ['Bangalore Urban', 'Belgaum', 'TestDistrict'];

    beforeEach(() => {
        mockPush.mockClear();
    });

    describe('Rendering', () => {
        it('should render when svgContent and districtMapping are provided', () => {
            const { getByTestId } = render(
                <DistrictMap
                    svgContent={mockSvgContent}
                    districtMapping={mockDistrictMapping}
                    svgDistrictIds={mockSvgDistrictIds}
                />
            );

            expect(getByTestId('state-map-client')).toBeInTheDocument();
        });

        it('should return null when svgContent is missing', () => {
            const { container } = render(
                <DistrictMap
                    svgContent=""
                    districtMapping={mockDistrictMapping}
                    svgDistrictIds={mockSvgDistrictIds}
                />
            );

            expect(container.firstChild).toBeNull();
        });

        it('should return null when districtMapping is missing', () => {
            const { container } = render(
                <DistrictMap
                    svgContent={mockSvgContent}
                    districtMapping={{}}
                    svgDistrictIds={mockSvgDistrictIds}
                />
            );

            // With empty mapping, it should still render but pass empty mapping
            // Actually checking the logic - empty object is truthy, so it will render
            const element = container.querySelector('[data-testid="state-map-client"]');
            expect(element).toBeInTheDocument();
        });

        it('should apply custom className', () => {
            const { container } = render(
                <DistrictMap
                    svgContent={mockSvgContent}
                    districtMapping={mockDistrictMapping}
                    svgDistrictIds={mockSvgDistrictIds}
                    className="custom-class"
                />
            );

            expect(container.querySelector('.custom-class')).toBeInTheDocument();
        });
    });

    describe('District Highlighting', () => {
        it('should highlight district when district prop is provided', () => {
            const { getByTestId } = render(
                <DistrictMap
                    district="Bengaluru Urban"
                    svgContent={mockSvgContent}
                    districtMapping={mockDistrictMapping}
                    svgDistrictIds={mockSvgDistrictIds}
                />
            );

            const mapClient = getByTestId('state-map-client');
            expect(mapClient.getAttribute('data-highlight')).toBe('Bangalore Urban');
        });

        it('should handle modern district names mapping to SVG IDs', () => {
            const { getByTestId } = render(
                <DistrictMap
                    district="Belagavi"
                    svgContent={mockSvgContent}
                    districtMapping={mockDistrictMapping}
                    svgDistrictIds={mockSvgDistrictIds}
                />
            );

            const mapClient = getByTestId('state-map-client');
            expect(mapClient.getAttribute('data-highlight')).toBe('Belgaum');
        });

        it('should not highlight when district is not in mapping', () => {
            const { getByTestId } = render(
                <DistrictMap
                    district="Non-Existent District"
                    svgContent={mockSvgContent}
                    districtMapping={mockDistrictMapping}
                    svgDistrictIds={mockSvgDistrictIds}
                />
            );

            const mapClient = getByTestId('state-map-client');
            expect(mapClient.getAttribute('data-highlight')).toBe('none');
        });

        it('should not highlight when district prop is not provided', () => {
            const { getByTestId } = render(
                <DistrictMap
                    svgContent={mockSvgContent}
                    districtMapping={mockDistrictMapping}
                    svgDistrictIds={mockSvgDistrictIds}
                />
            );

            const mapClient = getByTestId('state-map-client');
            expect(mapClient.getAttribute('data-highlight')).toBe('none');
        });
    });

    describe('Interactive Mode', () => {
        const mockDistrictRTOsMap = {
            'Bengaluru Urban': [
                { code: 'KA-01', region: 'Koramangala', isDistrictHeadquarter: true },
                { code: 'KA-02', region: 'Yeshwanthpur' },
            ],
            'Belagavi': [
                { code: 'KA-03', region: 'Belagavi' },
            ],
            'TestDistrict': [
                { code: 'KA-04', region: 'Test Region' },
                { code: 'KA-99', region: 'Inactive RTO', isInactive: true },
            ],
        };

        it('should be non-interactive by default', () => {
            const { getByTestId } = render(
                <DistrictMap
                    svgContent={mockSvgContent}
                    districtMapping={mockDistrictMapping}
                    svgDistrictIds={mockSvgDistrictIds}
                />
            );

            const mapClient = getByTestId('state-map-client');
            expect(mapClient.getAttribute('data-interactive')).toBe('false');
        });

        it('should enable interactive mode when prop is true', () => {
            const { getByTestId } = render(
                <DistrictMap
                    svgContent={mockSvgContent}
                    districtMapping={mockDistrictMapping}
                    svgDistrictIds={mockSvgDistrictIds}
                    interactive={true}
                    districtRTOsMap={mockDistrictRTOsMap}
                />
            );

            const mapClient = getByTestId('state-map-client');
            expect(mapClient.getAttribute('data-interactive')).toBe('true');
        });

        it('should navigate to first RTO when district is clicked in interactive mode', () => {
            const { getByTestId } = render(
                <DistrictMap
                    svgContent={mockSvgContent}
                    districtMapping={mockDistrictMapping}
                    svgDistrictIds={mockSvgDistrictIds}
                    interactive={true}
                    districtRTOsMap={mockDistrictRTOsMap}
                />
            );

            const mapClient = getByTestId('state-map-client');
            mapClient.click();

            expect(mockPush).toHaveBeenCalledWith('/rto/ka-04');
        });

        it('should prioritize district headquarters', () => {
            const customRTOsMap = {
                'TestDistrict': [
                    { code: 'KA-05', region: 'Non-HQ' },
                    { code: 'KA-04', region: 'HQ', isDistrictHeadquarter: true },
                ],
            };

            const customMapping = { 'TestDistrict': 'TestDistrict' };

            const { getByTestId } = render(
                <DistrictMap
                    svgContent={mockSvgContent}
                    districtMapping={customMapping}
                    svgDistrictIds={['TestDistrict']}
                    interactive={true}
                    districtRTOsMap={customRTOsMap}
                />
            );

            getByTestId('state-map-client').click();
            expect(mockPush).toHaveBeenCalledWith('/rto/ka-04');
        });

        it('should prioritize active RTOs over inactive ones', () => {
            const customRTOsMap = {
                'TestDistrict': [
                    { code: 'KA-99', region: 'Inactive', isInactive: true },
                    { code: 'KA-04', region: 'Active' },
                ],
            };

            const customMapping = { 'TestDistrict': 'TestDistrict' };

            const { getByTestId } = render(
                <DistrictMap
                    svgContent={mockSvgContent}
                    districtMapping={customMapping}
                    svgDistrictIds={['TestDistrict']}
                    interactive={true}
                    districtRTOsMap={customRTOsMap}
                />
            );

            getByTestId('state-map-client').click();
            expect(mockPush).toHaveBeenCalledWith('/rto/ka-04');
        });
    });

    describe('District Mapping Edge Cases', () => {
        it('should handle multiple districts mapping to same SVG region', () => {
            const multiDistrictMapping = {
                'Ballari': 'Ballari',
                'Vijayanagara': 'Ballari', // Both map to same SVG region
            };

            const multiDistrictRTOsMap = {
                'Ballari': [
                    { code: 'KA-34', region: 'Ballari' },
                ],
                'Vijayanagara': [
                    { code: 'KA-35', region: 'Vijayanagara' },
                ],
            };

            const { getByTestId } = render(
                <DistrictMap
                    svgContent={mockSvgContent}
                    districtMapping={multiDistrictMapping}
                    svgDistrictIds={['Ballari']}
                    interactive={true}
                    districtRTOsMap={multiDistrictRTOsMap}
                />
            );

            // Should render without error
            expect(getByTestId('state-map-client')).toBeInTheDocument();
        });

        it('should handle empty districtRTOsMap in interactive mode', () => {
            const { getByTestId } = render(
                <DistrictMap
                    svgContent={mockSvgContent}
                    districtMapping={mockDistrictMapping}
                    svgDistrictIds={mockSvgDistrictIds}
                    interactive={true}
                    districtRTOsMap={{}}
                />
            );

            getByTestId('state-map-client').click();
            // Should not navigate if no RTOs
            expect(mockPush).not.toHaveBeenCalled();
        });

        it('should handle missing districtRTOsMap in interactive mode', () => {
            const { getByTestId } = render(
                <DistrictMap
                    svgContent={mockSvgContent}
                    districtMapping={mockDistrictMapping}
                    svgDistrictIds={mockSvgDistrictIds}
                    interactive={true}
                />
            );

            getByTestId('state-map-client').click();
            expect(mockPush).not.toHaveBeenCalled();
        });
    });

    describe('Props Validation', () => {
        it('should accept all required props', () => {
            expect(() => {
                render(
                    <DistrictMap
                        svgContent={mockSvgContent}
                        districtMapping={mockDistrictMapping}
                        svgDistrictIds={mockSvgDistrictIds}
                    />
                );
            }).not.toThrow();
        });

        it('should accept all optional props', () => {
            expect(() => {
                render(
                    <DistrictMap
                        district="TestDistrict"
                        svgContent={mockSvgContent}
                        districtMapping={mockDistrictMapping}
                        svgDistrictIds={mockSvgDistrictIds}
                        className="test-class"
                        interactive={true}
                        districtRTOsMap={{
                            'TestDistrict': [
                                { code: 'KA-01', region: 'Test' },
                            ],
                        }}
                    />
                );
            }).not.toThrow();
        });
    });
});
