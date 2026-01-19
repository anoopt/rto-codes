# Scripts & Environment

## Environment Variables

- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`: Required for images.
- `NEXT_PUBLIC_ENABLE_DISTRICT_MAP`: Set to `true` to test SVG map highlighting.

## Automation Scripts

| Command                                    | Purpose                       |
| :----------------------------------------- | :---------------------------- |
| `bun scripts/validate-rto-data.ts <state>` | Validates JSON against schema |
| `bun scripts/generate-index.ts`            | Manual master index rebuild   |

## Auto-Generated Files

The following are updated during `prebuild`. Do not manual edit:

- `data/index.json`
- `data/rto-images.json`
- `public/sitemap.xml`
