'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useCallback } from 'react';
import { ShuffleIcon } from '@/components/icons';

interface ShuffleButtonProps {
    currentCode: string;
    allCodes: string[];
    className?: string;
}

// Prefetch all pages for guaranteed instant navigation
// Set NEXT_PUBLIC_PREFETCH_ALL_RTOS=false to prefetch only 10 random pages
const PREFETCH_ALL = process.env.NEXT_PUBLIC_PREFETCH_ALL_RTOS !== 'false';

/**
 * Client-side shuffle button that navigates to a random RTO
 * 
 * This component computes the random selection at click time (not build time)
 * to avoid the static generation issue where the same random values
 * get baked into the HTML.
 * 
 * It prefetches several random pages on mount for instant navigation.
 */
export default function ShuffleButton({ currentCode, allCodes, className = '' }: ShuffleButtonProps) {
    const router = useRouter();
    const prefetchedCodes = useRef<Set<string>>(new Set());

    // Get codes excluding current
    const getOtherCodes = useCallback(() => {
        return allCodes.filter(c => c !== currentCode.toLowerCase());
    }, [allCodes, currentCode]);

    // Prefetch pages on mount for instant navigation
    useEffect(() => {
        const otherCodes = getOtherCodes();
        if (otherCodes.length === 0) return;

        // Prefetch all or a subset of codes
        const toPrefetch = PREFETCH_ALL
            ? otherCodes
            : [...otherCodes].sort(() => Math.random() - 0.5).slice(0, 10);

        toPrefetch.forEach(code => {
            if (!prefetchedCodes.current.has(code)) {
                router.prefetch(`/rto/${code}`);
                prefetchedCodes.current.add(code);
            }
        });
    }, [router, getOtherCodes]);

    const handleShuffle = () => {
        const otherCodes = getOtherCodes();

        if (otherCodes.length === 0) {
            return; // No other RTOs to navigate to
        }

        // Generate random index at click time (not build time!)
        const randomIndex = Math.floor(Math.random() * otherCodes.length);
        const randomCode = otherCodes[randomIndex];

        router.push(`/rto/${randomCode}`);
    };

    return (
        <button
            onClick={handleShuffle}
            className={`w-10 h-10 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-[var(--card-bg)] transition-all cursor-pointer group relative ${className}`}
            aria-label="View random RTO"
        >
            <ShuffleIcon />
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 bg-[var(--tooltip-bg)] text-[var(--tooltip-text)] text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md z-50 after:content-[''] after:absolute after:bottom-full after:left-1/2 after:-ml-[5px] after:border-[5px] after:border-solid after:border-b-[var(--tooltip-bg)] after:border-x-transparent after:border-t-transparent">
                Shuffle
            </span>
        </button>
    );
}
