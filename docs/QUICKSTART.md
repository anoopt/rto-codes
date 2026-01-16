# Quick Start Guide

Get the RTO Codes website running in under 5 minutes!

## Option 1: GitHub Codespaces (Zero Setup) ⭐ Recommended

**Perfect if you want to start coding immediately with zero local setup.**

1. Go to https://github.com/anoopt/rto-codes
2. Click **Code** → **Codespaces** → **Create codespace on main**
3. Wait ~2-3 minutes for setup
4. Run: `bun run dev`
5. Click the port 3000 notification to open the site

**That's it!** The dev container has Bun, Node.js, and all tools pre-installed.

## Option 2: Local Development with Bun (Recommended) 🚀

**Fastest local development experience.**

### Prerequisites

- [Bun](https://bun.sh/) (install below)
- Git ([download here](https://git-scm.com/))

### Steps

```bash
# 1. Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # or restart terminal

# 2. Clone the repository
git clone https://github.com/anoopt/rto-codes.git
cd rtocodes

# 3. Install dependencies (10-25x faster than npm!)
bun install

# 4. Start the development server
bun run dev

# 5. Open your browser
# Visit: http://localhost:3000
```

## Option 3: Local Development with npm

**Traditional approach if you prefer npm.**

### Prerequisites

- Node.js 20+ ([download here](https://nodejs.org/))
- Git ([download here](https://git-scm.com/))

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/anoopt/rto-codes.git
cd rtocodes

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev

# 4. Open http://localhost:3000
```

## Environment Variables

Create a `.env.local` file (optional but recommended):

```bash
# Recommended: Cloudinary cloud name for RTO images
# Without this, the app works but images won't display
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dfqx29jae

# Optional: Enable district map highlighting on RTO detail pages
NEXT_PUBLIC_ENABLE_DISTRICT_MAP=true
```

> **Note**: The Cloudinary cloud name above is the project's public cloud name for fetching images. It's safe to use for development - you cannot upload or modify images without API credentials.

## Available Commands

```bash
# Development
bun run dev          # Start dev server (http://localhost:3000)
bun run build        # Build for production
bun run start        # Start production server
bun run lint         # Run ESLint

# Utility scripts
bun run generate:sitemap   # Regenerate sitemap.xml
bun run generate:icons     # Regenerate PWA icons
```

## Project Structure

```
rtocodes/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with metadata
│   ├── page.tsx           # Homepage with search
│   ├── rto/[code]/        # Individual RTO pages
│   ├── about/             # About page
│   └── contribute/        # Contribute page
├── components/            # React components
├── data/karnataka/        # RTO data (JSON files)
├── lib/                   # Utility functions
├── public/                # Static assets (icons, sitemap)
├── scripts/               # Build scripts
├── types/                 # TypeScript definitions
└── package.json           # Dependencies
```

## Adding or Editing RTO Data

Each RTO is a JSON file in `data/karnataka/`:

```json
{
  "code": "KA-01",
  "region": "Bangalore (Central)",
  "city": "Bangalore",
  "state": "Karnataka",
  "stateCode": "KA",
  "district": "Bangalore Urban",
  "description": "The primary RTO for central Bangalore.",
  "additionalInfo": "Covers: MG Road, Brigade Road, Residency Road"
}
```

Save → Refresh browser to see changes!

## Common Issues

### Port 3000 Already in Use

```bash
# Kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
bun run dev -- -p 3001
```

### Dependencies Not Installing

```bash
# Clear and reinstall
rm -rf node_modules bun.lock
bun install
```

### Build Errors

```bash
# Clean build cache
rm -rf .next
bun run build
```

## Next Steps

1. ✅ **Got it running?** Explore the site at http://localhost:3000
2. 📖 **Read the roadmap**: [PLANNING.md](./PLANNING.md)
3. 🔧 **Make changes**: Edit files in `app/` or `data/karnataka/`
4. 🚀 **Submit a PR**: See [Contributing](../README.md#-contributing)

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Bun Docs](https://bun.sh/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**🎉 Happy Coding!**
