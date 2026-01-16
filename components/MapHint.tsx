'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'rto-map-hint-dismissed';

interface MapHintProps {
    /** Called when the user interacts with the map (dismisses hint) */
    onMapInteraction?: () => void;
}

/**
 * First-time hint tooltip for the interactive district map.
 * Only shows once per browser (uses localStorage).
 */
export default function MapHint({ onMapInteraction }: MapHintProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(true);

    useEffect(() => {
        // Check if hint was already dismissed (must be exactly 'true')
        const dismissed = localStorage.getItem(STORAGE_KEY) === 'true';
        if (!dismissed) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsDismissed(false);
            // Small delay before showing for smoother UX
            const timer = setTimeout(() => setIsVisible(true), 500);
            return () => clearTimeout(timer);
        }
    }, []);

    const dismiss = () => {
        setIsVisible(false);
        localStorage.setItem(STORAGE_KEY, 'true');
        setTimeout(() => setIsDismissed(true), 300); // Wait for fade out
    };

    // Auto-dismiss after 10 seconds
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                dismiss();
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    // Expose dismiss function for parent to call on map interaction
    useEffect(() => {
        if (onMapInteraction && isVisible) {
            // This is a bit hacky - ideally we'd use a ref or callback
            // For now, the parent can call dismiss via the storage check
        }
    }, [onMapInteraction, isVisible]);

    if (isDismissed) return null;

    return (
        <div
            className={`
        relative flex items-center justify-center gap-2
        bg-[var(--accent)] text-white
        px-4 py-2 rounded-lg
        text-sm font-medium
        shadow-lg
        transition-all duration-300
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
        >
            {/* Hint icon */}
            <span className="text-base">💡</span>

            {/* Hint text */}
            <span>Click any district to explore its RTOs</span>

            {/* Dismiss button */}
            <button
                onClick={dismiss}
                className="ml-2 p-1 hover:bg-white/20 rounded transition-colors"
                aria-label="Dismiss hint"
            >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                </svg>
            </button>

            {/* Arrow pointing down to map */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-[var(--accent)]" />
        </div>
    );
}

/**
 * Hook to check if the map hint should be shown and dismiss it
 */
export function useMapHint() {
    const [shouldShow, setShouldShow] = useState(false);

    useEffect(() => {
        const dismissed = localStorage.getItem(STORAGE_KEY) === 'true';
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShouldShow(!dismissed);
    }, []);

    const dismiss = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setShouldShow(false);
    };

    return { shouldShow, dismiss };
}
