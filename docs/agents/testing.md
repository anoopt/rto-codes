# Testing

## Test Framework

- **Vitest** with React Testing Library
- **84 tests** covering data functions, components, and types

## Commands

| Command              | Purpose                      |
| :------------------- | :--------------------------- |
| `bun run test`       | Run all tests once           |
| `bun run test:watch` | Watch mode for development   |
| `bun run test:ui`    | Visual test runner (browser) |

## Test Structure

```
__tests__/
├── lib/              # Data utilities (53 tests)
├── components/       # React components (27 tests)
└── types/            # Type validation (4 tests)
```

## Writing Tests

- Import from `vitest`: `describe`, `it`, `expect`, `vi`, `beforeEach`
- Mock Next.js modules: `next/link`, `next/navigation`, `next/image`
- Use Testing Library queries: `getByRole`, `getByText` (prefer over `getByTestId`)

## Important Notes

- **Use `bun run test`**, not `bun test` (native Bun runner doesn't support Vitest)
- Tests run automatically in CI/CD on PRs
- See [TESTING.md](../../TESTING.md) for detailed examples and patterns
