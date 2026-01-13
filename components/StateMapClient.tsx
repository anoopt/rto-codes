'use client';

import { useEffect, useRef, useCallback } from 'react';

interface DistrictInfo {
    districtName: string;
    rtoCount: number;
}

interface StateMapClientProps {
    /** Pre-loaded SVG content from the server */
    svgContent: string;
    /** District ID to highlight (SVG ID format) */
    highlightDistrictId: string | null;
    /** List of valid district IDs in this state's SVG */
    districtIds: string[];
    className?: string;
    /** Map of SVG district IDs to district info (name and RTO count) for tooltips */
    districtInfoMap?: Record<string, DistrictInfo>;
    /** Callback when a district is clicked */
    onDistrictClick?: (svgDistrictId: string) => void;
    /** Whether the map is interactive (clickable) */
    interactive?: boolean;
}

/**
 * Gets CSS custom property value from computed styles
 */
function getCssVar(name: string): string {
    if (typeof window === 'undefined') return '';
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Generic client component that renders and highlights a state district map.
 * Receives pre-processed SVG content and district IDs from the server.
 * Uses CSS custom properties for theme-aware colors.
 * Supports interactive mode with click handlers and tooltips.
 * 
 * This component is state-agnostic - it works with any state's map SVG
 * as long as the district IDs are provided.
 */
export default function StateMapClient({
    svgContent,
    highlightDistrictId,
    districtIds,
    className = '',
    districtInfoMap,
    onDistrictClick,
    interactive = false
}: StateMapClientProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);

    // Create tooltip element
    const createTooltip = useCallback(() => {
        if (tooltipRef.current) return tooltipRef.current;

        const tooltip = document.createElement('div');
        tooltip.className = 'map-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            background: var(--tooltip-bg, rgba(0, 0, 0, 0.85));
            color: var(--tooltip-text, white);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            pointer-events: none;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.15s ease;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        `;
        document.body.appendChild(tooltip);
        tooltipRef.current = tooltip;
        return tooltip;
    }, []);

    // Clean up tooltip on unmount
    useEffect(() => {
        return () => {
            if (tooltipRef.current) {
                tooltipRef.current.remove();
                tooltipRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!containerRef.current || !svgContent || svgContent.trim() === '') return;

        // Convert district IDs array to Set for O(1) lookup
        const districtIdSet = new Set(districtIds);

        const applyStyles = () => {
            const container = containerRef.current;
            if (!container) return;

            // Get theme-aware colors from CSS variables
            const districtFill = getCssVar('--map-district-fill') || '#1e293b';
            const districtStroke = getCssVar('--map-district-stroke') || '#ffffff';
            const highlightFill = getCssVar('--map-highlight-fill') || '#f59e0b';
            const highlightStroke = getCssVar('--map-highlight-stroke') || '#ffffff';
            const hoverFill = getCssVar('--map-hover-fill') || '#3b82f6';

            // Early return if no content
            if (!svgContent || svgContent.trim() === '') {
                console.warn('StateMapClient: Empty SVG content provided');
                return;
            }

            // Parse the SVG content using the correct MIME type
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgContent, 'image/svg+xml');

            // Check for parsing errors
            const parseError = doc.querySelector('parsererror');
            if (parseError) {
                console.error('StateMapClient: SVG parsing error', parseError.textContent);
                return;
            }

            const svgElement = doc.querySelector('svg');

            if (!svgElement) {
                console.warn('StateMapClient: No SVG element found in content');
                return;
            }

            // Additional safety check: ensure svgElement is actually an SVGSVGElement
            if (!(svgElement instanceof SVGSVGElement)) {
                console.warn('StateMapClient: Element is not a valid SVG element');
                return;
            }

            // Set responsive sizing
            svgElement.setAttribute('width', '100%');
            svgElement.setAttribute('height', '100%');
            svgElement.style.maxWidth = '100%';
            svgElement.style.maxHeight = '100%';

            // Style all paths
            const paths = svgElement.querySelectorAll('path');
            paths.forEach((pathEl) => {
                const id = pathEl.getAttribute('id');
                const isDistrict = id && districtIdSet.has(id);

                if (isDistrict) {
                    // Apply district styling
                    pathEl.style.transition = 'fill 0.2s ease, opacity 0.2s ease, transform 0.2s ease';
                    // Ensure consistent stroke width regardless of SVG scaling/viewBox
                    pathEl.style.vectorEffect = 'non-scaling-stroke';

                    if (id === highlightDistrictId) {
                        // Highlighted district - accent color with bold border
                        pathEl.style.fill = highlightFill;
                        pathEl.style.fillOpacity = '1';
                        pathEl.style.stroke = highlightStroke;
                        pathEl.style.strokeWidth = '2.5px';
                    } else {
                        // Other districts - theme-aware colors
                        pathEl.style.fill = districtFill;
                        pathEl.style.fillOpacity = '0.5';
                        pathEl.style.stroke = districtStroke;
                        pathEl.style.strokeWidth = '1px';
                    }

                    // Add interactive handlers if enabled
                    if (interactive && id) {
                        pathEl.style.cursor = 'pointer';

                        // Store original styles for hover restore
                        const originalFill = id === highlightDistrictId ? highlightFill : districtFill;
                        const originalOpacity = id === highlightDistrictId ? '1' : '0.5';
                        const originalStrokeWidth = id === highlightDistrictId ? '2.5px' : '1px';

                        // Hover enter - highlight effect
                        pathEl.addEventListener('mouseenter', (e) => {
                            if (id !== highlightDistrictId) {
                                pathEl.style.fill = hoverFill;
                                pathEl.style.fillOpacity = '0.8';
                                pathEl.style.strokeWidth = '1.5px';
                            }

                            // Show tooltip if we have district info
                            if (districtInfoMap && districtInfoMap[id]) {
                                const tooltip = createTooltip();
                                const info = districtInfoMap[id];
                                const rtoText = info.rtoCount === 1 ? 'RTO' : 'RTOs';
                                tooltip.innerHTML = `<strong>${info.districtName}</strong><br/><span style="font-size: 12px; opacity: 0.9">${info.rtoCount} ${rtoText}</span>`;
                                tooltip.style.opacity = '1';

                                // Position tooltip near cursor
                                const mouseEvent = e as MouseEvent;
                                tooltip.style.left = `${mouseEvent.clientX + 12}px`;
                                tooltip.style.top = `${mouseEvent.clientY + 12}px`;
                            }
                        });

                        // Mouse move - update tooltip position
                        pathEl.addEventListener('mousemove', (e) => {
                            if (tooltipRef.current) {
                                const mouseEvent = e as MouseEvent;
                                tooltipRef.current.style.left = `${mouseEvent.clientX + 12}px`;
                                tooltipRef.current.style.top = `${mouseEvent.clientY + 12}px`;
                            }
                        });

                        // Hover leave - restore original
                        pathEl.addEventListener('mouseleave', () => {
                            if (id !== highlightDistrictId) {
                                pathEl.style.fill = originalFill;
                                pathEl.style.fillOpacity = originalOpacity;
                                pathEl.style.strokeWidth = originalStrokeWidth;
                            }

                            // Hide tooltip
                            if (tooltipRef.current) {
                                tooltipRef.current.style.opacity = '0';
                            }
                        });

                        // Click handler
                        pathEl.addEventListener('click', () => {
                            if (onDistrictClick) {
                                onDistrictClick(id);
                            }
                        });
                    }
                } else {
                    // Hide non-district paths
                    pathEl.style.display = 'none';
                }
            });

            // Hide non-essential elements
            ['text', 'circle', 'rect', 'line', 'polyline', 'polygon'].forEach(selector => {
                svgElement.querySelectorAll(selector).forEach(el => {
                    (el as HTMLElement).style.display = 'none';
                });
            });

            // Remove title elements completely (display:none doesn't prevent browser tooltips)
            svgElement.querySelectorAll('title').forEach(el => el.remove());

            // Hide utility groups
            svgElement.querySelectorAll('g').forEach(g => {
                const id = g.getAttribute('id');
                if (id && ['legend', 'markers', 'scale', 'lake', 'river', 'road', 'rail'].includes(id)) {
                    g.style.display = 'none';
                }
            });

            // Clear and append
            container.innerHTML = '';
            container.appendChild(svgElement);
        };

        applyStyles();

        // Re-apply styles when theme changes (listen for class changes on html element)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    applyStyles();
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true });

        return () => observer.disconnect();
    }, [svgContent, highlightDistrictId, districtIds, interactive, districtInfoMap, onDistrictClick, createTooltip]);

    // Don't render if no SVG content is provided
    if (!svgContent || svgContent.trim() === '') {
        return null;
    }

    return (
        <div
            ref={containerRef}
            className={`state-map ${interactive ? 'interactive' : ''} ${className}`}
            aria-label={highlightDistrictId ? `State map with ${highlightDistrictId} district highlighted` : 'State district map - click a district to view RTOs'}
            role={interactive ? 'navigation' : undefined}
        />
    );
}
