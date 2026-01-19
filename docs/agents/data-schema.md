# Data & RTO Management

## RTO JSON Conventions

- **Path**: `data/[state-name]/[statecode-number].json` (e.g., `data/karnataka/ka-01.json`).
- **Required Fields**: `code`, `region`, `city`, `state`, `stateCode`, `district`.
- **Statuses**: `active`, `not-in-use` (requires `redirectTo`), or `discontinued`.

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
