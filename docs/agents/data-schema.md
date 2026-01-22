# Data & RTO Management

## RTO JSON Conventions

- **Path**: `data/[state-name]/[statecode-number].json` (e.g., `data/karnataka/ka-01.json`).
- **Required Fields**: `code`, `region`, `city`, `state`, `stateCode`, `district`.
- **Statuses**: `active`, `not-in-use` (requires `redirectTo`), or `discontinued`.

## State Config (`data/[state]/config.json`)

Each state has a `config.json` with:

```typescript
interface StateConfig {
  stateCode: string; // e.g., "KA"
  name: string; // e.g., "Karnataka"
  displayName: string; // Display name
  capital: string;
  totalRTOs: number;
  districtMapping: Record<string, string>; // District → OSM boundary ID mapping
  isComplete: boolean; // True when all RTOs added
  type: "state" | "union-territory";
  osmEnabled?: boolean; // Enable OSM maps for this state
}
```

### `osmEnabled` Flag

Controls whether OpenStreetMap-based maps are shown for this state:

- Requires `NEXT_PUBLIC_OSM_ENABLED=true` globally AND `osmEnabled: true` in state config
- Set to `true` only after verifying OSM data quality (boundaries + coordinates)
- If unhappy with map quality, set to `false` to hide maps for that state

Currently enabled: Karnataka, Goa

## Interfaces

### RTOCode

```typescript
interface RTOCode {
  code: string;
  region: string;
  city: string;
  state: string;
  stateCode: string;
  district?: string;
  status?: "active" | "not-in-use" | "discontinued";
  // ... see types/rto.ts for full list
}
```
