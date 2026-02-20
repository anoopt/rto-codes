'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Header from './Header';

export default function PersistentHeader() {
    const pathname = usePathname();
    const [searchQuery, setSearchQuery] = useState('');

    // Show full navigation on all pages
    const variant = 'full';

    // Show search only on homepage
    const showSearch = pathname === '/';

    // Handler to clear search when clicking home link
    const handleHomeClick = () => {
        setSearchQuery('');
    };

    // Listen for home link clicks
    useEffect(() => {
        window.addEventListener('clearHomeSearch', handleHomeClick);
        return () => window.removeEventListener('clearHomeSearch', handleHomeClick);
    }, []);

    // Broadcast search changes to HomePage via custom event
    useEffect(() => {
        if (pathname === '/' && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('headerSearchChange', { detail: searchQuery }));
        }
    }, [searchQuery, pathname]);

    // Listen for WebMCP agent-initiated search events
    useEffect(() => {
        const handleAgentSearch = (e: Event) => {
            const customEvent = e as CustomEvent<string>;
            if (pathname === '/') {
                setSearchQuery(customEvent.detail);
            }
        };

        window.addEventListener('webmcpSearch', handleAgentSearch);
        return () => window.removeEventListener('webmcpSearch', handleAgentSearch);
    }, [pathname]);

    // Handle search value changes - clear when not on homepage
    const handleSearchChange = (value: string) => {
        // Only allow search on homepage
        if (pathname === '/') {
            setSearchQuery(value);
        }
    };

    // Clear search when pathname changes and we're not on homepage
    useEffect(() => {
        // When pathname changes, reset if we're not on homepage
        // This uses a ref-like pattern to avoid setState in effect
        const shouldClear = pathname !== '/';
        if (shouldClear && searchQuery) {
            // Use setTimeout to avoid setState in effect
            const timer = setTimeout(() => setSearchQuery(''), 0);
            return () => clearTimeout(timer);
        }
    }, [pathname, searchQuery]);

    return (
        <Header
            variant={variant}
            showSearch={showSearch}
            searchValue={pathname === '/' ? searchQuery : ''}
            onSearchChange={handleSearchChange}
        />
    );
}

