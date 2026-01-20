# Testing Guide

This project uses **Vitest** with **React Testing Library** for unit and component testing.

## Installation

Testing dependencies are already included in `package.json`. If you need to reinstall:

```bash
bun install
```

## Running Tests

### Run all tests once

```bash
bun run test
```

### Run tests in watch mode (for development)

```bash
bun run test:watch
```

### Run tests with UI (visual test runner)

```bash
bun run test:ui
```

### Run tests with coverage

```bash
bun run test:coverage
```

## Test Structure

Tests are organized in the `__tests__` directory mirroring the source structure:

```
__tests__/
├── lib/
│   └── rto-data.test.ts       # Tests for data fetching utilities
├── components/
│   └── SearchableRTOs.test.tsx # Tests for React components
└── types/
    └── rto.test.ts            # Tests for TypeScript types
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect } from "vitest";

describe("Feature Name", () => {
  it("should do something", () => {
    // Arrange
    const input = "test";

    // Act
    const result = someFunction(input);

    // Assert
    expect(result).toBe("expected");
  });
});
```

### Component Testing

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from '@/components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent prop="value" />);
    expect(screen.getByText('value')).toBeInTheDocument();
  });
});
```

### Mocking Next.js Modules

```typescript
import { vi } from 'vitest';

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

// Mock Next.js Image
vi.mock('next/image', () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));
```

## Configuration

### vitest.config.ts

The Vitest configuration includes:

- **React plugin** for JSX support
- **happy-dom** environment for DOM testing
- **Path aliases** (`@/` points to project root)
- **Global test utilities** (describe, it, expect available without imports)

### vitest.setup.ts

Setup file that runs before tests:

- Imports `@testing-library/jest-dom` for additional matchers

## Coverage

To generate coverage reports:

```bash
bun run test:coverage
```

Coverage reports will be generated in the `coverage/` directory.

## Continuous Integration

Tests run automatically on:

- Pull requests
- Pushes to main branch

## Testing Best Practices

1. **Write descriptive test names** - Test names should clearly describe what is being tested
2. **Follow AAA pattern** - Arrange, Act, Assert
3. **Test behavior, not implementation** - Focus on what the code does, not how it does it
4. **Keep tests isolated** - Each test should be independent
5. **Mock external dependencies** - Use vi.mock() for external modules
6. **Use Testing Library queries** - Prefer `getByRole`, `getByText` over `getByTestId`

## Common Issues

### Tests failing with "document is not defined"

Make sure you're running tests with `bun run test` (which uses `vitest run`), not `bun test` (which uses Bun's native test runner).

### Import errors

Ensure you're using the `@/` path alias for imports:

```typescript
import { RTOCode } from "@/types/rto"; // ✅ Correct
import { RTOCode } from "../types/rto"; // ❌ Avoid
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library Documentation](https://testing-library.com/react)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
