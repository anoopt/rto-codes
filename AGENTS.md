# Agent Instructions: RTO Codes India

Searchable database of Indian Regional Transport Office (RTO) codes.

## 🛠 Critical Stack & Commands

- **Framework**: Next.js (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Package Manager**: **ALWAYS use Bun.** Never use npm, yarn, or pnpm.

| Task    | Command         |
| :------ | :-------------- |
| Install | `bun install`   |
| Dev     | `bun run dev`   |
| Build   | `bun run build` |
| Lint    | `bun run lint`  |
| Test    | `bun run test`  |

## 📖 Progressive Disclosure Links

Depending on your task, refer to these sub-guides:

1. [**Data & RTO Management**](./docs/agents/data-schema.md): Adding/editing RTO JSONs, state configs, and status rules.
2. [**Architecture & UI**](./docs/agents/architecture.md): Server Components, Tailwind 4, and React patterns.
3. [**Scripts & Tooling**](./docs/agents/development.md): Auto-generated files, validation scripts, and environment variables.
4. [**Testing**](./docs/agents/testing.md): Test commands, structure, and patterns.

## ⚠️ Key Restrictions

- **Do Not Edit**: `data/index.json`, `data/*/index.json`, `data/rto-images.json`, or `public/sitemap.xml`. These are auto-generated.
- **Maintainer Only**: Image generation and AI data enrichment scripts.
