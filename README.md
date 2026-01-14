# RTO Codes India

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fanoopt%2Frto-codes)

A comprehensive, searchable database of RTO (Regional Transport Office) codes in India with detailed information and interactive maps. Currently has complete data for Karnataka and Goa, with all 28 states and 8 Union Territories scaffolded and ready for community contributions.

💡 Inspired by [airport-codes](https://github.com/lynnandtonic/airport-codes).

🌐 **Live Site**: [rto-codes.in](https://rto-codes.in)

[![Website Status](https://img.shields.io/website?url=https%3A%2F%2Frto-codes.in&logo=vercel&logoColor=white&up_message=online&down_message=offline)](https://rto-codes.in)

## Data & Coverage Status

### 📊 Summary

![States Complete](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fanoopt%2Frto-codes%2Fmain%2Fdata%2Findex.json&query=%24.completedStates&suffix=%2F28%20States&label=✅&color=brightgreen)
![UTs Complete](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fanoopt%2Frto-codes%2Fmain%2Fdata%2Findex.json&query=%24.completedUTs&suffix=%2F8%20UTs&label=✅&color=orange)
![Total RTOs](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fanoopt%2Frto-codes%2Fmain%2Fdata%2Findex.json&query=%24.totalRTOs&label=Total%20RTOs&color=blue)
![Verified RTOs](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fanoopt%2Frto-codes%2Fmain%2Fdata%2Findex.json&query=%24.totalVerified&label=Verified&color=success)

### 🗺️ State-wise Breakdown

| State              | Status                                                          | RTOs                                                                                                                                                                                                     | Map Asset                                                         |
| ------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Karnataka (KA)** | ![Complete](https://img.shields.io/badge/-Complete-brightgreen) | ![KA RTOs](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fanoopt%2Frto-codes%2Fmain%2Fdata%2Fkarnataka%2Fconfig.json&query=%24.totalRTOs&label=RTOs&color=blue) | ![Available](https://img.shields.io/badge/-Available-brightgreen) |
| **Goa (GA)**       | ![Complete](https://img.shields.io/badge/-Complete-brightgreen) | ![GA RTOs](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fanoopt%2Frto-codes%2Fmain%2Fdata%2Fgoa%2Fconfig.json&query=%24.totalRTOs&label=RTOs&color=blue)       | ![Available](https://img.shields.io/badge/-Available-brightgreen) |
| Other States (26)  | ![Scaffolded](https://img.shields.io/badge/-Scaffolded-yellow)  | Ready for contributions                                                                                                                                                                                  | ![Needed](https://img.shields.io/badge/-Needed-red)               |

### 🏛️ Union Territory Breakdown

| Union Territory | Status                                                         | RTOs                    | Map Asset                                           |
| --------------- | -------------------------------------------------------------- | ----------------------- | --------------------------------------------------- |
| All (8)         | ![Scaffolded](https://img.shields.io/badge/-Scaffolded-yellow) | Ready for contributions | ![Needed](https://img.shields.io/badge/-Needed-red) |

#### 📊 Detailed stats and coverage info can be [found here](./DATA-STATUS.md)

## 🛠 Tech Specs

![Bun](https://img.shields.io/badge/Runtime-Bun-f9f1e1?logo=bun&logoColor=black)
![Next.js](https://img.shields.io/badge/Framework-Next.js%2015-black?logo=next.js)
![Tailwind](https://img.shields.io/badge/CSS-Tailwind%204-38B2AC?logo=tailwind-css)

## 🖼️ Screenshots

<table>
  <tr>
    <td width="70%"><img src="docs/screenshots/home.png" alt="Home Page" /></td>
    <td width="30%"><img src="docs/screenshots/mobile.png" alt="Mobile View" /></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><em>Home page with RTO grid (desktop & mobile)</em></td>
  </tr>
</table>

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/home-search.png" alt="Search Feature" /></td>
    <td width="50%"><img src="docs/screenshots/rto-detail.png" alt="RTO Detail Page" /></td>
  </tr>
  <tr>
    <td align="center"><em>Instant search functionality</em></td>
    <td align="center"><em>RTO detail with district map</em></td>
  </tr>
</table>

## ✨ Features

- 🔍 **Instant Search** - Search by code, region, city, or district
- 📱 **Fully Responsive** - Optimized for all devices
- 🗺️ **Interactive Maps** - District map highlighting for supported states
- ⚡ **Fast Loading** - Static site generation with Next.js
- 🎨 **Dark Theme** - Beautiful dark UI with theme switching
- 🚀 **Performance** - Built with Bun for maximum speed

## 📊 Coverage

✅ **Karnataka** - All 71 RTO codes complete  
✅ **Goa** - All 12 RTO codes complete

🏗️ **Scaffolded & Ready for Contributions**:  
All 28 states and 8 Union Territories have folder structures in place with configuration files and contribution guides. Contributors can immediately start adding RTO data!

📝 **How to Contribute**: See our [CONTRIBUTING.md](./CONTRIBUTING.md) guide to add RTO data for any scaffolded state.

### Quick Links

- **[PLANNING.md](./PLANNING.md)** - Roadmap and future plans

## 🛠 Technology Stack

- **Framework**: Next.js 16+ with React 19 and TypeScript
- **Styling**: Tailwind CSS 4
- **Search**: Fuse.js for fuzzy search
- **Package Manager**: Bun
- **Deployment**: Vercel
- **Data**: JSON files with TypeScript types

## 🤝 Contributing

We welcome contributions! Whether you're adding RTO data, contributing SVG maps, or improving code, your help is appreciated.

### Quick Start

**For Non-Technical Users:**

- Submit RTO data via our [issue templates](../../issues/new/choose)

**For Developers:**

- Read our comprehensive [**CONTRIBUTING.md**](./CONTRIBUTING.md) guide
- Follow our [data standards](./CONTRIBUTING.md#data-standards) for RTO information
- Check out [development setup](./CONTRIBUTING.md#development-setup) instructions

### Ways to Contribute

1. 📝 **Add/Fix RTO Data** - Contribute JSON files for RTOs (see [CONTRIBUTING.md](./CONTRIBUTING.md#contributing-rto-data))
2. 🗺️ **Create SVG Maps** - Design state maps for visualization (see [CONTRIBUTING.md](./CONTRIBUTING.md#contributing-svg-maps))
3. 🐛 **Report Bugs** - Use our [Bug Report](../../issues/new?template=bug-report.md) template
4. ✨ **Suggest Features** - Use our [Feature Request](../../issues/new?template=feature-request.md) template
5. 📚 **Improve Documentation** - Help make our docs better

### Issue Templates

- **[Add New RTO](../../issues/new?template=add-new-rto.md)** - Suggest a missing RTO
- **[Fix RTO Data](../../issues/new?template=fix-rto-data.md)** - Report incorrect information
- **[Bug Report](../../issues/new?template=bug-report.md)** - Report website issues
- **[Feature Request](../../issues/new?template=feature-request.md)** - Suggest improvements

For detailed contribution guidelines, please see [**CONTRIBUTING.md**](./CONTRIBUTING.md).

## 🚀 Development

### Quick Start with Bun (Recommended - 10-25x Faster!)

This project uses **Bun** for maximum performance.

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash
source ~/.bash_profile  # or restart terminal

# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build
```

Visit `http://localhost:3000` to see the site.

### Alternative: Using npm

```bash
npm install
npm run dev
```

### Environment Variables

Create a `.env.local` file (optional but recommended):

```bash
# Recommended: Cloudinary cloud name for RTO images
# Without this, the app works but images won't display
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dfqx29jae

# Optional: Enable district map highlighting on RTO detail pages
NEXT_PUBLIC_ENABLE_DISTRICT_MAP=true
```

> **Note**: The Cloudinary cloud name is a public identifier for fetching images. It's safe to use for development.

### Using GitHub Codespaces

See **[QUICKSTART.md](./QUICKSTART.md)** for zero-setup cloud development with Codespaces.

## 🚀 Deployment

This site is deployed on **Vercel** with automatic deployments from the `main` branch.

### Deploy Your Own

1. Fork this repository
2. Import to [Vercel](https://vercel.com/new)
3. Add environment variable: `NEXT_PUBLIC_ENABLE_DISTRICT_MAP=true`
4. Deploy!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fanoopt%2Frto-codes&env=NEXT_PUBLIC_ENABLE_DISTRICT_MAP&envDescription=Enable%20district%20map%20feature&envLink=https%3A%2F%2Fgithub.com%2Fanoopt%2Frto-codes%23environment-variables)

## 📝 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🙏 Acknowledgments

- Inspired by [airport-codes](https://github.com/lynnandtonic/airport-codes) by Lynn Fisher
- RTO data sources: [Karnataka Transport Department](https://etc.karnataka.gov.in/), Wikipedia
- Built with [Next.js](https://nextjs.org/), [Tailwind CSS](https://tailwindcss.com/), [Bun](https://bun.sh/)

---

**Made with ❤️ by [Anoop T](https://github.com/anoopt)**
