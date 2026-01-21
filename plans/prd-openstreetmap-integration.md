# PRD: OpenStreetMap Integration for District Maps

## Introduction

Add OpenStreetMap (OSM) as an alternative mapping solution to the existing SVG district maps. This provides an easier-to-maintain option for displaying interactive district maps without the manual effort of creating custom SVG files for each state. Users can click on districts to navigate to their respective RTOs, with enhanced interactivity including zoom, pan, hover highlighting, and city/town markers for districts with multiple RTOs.

The feature will use an app-level feature flag (`NEXT_PUBLIC_OSM_ENABLED`) to enable OSM maps globally, allowing for testing and gradual rollout before making it the default.

## Goals

- Provide an alternative to SVG maps that requires no manual map creation
- Enable district click-to-navigate functionality using OpenStreetMap
- Add zoom, pan, and hover highlighting capabilities for enhanced user experience
- Display city/town markers for districts with multiple RTOs (e.g., Bengaluru with KA-01, KA-02, KA-03)
- Use free OSM tile servers to keep infrastructure costs at zero
- Create a scalable solution that works for all states without custom map files
- Use app-level feature flag for easy testing and gradual rollout
- Maintain backward compatibility with existing SVG maps
- Implement as MVP with one state (Karnataka) before expanding

## User Stories

### US-001: Add app-level OSM feature flag

**Description:** As a developer, I need an environment variable to enable/disable OSM maps globally so I can test and roll out the feature safely.

**Acceptance Criteria:**

- [ ] Add `NEXT_PUBLIC_OSM_ENABLED` environment variable (true/false)
- [ ] Create utility function to check if OSM is enabled
- [ ] Default to 'false' (use SVG maps) when not set
- [ ] Document in .env.example with description
- [ ] Typecheck passes
- [ ] Add unit test for feature flag utility function

### US-002: Create OpenStreetMap district map component

**Description:** As a user viewing an RTO page, I want to see an interactive OpenStreetMap showing the district so I can explore the region geographically.

**Acceptance Criteria:**

- [ ] Create `OSMDistrictMap.tsx` component that accepts state and district props
- [ ] Component renders Leaflet/React-Leaflet map centered on the district
- [ ] Uses free OSM tile servers (OpenStreetMap.org or similar)
- [ ] Map shows appropriate zoom level for district view
- [ ] Typecheck passes

### US-003: Implement district boundary detection and highlighting

**Description:** As a user hovering over districts on the map, I want to see them highlighted so I know which district I'm about to click.

**Acceptance Criteria:**

- [ ] Fetch district boundaries using Overpass API or Nominatim
- [ ] Display district polygons on the map
- [ ] Highlight district on hover with distinct color/border
- [ ] Show district name in tooltip on hover
- [ ] Typecheck passes

### US-004: Add click-to-navigate functionality for districts

**Description:** As a user, I want to click on a district to navigate to that district's RTO page, just like the current SVG maps.

**Acceptance Criteria:**

- [ ] Clicking a district navigates to the appropriate RTO code page
- [ ] Handle districts with multiple RTOs (show list or navigate to primary)
- [ ] Visual feedback on click (brief highlight/animation)
- [ ] Works consistently across different zoom levels
- [ ] Typecheck passes

### US-005: Add zoom and pan controls

**Description:** As a user, I want to zoom in/out and pan around the map to explore different areas in detail.

**Acceptance Criteria:**

- [ ] Default Leaflet zoom controls visible (+/- buttons)
- [ ] Mouse wheel zoom enabled
- [ ] Click-and-drag panning enabled
- [ ] Double-click zoom enabled
- [ ] Mobile touch gestures work (pinch-to-zoom, swipe-to-pan)
- [ ] Typecheck passes

### US-006: Integrate OSM map into RTO detail page

**Description:** As a user viewing an RTO detail page, I want to see the OSM map when the state uses OSM (instead of SVG) so I have consistent access to district navigation.

**Acceptance Criteria:**

- [ ] Update `app/rto/[code]/page.tsx` to conditionally render OSM or SVG map based on state config
- [ ] OSM map appears in the same location as SVG map
- [ ] Map section has similar styling/layout to SVG version
- [ ] No console errors or warnings
- [ ] Typecheck passes

### US-007: Display city/town markers for multi-RTO districts

**Description:** As a user viewing a district with multiple RTOs in different cities/towns, I want to see markers for each city/town so I can navigate to the specific RTO I need.

**Acceptance Criteria:**

