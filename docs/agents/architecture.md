# Architecture & UI Guidelines

## React Patterns

- **Server Components (Default)**: Use async components for data fetching.
- **Client Components**: Use `"use client"` only for interactivity (e.g., `SearchBar`).
- **Path Aliases**: Always use `@/` for imports (e.g., `@/components/...`).

## Styling (Tailwind 4)

- Dark mode is the default theme.
- Use `next-themes` for theme switching.
- Use semantic utility classes.

## Performance

- Prioritize Static Site Generation (SSG).
- Images are handled via Cloudinary.
