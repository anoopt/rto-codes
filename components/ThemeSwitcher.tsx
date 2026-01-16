'use client';

import { useTheme } from 'next-themes';

export function ThemeSwitcher() {
    const { setTheme, resolvedTheme } = useTheme();

    const toggleTheme = () => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    };

    // Use a single icon approach with CSS classes that respond to html[class] 
    // set by next-themes. This prevents flash because the CSS applies immediately
    // based on the class already present on <html>.
    return (
        <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-bg)] transition-colors relative"
            aria-label="Toggle theme"
            title="Toggle theme"
            suppressHydrationWarning
        >
            {/* Sun icon - visible in dark mode (html.dark) */}
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 absolute dark:opacity-100 opacity-0 transition-opacity duration-150"
                suppressHydrationWarning
            >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
            </svg>
            {/* Moon icon - visible in light mode (not html.dark) */}
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 dark:opacity-0 opacity-100 transition-opacity duration-150"
                suppressHydrationWarning
            >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
        </button>
    );
}
