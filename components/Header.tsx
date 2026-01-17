'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ThemeSwitcher } from './ThemeSwitcher';

interface HeaderProps {
    /** Whether to show full navigation (used on homepage) or just the logo link */
    variant?: 'full' | 'minimal';
    /** Search value (controlled) */
    searchValue?: string;
    /** Callback when search value changes */
    onSearchChange?: (value: string) => void;
    /** Whether to show search functionality */
    showSearch?: boolean;
}

export default function Header({
    variant = 'minimal',
    searchValue = '',
    onSearchChange,
    showSearch = false
}: HeaderProps) {
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();

    // State for hover indicator
    const [hoverIndicator, setHoverIndicator] = useState<{ left: number; width: number } | null>(null);
    const [activeIndicator, setActiveIndicator] = useState<{ left: number; width: number } | null>(null);
    const navRef = useRef<HTMLDivElement>(null);
    const hasCalculatedRef = useRef(false);

    // Calculate active indicator position immediately on mount (no animation)
    useEffect(() => {
        if (!navRef.current) return;

        const activeLink = navRef.current.querySelector('[data-active="true"]') as HTMLElement;
        if (activeLink) {
            const navRect = navRef.current.getBoundingClientRect();
            const linkRect = activeLink.getBoundingClientRect();
            setActiveIndicator({
                left: linkRect.left - navRect.left,
                width: linkRect.width
            });
            hasCalculatedRef.current = true;
        } else {
            setActiveIndicator(null);
        }
    }, [pathname]);

    // Focus input when expanded
    useEffect(() => {
        if (isSearchExpanded && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchExpanded]);

    // Close expanded search when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (isSearchExpanded && searchContainerRef.current && !searchContainerRef.current.contains(target)) {
                setIsSearchExpanded(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isSearchExpanded]);

    // Handle escape key to close search
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isSearchExpanded) {
                setIsSearchExpanded(false);
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isSearchExpanded]);

    const handleSearchClick = () => {
        setIsSearchExpanded(true);
    };

    const handleCloseSearch = () => {
        setIsSearchExpanded(false);
        if (onSearchChange) {
            onSearchChange('');
        }
    };

    const handleNavHover = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (!navRef.current) return;
        const target = e.currentTarget;
        const navRect = navRef.current.getBoundingClientRect();
        const linkRect = target.getBoundingClientRect();
        setHoverIndicator({
            left: linkRect.left - navRect.left,
            width: linkRect.width
        });
    };

    const handleNavLeave = () => {
        setHoverIndicator(null);
    };

    const searchButton = (
        <button
            onClick={handleSearchClick}
            className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-bg)] transition-colors"
            aria-label="Open search"
        >
            <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        </button>
    );

    const expandedSearch = (
        <div
            ref={searchContainerRef}
            className="absolute inset-0 bg-[var(--header-bg)] flex items-center px-4 animate-search-expand"
        >
            {/* Close button */}
            <button
                onClick={handleCloseSearch}
                className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-bg)] transition-colors mr-3 shrink-0"
                aria-label="Close search"
            >
                <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    aria-hidden="true"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            {/* Search input */}
            <div className="flex-1 relative">
                <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    aria-hidden="true"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <label htmlFor="header-search" className="sr-only">
                    Search RTO codes by code, region, city, or district
                </label>
                <input
                    ref={searchInputRef}
                    id="header-search"
                    type="text"
                    placeholder="Find your RTO..."
                    value={searchValue}
                    onChange={(e) => onSearchChange?.(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 text-sm rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all duration-300"
                />
                {/* Clear Button */}
                {searchValue && (
                    <button
                        onClick={() => {
                            onSearchChange?.('');
                            searchInputRef.current?.focus();
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)] hover:text-red-500 transition-colors"
                        aria-label="Clear search"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Theme switcher stays visible */}
            <div className="ml-3 shrink-0">
                <ThemeSwitcher />
            </div>
        </div>
    );

    if (variant === 'full') {
        return (
            <header className="fixed top-0 left-0 right-0 z-50 h-12 bg-[var(--header-bg)] backdrop-blur-sm border-b border-[var(--header-border)] transition-colors duration-300">
                <nav className="h-full flex items-center justify-between px-4 relative">
                    {/* Normal header content */}
                    <div
                        ref={navRef}
                        className={`flex items-center gap-6 relative transition-opacity duration-200 ${isSearchExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                        onMouseLeave={handleNavLeave}
                    >
                        {/* Hover indicator */}
                        <div
                            className="absolute bottom-0 h-0.5 bg-[var(--accent)] pointer-events-none"
                            style={{
                                left: hoverIndicator ? `${hoverIndicator.left}px` : activeIndicator ? `${activeIndicator.left}px` : '0px',
                                width: hoverIndicator ? `${hoverIndicator.width}px` : activeIndicator ? `${activeIndicator.width}px` : '0px',
                                opacity: hoverIndicator || activeIndicator ? 1 : 0,
                                transition: hoverIndicator ? 'left 0.3s ease-out, width 0.3s ease-out' : 'none',
                            }}
                        />

                        <Link
                            href="/"
                            data-active={pathname === '/'}
                            onMouseEnter={handleNavHover}
                            className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-bold tracking-wider text-xs sm:text-sm uppercase transition-colors relative py-1"
                        >
                            RTO Codes
                        </Link>
                        <Link
                            href="/about"
                            data-active={pathname === '/about'}
                            onMouseEnter={handleNavHover}
                            className="text-[var(--muted)] hover:text-[var(--foreground)] text-xs sm:text-sm uppercase tracking-wide transition-colors relative py-1"
                        >
                            About
                        </Link>
                        <Link
                            href="/contribute"
                            data-active={pathname === '/contribute'}
                            onMouseEnter={handleNavHover}
                            className="text-[var(--muted)] hover:text-[var(--foreground)] text-xs sm:text-sm uppercase tracking-wide transition-colors relative py-1"
                        >
                            Contribute
                        </Link>
                    </div>
                    <div className={`flex items-center gap-2 -mt-0.5 transition-opacity duration-200 ${isSearchExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                        {showSearch && searchButton}
                        <ThemeSwitcher />
                    </div>

                    {/* Expanded search overlay */}
                    {isSearchExpanded && showSearch && expandedSearch}
                </nav>
            </header>
        );
    }

    // Minimal variant - full-width bar like Bun.js
    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-12 bg-[var(--header-bg)] backdrop-blur-sm border-b border-[var(--header-border)] transition-colors duration-300">
            <nav className="h-full flex items-center justify-between px-4 relative">
                <Link
                    href="/"
                    className={`text-[var(--accent)] hover:text-[var(--accent-hover)] font-bold tracking-wider text-xs sm:text-sm uppercase transition-all duration-200 ${isSearchExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                >
                    RTO Codes
                </Link>
                <div className={`flex items-center gap-2 -mt-0.5 transition-opacity duration-200 ${isSearchExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    {showSearch && searchButton}
                    <ThemeSwitcher />
                </div>

                {/* Expanded search overlay */}
                {isSearchExpanded && showSearch && expandedSearch}
            </nav>
        </header>
    );
}
