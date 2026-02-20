# WebMCP Integration

## Overview

The site exposes tools to Chrome's in-browser AI agents via the [WebMCP](https://chromestatus.com/feature/5204956797288448) browser API (`navigator.modelContext`). Requires Chrome 146+ with `chrome://flags/#enable-webmcp-testing` enabled.

## Registered Tools

| Tool                | Description                          |
| :------------------ | :----------------------------------- |
| `search_rtos`       | Search RTOs by code, city, district  |
| `get_rto_details`   | Get full details for a specific code |
| `get_district_rtos` | List all RTOs in a district          |
| `get_stats`         | State/national RTO statistics        |

## Key Files

| File                         | Purpose                                                   |
| :--------------------------- | :-------------------------------------------------------- |
| `components/WebMCPTools.tsx` | Client component — registers tools via `provideContext()` |
| `types/web-mcp.d.ts`         | TypeScript declarations for `navigator.modelContext`      |

## How It Works

1. `WebMCPTools` is rendered in the root `app/layout.tsx` (available on all pages).
2. On mount, it calls `navigator.modelContext.provideContext()` with tool definitions.
3. On unmount, it calls `clearContext()` to clean up.
4. Tool invocations dispatch a `webmcpSearch` custom event to sync the UI (search bar, grid).
5. Cross-page actions navigate via `window.location.href` with `?search=` query params.

## Example Queries

- "What is the phone number of KA-22?"
- "What are the contact details for Patna RTO?"
- "Where is Hospet RTO located?"
- "How many RTOs are in Belgaum district?"
- "Which areas come under KA-53?"
- "When was the Mysore RTO established?"
- "What is the RTO code for Mangalore?"
- "List all RTOs in Dakshina Kannada"
- "Is GA-01 still active or discontinued?"
- "What pin code does the Hubli RTO office have?"

## Search & Alternate Names

Search uses `lib/search-utils.ts` which provides:

- **Punctuation normalization**: `"H.S.R. Layout"` → `"hsr layout"`
- **Alternate name expansion**: `"Belgaum"` also searches `"Belagavi"` (and vice versa)

Alternate names are loaded from `data/alternate-names.json`.

### Regenerating Alternate Names

```bash
export GEMINI_API_KEY=your-key
bun run generate:alternate-names
```

Flags: `--dry-run` (preview), `--merge` (preserve manual edits).

## Restrictions

- **Do Not Edit**: `data/alternate-names.json` manually — regenerate with the script above.
- WebMCP tools are client-side only; they operate on statically bundled RTO data.
