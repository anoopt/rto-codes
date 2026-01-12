'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'rto-swipe-hint-dismissed';

/**
 * First-time swipe hint for mobile/tablet users.
 * Only shows once per browser (uses localStorage).
 */
export default function SwipeHint() {
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(true);

    useEffect(() => {
        // Check if hint was already dismissed (must be exactly 'true')
        const dismissed = localStorage.getItem(STORAGE_KEY) === 'true';
        if (!dismissed) {
            setIsDismissed(false);
            // Small delay before showing for smoother UX
            const timer = setTimeout(() => setIsVisible(true), 800);
            return () => clearTimeout(timer);
        }
    }, []);

    // Auto-dismiss after 5 seconds
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                dismiss();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    const dismiss = () => {
        setIsVisible(false);
        localStorage.setItem(STORAGE_KEY, 'true');
        setTimeout(() => setIsDismissed(true), 300); // Wait for fade out
    };

    if (isDismissed) return null;

    return (
        <div
            onClick={dismiss}
            className={`
                fixed bottom-24 left-1/2 -translate-x-1/2 z-50
                flex items-center justify-center gap-3
                bg-[var(--tooltip-bg)] text-[var(--tooltip-text)]
                px-5 py-3 rounded-full
                text-sm font-medium text-center
                shadow-lg backdrop-blur-sm
                cursor-pointer
                transition-all duration-300
                md:hidden
                ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
            `}
            role="tooltip"
            aria-label="Swipe left or right to navigate between RTOs"
        >
            {/* Left swipe indicator */}
            <svg className="w-5 h-5 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
            </svg>

            {/* Hint text */}
            <span>Swipe to navigate</span>

            {/* Right swipe indicator */}
            <svg className="w-5 h-5 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
            </svg>
        </div>
    );
}

/**
 * Hook to dismiss the swipe hint programmatically (e.g., when user swipes)
 */
export function useDismissSwipeHint() {
    const dismiss = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
    };

    return { dismiss };
}