- [ ] Display markers for each city/town that has an RTO within the district
- [ ] Markers show city/town name and RTO code on hover
- [ ] Clicking a marker navigates to that RTO's detail page
- [ ] Markers use consistent icon styling (color-coded or numbered)
- [ ] Markers are visible at appropriate zoom levels
- [ ] Handle overlapping markers gracefully (cluster or offset)
- [ ] Typecheck passes

### US-008: Add loading and error states for OSM maps

**Description:** As a user, I want to see appropriate feedback when the map is loading or if it fails to load.

**Acceptance Criteria:**

- [ ] Show loading spinner while map tiles and boundaries load
- [ ] Display error message if map fails to load
- [ ] Provide fallback message with link to state page if boundaries unavailable
- [ ] Error states don't break page layout
- [ ] Typecheck passes

### US-009: Document OSM map usage and configuration

**Description:** As a maintainer, I need documentation explaining how to enable OSM maps so I can roll out this feature systematically.

**Acceptance Criteria:**

- [ ] Add OSM section to STRUCTURE.md explaining feature flag configuration
- [ ] Document NEXT_PUBLIC_OSM_ENABLED in .env.example
- [ ] Include example of enabling OSM globally
- [ ] Explain OSM API usage and rate limits
- [ ] Document city/town marker behavior
- [ ] Add troubleshooting section for common OSM issues

## Functional Requirements

- FR-1: Add `NEXT_PUBLIC_OSM_ENABLED` environment variable to enable/disable OSM maps app-wide
- FR-2: Create utility function to check if OSM is enabled (defaults to false)
- FR-3: Create OSMDistrictMap component using Leaflet/React-Leaflet library
- FR-4: Use free OpenStreetMap tile servers (e.g., `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`)
- FR-5: Fetch district administrative boundaries using OSM Overpass API or Nominatim
- FR-6: Display district boundaries as clickable polygons on the map
- FR-7: Highlight districts on hover with color change and tooltip showing district name
- FR-8: Navigate to RTO page when district polygon is clicked
- FR-9: For districts with multiple RTOs, display markers at each city/town location
- FR-10: Show city/town name and RTO code in marker tooltip on hover
- FR-11: Navigate to specific RTO page when marker is clicked
- FR-12: Enable zoom controls (+/- buttons, mouse wheel, double-click)
- FR-13: Enable pan controls (click-and-drag, keyboard arrows)
- FR-14: Support mobile touch gestures (pinch-to-zoom, two-finger pan)
- FR-15: Center map on the district being viewed (from RTO page context)
- FR-16: Conditionally render OSM or SVG map based on NEXT_PUBLIC_OSM_ENABLED flag
- FR-17: Display loading state while map tiles, boundaries, and markers load
- FR-18: Display error state if map or boundaries fail to load
- FR-19: Implement for Karnataka as initial test state before expanding

## Non-Goals (Out of Scope)

- No custom tile server hosting or caching infrastructure
- No offline map support
- No custom map styling or theming beyond basic Leaflet defaults
- No search functionality within the map
- No route planning or directions
- No integration with Google Maps, Mapbox, or other paid services
- No automatic migration of existing SVG states to OSM
- No A/B testing between map types
- No per-user map type toggle (feature flag only, not UI toggle)
- No showing all state RTOs on a single map view
- No real-time RTO status indicators on markers

## Design Considerations

### UI/UX Requirements

- **Map Container:** Same dimensions as current SVG map container (responsive)
- **Styling:** Maintain consistent dark/light theme support
- **Loading State:** Use existing loading spinner/skeleton pattern
- **Mobile:** Map must be fully functional on mobile devices
- **Accessibility:** Add appropriate ARIA labels for map controls

### Existing Components to Reuse

- `MapHint.tsx` - Can adapt for OSM usage instructions
- Existing map container styling from SVG implementation
- Loading states from other components
- Error boundary patterns

### Visual Consistency

- Map should feel like a natural part of the RTO detail page
- District highlighting should use brand colors (maintain theme)
- Tooltips should match existing tooltip styling

## Technical Considerations

### Libraries

- **Leaflet:** Industry-standard open-source mapping library
- **React-Leaflet:** Official React bindings for Leaflet
- Install: `bun add leaflet react-leaflet`
- Install types: `bun add -d @types/leaflet`

### OSM Data Sources

