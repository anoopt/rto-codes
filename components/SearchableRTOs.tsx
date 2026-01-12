'use client';

import { useMemo, useCallback } from 'react';
import Link from 'next/link';
import RTOImage from '@/components/RTOImage';
import type { RTOCode } from '@/types/rto';

interface SearchableRTOsProps {
  rtos: RTOCode[];
  searchQuery: string;
  /** Set of RTO codes that have generated images */
  availableImages: string[];
}

export default function SearchableRTOs({ rtos, searchQuery, availableImages }: SearchableRTOsProps) {
  // Convert to Set for O(1) lookup
  const imageSet = useMemo(() => new Set(availableImages.map(code => code.toUpperCase())), [availableImages]);

  // Count how many RTOs share each city to decide if we need region disambiguation
  const cityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    rtos.forEach(rto => {
      const city = rto.city.toLowerCase();
      counts.set(city, (counts.get(city) || 0) + 1);
    });
    return counts;
  }, [rtos]);

  // Filter and sort RTOs
  const filteredRTOs = useMemo(() => {
    let result = rtos;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = rtos.filter(rto =>
        rto.code.toLowerCase().includes(query) ||
        rto.region.toLowerCase().includes(query) ||
        rto.city.toLowerCase().includes(query) ||
        (rto.district && rto.district.toLowerCase().includes(query)) ||
        (rto.jurisdictionAreas && rto.jurisdictionAreas.some(area => area.toLowerCase().includes(query)))
      );
    }

    // Sort: Active first, then deprecated (not-in-use/discontinued) at the bottom
    // We create a shallow copy to strictly avoid mutating the original prop array
    return [...result].sort((a, b) => {
      const aInactive = a.status === 'not-in-use' || a.status === 'discontinued';
      const bInactive = b.status === 'not-in-use' || b.status === 'discontinued';

      if (aInactive && !bInactive) return 1;
      if (!aInactive && bInactive) return -1;

      // If status is same group, preserve original order (alphabetical by code)
      return 0;
    });
  }, [searchQuery, rtos]);

  // Save scroll position before navigating to RTO detail page
  const saveScrollPosition = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('homeScrollPosition', window.scrollY.toString());
    }
  }, []);

  return (
    <>
      {/* Live region for screen reader announcements */}
      <div id="search-results-status" className="sr-only" role="status" aria-live="polite">
        {searchQuery ? `${filteredRTOs.length} results found for "${searchQuery}"` : `${rtos.length} RTO codes available`}
      </div>

      {/* RTO Grid */}
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {filteredRTOs.map((rto) => {
          const hasImage = imageSet.has(rto.code.toUpperCase());
          const needsRegion = cityCounts.get(rto.city.toLowerCase())! > 1;
          const isNotInUse = rto.status === 'not-in-use' || rto.status === 'discontinued';

          return (
            <li key={rto.code} className="aspect-square">
              <Link
                href={`/rto/${rto.code.toLowerCase()}`}
                onClick={saveScrollPosition}
                data-rto-code={rto.code.toLowerCase()}
                className={`block w-full h-full border border-[var(--card-border)] relative overflow-hidden group transition-all duration-200 bg-[var(--card-bg)] ${hasImage
                  ? 'hover:bg-[var(--card-bg)]'
                  : isNotInUse
                    ? 'hover:bg-amber-500/10 hover:border-amber-500/30'
                    : 'hover:bg-[var(--foreground)]'
                  }`}
              >
                {/* Background Image from Cloudinary - only rendered if available */}
                <RTOImage rtoCode={rto.code} city={rto.city} variant="tile" hasImage={hasImage} isInactive={isNotInUse} />

                {/* Dark overlay for text readability (only shows when image exists) */}
                {hasImage && (
                  <div className={`absolute inset-0 transition-colors duration-200 pointer-events-none ${isNotInUse
                      ? 'bg-neutral-900/50 group-hover:bg-neutral-900/60 dark:bg-neutral-800/50 dark:group-hover:bg-neutral-800/60'
                      : 'bg-black/40 group-hover:bg-black/50'
                    }`} />
                )}

                {/* RTO Code and City - Centered */}
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-2">
                  <span className={`text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight uppercase drop-shadow-lg transition-colors duration-200 ${hasImage
                    ? isNotInUse
                      ? 'text-white/70 line-through decoration-2 decoration-white/40'
                      : 'text-white'
                    : isNotInUse
                      ? 'text-[var(--muted-foreground)] opacity-60 group-hover:opacity-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 line-through decoration-2 decoration-amber-500/50'
                      : 'text-[var(--foreground)] group-hover:text-[var(--background)]'
                    }`}>
                    {rto.code}
                  </span>
                  <span className={`text-xs sm:text-sm font-medium uppercase tracking-wider drop-shadow-md mt-1 truncate max-w-full text-center ${hasImage
                    ? isNotInUse
                      ? 'text-white/60'
                      : 'text-white'
                    : isNotInUse
                      ? 'text-[var(--muted-foreground)] opacity-60 group-hover:opacity-100 group-hover:text-amber-600/80 dark:group-hover:text-amber-400/80'
                      : 'text-[var(--muted-foreground)] group-hover:text-[var(--background)]/80'
                    }`}>
                    {rto.city}
                  </span>
                  {needsRegion && (
                    <span className={`text-[10px] sm:text-xs font-normal uppercase tracking-wide drop-shadow-md truncate max-w-full text-center ${hasImage
                      ? isNotInUse
                        ? 'text-white/50'
                        : 'text-white/70'
                      : isNotInUse
                        ? 'text-[var(--muted-foreground)]/50 group-hover:text-amber-600/60 dark:group-hover:text-amber-400/60'
                        : 'text-[var(--muted-foreground)]/70 group-hover:text-[var(--background)]/60'
                      }`}>
                      {rto.region}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}

        {/* Contribute Card - Always show, but especially when no results */}
        {(filteredRTOs.length > 0 || searchQuery) && (
          <li className="aspect-square">
            <Link
              href="/contribute"
              className="w-full h-full border border-[var(--card-border)] relative overflow-hidden group flex items-center justify-center hover:bg-[var(--card-bg)] transition-all duration-200 bg-[var(--card-bg)]"
              aria-label="Contribute an RTO code to our database"
            >
              <div className="text-center">
                <span className="block text-[var(--muted)] text-sm uppercase tracking-wide font-bold mb-3">Contribute an RTO</span>
                {/* Rotated close icon as plus */}
                <div className="w-12 h-12 mx-auto rounded-full bg-[var(--muted-foreground)] flex items-center justify-center">
                  <svg className="w-5 h-5 rotate-45" viewBox="0 0 89.5 89.5" fill="var(--background)" aria-hidden="true">
                    <path d="M2.3,16.5l28.3,28.3L2.3,73.1c-3.1,3.1-3.1,8.2,0,11.3l2.8,2.8c3.1,3.1,8.2,3.1,11.3,0l28.3-28.3l28.3,28.3c3.1,3.1,8.2,3.1,11.3,0l2.8-2.8c3.1-3.1,3.1-8.2,0-11.3L58.9,44.8l28.3-28.3c3.1-3.1,3.1-8.2,0-11.3l-2.8-2.8c-3.1-3.1-8.2-3.1-11.3,0L44.8,30.6L16.5,2.3c-3.1-3.1-8.2-3.1-11.3,0L2.3,5.2C-0.8,8.3-0.8,13.4,2.3,16.5z" />
                  </svg>
                </div>
              </div>
            </Link>
          </li>
        )}

        {/* No results - contribute is already shown above */}
        {searchQuery && filteredRTOs.length === 0 && (
          <li className="col-span-full py-10 text-center order-first">
            <p className="text-[var(--muted)] text-lg">No RTOs found matching &quot;{searchQuery}&quot;</p>
          </li>
        )}
      </ul>
    </>
  );
}
