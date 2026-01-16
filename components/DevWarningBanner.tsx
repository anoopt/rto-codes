'use client';

import { useState, useEffect } from 'react';

/**
 * Check if Cloudinary is configured - evaluated at build time
 */
const isCloudinaryConfigured = !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/**
 * Development-only banner that warns when Cloudinary is not configured
 * Only shows in development mode and can be dismissed
 */
export default function DevWarningBanner() {
    const [isDismissed, setIsDismissed] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsMounted(true);
        // Check sessionStorage to see if user already dismissed
        const wasDismissed = sessionStorage.getItem('devWarningDismissed') === 'true';
        if (wasDismissed) {
            setIsDismissed(true);
        }
    }, []);

    const handleDismiss = () => {
        setIsDismissed(true);
        sessionStorage.setItem('devWarningDismissed', 'true');
    };

    // Don't render on server or in production or if Cloudinary is configured
    const shouldHide = !isMounted || process.env.NODE_ENV !== 'development' || isCloudinaryConfigured || isDismissed;

    if (shouldHide) {
        return null;
    }

    return (
        <>
            {/* Fixed banner below the header (header is h-12 = 48px) */}
            <div className="fixed top-12 left-0 right-0 bg-amber-500 text-amber-950 px-4 py-2 text-sm z-40 shadow-md">
                <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
                    <p className="flex items-center gap-2 text-center">
                        <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>
                            <strong>Dev Mode:</strong> Images not loading.{' '}
                            <code className="bg-amber-600/30 px-1 py-0.5 rounded text-xs font-mono">
                                NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
                            </code>{' '}
                            not set.{' '}
                            <a
                                href="https://github.com/anoopt/rto-codes#environment-variables"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:no-underline font-semibold"
                            >
                                Fix it →
                            </a>
                        </span>
                    </p>
                    <button
                        onClick={handleDismiss}
                        className="shrink-0 p-1 hover:bg-amber-600/30 rounded transition-colors"
                        aria-label="Dismiss warning"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            {/* Spacer to push content below the banner (banner height ~36px) */}
            <div className="h-9" />
        </>
    );
}
