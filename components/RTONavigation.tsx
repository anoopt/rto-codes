'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';

interface RTONavigationProps {
  currentCode: string;
  allCodes: string[];
  className?: string;
}

/**
 * Client-side RTO navigation component with next/previous functionality
 * 
 * Features:
 * - Previous/Next navigation buttons
 * - Keyboard shortcuts (ArrowLeft/ArrowRight)
 * - Smooth page transitions
 * - Prefetching for instant navigation
 */
export default function RTONavigation({ currentCode, allCodes, className = '' }: RTONavigationProps) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const prefetchedCodes = useRef<Set<string>>(new Set());

  // Get current index and adjacent RTOs
  const currentIndex = allCodes.findIndex(code => code === currentCode.toLowerCase());
  const prevCode = currentIndex > 0 ? allCodes[currentIndex - 1] : null;
  const nextCode = currentIndex < allCodes.length - 1 ? allCodes[currentIndex + 1] : null;

  // Prefetch adjacent pages for instant navigation
  useEffect(() => {
    if (prevCode && !prefetchedCodes.current.has(prevCode)) {
      router.prefetch(`/rto/${prevCode}`);
      prefetchedCodes.current.add(prevCode);
    }
    if (nextCode && !prefetchedCodes.current.has(nextCode)) {
      router.prefetch(`/rto/${nextCode}`);
      prefetchedCodes.current.add(nextCode);
    }
  }, [router, prevCode, nextCode]);

  const navigateTo = (code: string | null) => {
    if (!code || isNavigating) return;

    setIsNavigating(true);
    router.push(`/rto/${code}`);

    // Reset navigation state after a short delay
    setTimeout(() => setIsNavigating(false), 300);
  };

  const handlePrevious = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!prevCode || isNavigating) return;
    navigateTo(prevCode);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!nextCode || isNavigating) return;
    navigateTo(nextCode);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft' && prevCode && !isNavigating) {
        e.preventDefault();
        navigateTo(prevCode);
      } else if (e.key === 'ArrowRight' && nextCode && !isNavigating) {
        e.preventDefault();
        navigateTo(nextCode);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevCode, nextCode, isNavigating]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Previous Button */}
      <button
        onClick={handlePrevious}
        disabled={!prevCode || isNavigating}
        className={`
          w-10 h-10 flex items-center justify-center 
          transition-all duration-200 ease-out
          ${prevCode && !isNavigating
            ? 'hover:bg-[var(--card-bg)] hover:scale-110 active:scale-95 opacity-100'
            : 'opacity-30 cursor-not-allowed'
          }
        `}
        aria-label="Previous RTO"
        title={prevCode ? `Previous: ${prevCode.toUpperCase()}` : 'No previous RTO'}
      >
        <ChevronLeftIcon className={`transition-transform ${!isNavigating && prevCode ? 'group-hover:-translate-x-0.5' : ''}`} />
      </button>

      {/* Navigation Hint (desktop only) */}
      <div className="hidden md:flex items-center gap-1 text-xs text-[var(--muted-foreground)] opacity-60">
        <span className="px-1.5 py-0.5 bg-[var(--card-bg)] rounded text-[10px] font-mono">←</span>
        <span>/</span>
        <span className="px-1.5 py-0.5 bg-[var(--card-bg)] rounded text-[10px] font-mono">→</span>
      </div>

      {/* Next Button */}
      <button
        onClick={handleNext}
        disabled={!nextCode || isNavigating}
        className={`
          w-10 h-10 flex items-center justify-center 
          transition-all duration-200 ease-out
          ${nextCode && !isNavigating
            ? 'hover:bg-[var(--card-bg)] hover:scale-110 active:scale-95 opacity-100'
            : 'opacity-30 cursor-not-allowed'
          }
        `}
        aria-label="Next RTO"
        title={nextCode ? `Next: ${nextCode.toUpperCase()}` : 'No next RTO'}
      >
        <ChevronRightIcon className={`transition-transform ${!isNavigating && nextCode ? 'group-hover:translate-x-0.5' : ''}`} />
      </button>
    </div>
  );
}
