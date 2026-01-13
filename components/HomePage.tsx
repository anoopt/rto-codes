'use client';

import { useState, useMemo, useEffect } from 'react';
import SearchableRTOs from '@/components/SearchableRTOs';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import type { RTOCode } from '@/types/rto';

interface HomePageProps {
    rtos: RTOCode[];
    /** List of RTO codes that have generated images */
    availableImages: string[];
}

export default function HomePage({ rtos, availableImages }: HomePageProps) {
    const [searchQuery, setSearchQuery] = useState('');

    // Constant for retry delay when scrolling to tile
    const TILE_SCROLL_RETRY_DELAY = 100;

    // Scroll to specific RTO tile when returning from detail page
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Check if there's a hash in the URL (e.g., #ka-01)
            const hash = window.location.hash.slice(1); // Remove the '#'

            if (hash) {
                let retryTimeout: ReturnType<typeof setTimeout> | null = null;

                // Wait for DOM to be ready and then scroll to the tile
                const scrollToTile = () => {
                    // Use data attribute for more robust element selection
                    const tileLink = document.querySelector(`[data-rto-code="${hash}"]`);
                    if (tileLink) {
                        // Scroll the tile into view instantly (no animation to avoid long scrolling delays)
                        tileLink.scrollIntoView({ behavior: 'instant', block: 'center' });
                        // Clear the hash from URL without reloading the page
                        window.history.replaceState(null, '', window.location.pathname);
                        return true;
                    }
                    return false;
                };

                // Use requestAnimationFrame to ensure DOM is ready
                requestAnimationFrame(() => {
                    // Try to scroll immediately first
                    if (!scrollToTile()) {
                        // If element not found, retry after a short delay
                        // This handles cases where the grid takes time to render
                        retryTimeout = setTimeout(scrollToTile, TILE_SCROLL_RETRY_DELAY);
                    }
                });

                // Clean up timeout on unmount
                return () => {
                    if (retryTimeout) {
                        clearTimeout(retryTimeout);
                    }
                };
            } else {
                // Fallback to old scroll position restoration if no hash
                const savedScrollPosition = sessionStorage.getItem('homeScrollPosition');
                if (savedScrollPosition) {
                    requestAnimationFrame(() => {
                        window.scrollTo(0, parseInt(savedScrollPosition, 10));
                    });
                    sessionStorage.removeItem('homeScrollPosition');
                }
            }
        }
    }, []);

    // Dynamically calculate unique states from the RTO list
    const stateText = useMemo(() => {
        const uniqueStates = Array.from(new Set(rtos.map(rto => rto.state))).sort();

        if (uniqueStates.length === 0) return 'supported states';
        if (uniqueStates.length === 1) return uniqueStates[0];

        // Join with commas and "and" for the last item (e.g., "Goa, Karnataka and Maharashtra")
        if (uniqueStates.length === 2) return `${uniqueStates[0]} and ${uniqueStates[1]}`;

        const lastState = uniqueStates.pop();
        return `${uniqueStates.join(', ')} and ${lastState}`;
    }, [rtos]);

    return (
        <div className="min-h-screen flex flex-col bg-[var(--background)] transition-colors duration-300">
            {/* Header */}
            <Header
                variant="full"
                showSearch={true}
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
            />

            {/* Explainer Section - Below Header */}
            <section className="pt-12 bg-[var(--background)] border-b border-[var(--header-border)] transition-colors duration-300">
                <div className="max-w-4xl mx-auto px-4 py-8 text-center">
                    <p className="text-[var(--muted)] text-lg leading-relaxed">
                        Most vehicles in India have a registration number in the format{' '}
                        <span className="text-[var(--foreground)] font-medium">XX-00(0)-XX-0000</span>.{' '}
                        The first two letters represent the <span className="text-[var(--foreground)]">state</span> (e.g., KA for Karnataka),{' '}
                        followed by a <span className="text-[var(--foreground)]">two or three-digit code</span> identifying the Regional Transport Office (RTO){' '}
                        where the vehicle was registered.{' '}
                        This site catalogues all <span className="text-[var(--accent)] font-medium">{rtos.length} RTO codes</span> across {stateText}, with more states coming soon.
                    </p>
                </div>
            </section>

            {/* Main Grid - Search and Grid are combined in client component */}
            <main id="main-content" className="grow">
                <SearchableRTOs rtos={rtos} searchQuery={searchQuery} availableImages={availableImages} />
            </main>

            {/* Footer */}
            <Footer className="bg-[var(--background)] border-t border-[var(--header-border)]" />
        </div>
    );
}