- **Tile Server:** `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
  - Usage Policy: Include attribution, respect rate limits
  - Alternative: `https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png` (Humanitarian OSM)
- **Boundaries:** Overpass API (Nominatim as fallback)
  - Query: `[out:json];relation["admin_level"="5"]["name"="District Name"];out geom;`
  - Cache boundary data to minimize API calls
  - Rate limit: Max 2 requests per second

### Performance

- Lazy load React-Leaflet only when OSM map is needed
- Cache district boundary GeoJSON data (local state or localStorage)
- Cache city/town geocoded coordinates (localStorage with TTL)
- Debounce hover events to prevent excessive re-renders
- Use Leaflet's built-in tile caching
- Use marker clustering for districts with many RTOs (if needed)
- Limit geocoding requests to avoid rate limits

### Server vs Client Components

- OSM map must be a Client Component (interactive)
- Wrap in dynamic import with `ssr: false` to prevent hydration issues
- Parent page can remain Server Component

### Integration Points

- Modify `app/rto/[code]/page.tsx` to check OSM feature flag
- Create `lib/feature-flags.ts` utility to check NEXT_PUBLIC_OSM_ENABLED
- No changes needed to state config files

### Data Requirements

- Need reliable mapping from district names to OSM administrative boundaries
- May need to store district name variations (e.g., "Bengaluru Urban" vs "Bangalore Urban")
- Consider creating a district-to-OSM-ID mapping file if boundary queries are unreliable
- Need city/town coordinates for marker placement (can use Nominatim geocoding or store in RTO data)
- For multi-RTO districts, identify which city/town each RTO serves (use existing `city` field in RTOCode)
- Consider caching geocoded city/town coordinates to avoid repeated API calls

## Success Metrics

- OSM map loads successfully for Karnataka RTOs within 2 seconds on average
- District click navigation works 100% of the time
- City/town markers display correctly for all multi-RTO districts
- Marker click navigation works 100% of the time
- No increase in page load time when feature flag is disabled
- Zero API rate limit errors from OSM services
- Map is fully functional on mobile devices (iOS/Android)
- Map maintains performance with 20+ districts and 50+ markers displayed

## Open Questions

1. **District Boundary Reliability:** How reliable is OSM's administrative boundary data for Indian districts? Should we pre-fetch and cache boundaries for all districts?

2. **Marker Geocoding:** Should we:
   - Use Nominatim API to geocode city/town names on-the-fly
   - Pre-geocode and store coordinates in RTO data files
   - Use a combination (geocode once, cache forever)

3. **Marker Clustering:** For districts with many RTOs (e.g., Bengaluru with 15+), should we:
   - Use marker clustering to group nearby markers at lower zoom levels
   - Display all markers at all zoom levels
   - Only show markers when zoomed in past a certain level

4. **Boundary Fallback:** If district boundaries aren't available via OSM, should we:
   - Fall back to just showing a centered map with markers only
   - Show an error message
   - Automatically fall back to SVG if available

5. **State Naming:** Do OSM administrative boundaries use English names consistently for all Indian states/districts, or will we need name translation/mapping?

6. **Attribution Placement:** Where should we place the required OSM attribution text to comply with usage policies while maintaining design aesthetics?

7. **Rate Limiting:** Should we implement a boundary/geocoding cache service/API to avoid hitting OSM rate limits, or is client-side localStorage caching sufficient?

8. **Testing Rollout:** Should we enable the feature flag:
   - Only in development initially
   - In production but document as experimental
   - Wait until fully stable before production

9. **Marker Icons:** Should markers be:
   - Color-coded by status (active/inactive)
   - Numbered (KA-01, KA-02, etc.)
   - Generic pin icons with tooltip only

---

## Implementation Notes for Developers

This is an MVP implementation. Start with Karnataka since it already has complete RTO data and an SVG map for comparison. Test thoroughly before expanding to other states.

Key files to create/modify:

- `.env.example` - Add NEXT_PUBLIC_OSM_ENABLED documentation
- `.env.local` - Set NEXT_PUBLIC_OSM_ENABLED=true for testing
- `lib/feature-flags.ts` - Create utility to check feature flag (new file)
- `components/OSMDistrictMap.tsx` - New component (create)
- `app/rto/[code]/page.tsx` - Conditional map rendering based on feature flag
- `lib/rto-data.ts` - Add function to get all RTOs for a district (for markers)

Environment variable example:

```bash
# Enable OpenStreetMap integration (default: false)
NEXT_PUBLIC_OSM_ENABLED=true
```

Remember to respect OSM's usage policies and rate limits throughout implementation. Consider pre-geocoding city/town coordinates to minimize API calls.
