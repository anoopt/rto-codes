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

## Maps

Maps are rendered using OpenStreetMap with React-Leaflet:

| Component        | Data Source                 | Use Case                               |
| :--------------- | :-------------------------- | :------------------------------------- |
| `OSMStateMap`    | Static JSON + OpenStreetMap | State map with all district boundaries |
| `OSMDistrictMap` | Static JSON + OpenStreetMap | Single district view with RTO markers  |

### OSM Map Architecture

- **Boundaries**: `lib/osm-boundaries.ts` loads from `public/data/{state}/boundaries.json`
- **Coordinates**: `lib/osm-geocoding.ts` loads from `public/data/{state}/coordinates.json`
- **Caching**: In-memory → Static JSON → localStorage fallback
- **Rendering**: React-Leaflet with GeoJSON for district polygons
