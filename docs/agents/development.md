# Scripts & Environment

## Environment Variables

| Variable                            | Purpose                                 |
| :---------------------------------- | :-------------------------------------- |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Required for images                     |
| `NEXT_PUBLIC_OSM_ENABLED`           | Set `true` to enable OpenStreetMap maps |

## Automation Scripts

| Command                                    | Purpose                                  |
| :----------------------------------------- | :--------------------------------------- |
| `bun scripts/validate-rto-data.ts <state>` | Validates JSON against schema            |
| `bun scripts/generate-index.ts`            | Manual master index rebuild              |
| `bun scripts/generate-boundaries.ts`       | Generate district boundary data for maps |
| `bun scripts/generate-coordinates.ts`      | Generate RTO coordinates for map markers |

### OSM Data Generation

Generate map data for a specific state:

```bash
bun scripts/generate-boundaries.ts --state=karnataka
bun scripts/generate-coordinates.ts --state=karnataka
```

Use `--force` to regenerate existing files:

```bash
bun scripts/generate-boundaries.ts --state=karnataka --force
```

## Auto-Generated Files

The following are updated during `prebuild`. Do not manually edit:

- `data/index.json`
- `data/rto-images.json`
- `public/sitemap.xml`

The following are generated via OSM scripts. Do not manually edit:

- `public/data/{state}/boundaries.json` - District boundary polygons
- `public/data/{state}/coordinates.json` - RTO marker coordinates
