# Testing Quick Reference

## Run Tests

```bash
# Run all tests once
bun run test

# Watch mode (development)
bun run test:watch

# Visual UI
bun run test:ui

# With coverage
bun run test:coverage
```

## Test Structure

```typescript
import { describe, it, expect } from "vitest";

describe("Feature", () => {
  it("should work", () => {
    expect(true).toBe(true);
  });
});
```

## Component Testing

```typescript
import { render, screen } from '@testing-library/react';
import MyComponent from '@/components/MyComponent';

it('renders', () => {
  render(<MyComponent />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

## Common Queries

- `getByText('text')` - Find by text content
- `getByRole('button')` - Find by ARIA role
- `getByLabelText('label')` - Find by label
- `getByTestId('id')` - Find by data-testid (last resort)

## Test Files

- `__tests__/lib/` - Utility functions
- `__tests__/components/` - React components
- `__tests__/types/` - Type validations

## Current Coverage

✅ 84 tests passing

- 53 library tests (RTO data + state config)
- 27 component tests (SearchableRTOs + DistrictMap)
- 4 type tests

## ⚠️ Important

Use `bun run test` (not `bun test`)
