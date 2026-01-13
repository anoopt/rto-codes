# Contributing to RTO Codes India

Thank you for your interest in contributing to RTO Codes India! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Contributing RTO Data](#contributing-rto-data)
- [Contributing SVG Maps](#contributing-svg-maps)
- [Contributing Code](#contributing-code)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Data Standards](#data-standards)

## Code of Conduct

By participating in this project, you are expected to uphold our standards of respectful and inclusive behavior. Please be kind and courteous to other contributors.

## Ways to Contribute

There are several ways you can contribute to this project:

1. **Add new RTO data** - Contribute JSON files for RTOs not yet in the database
2. **Fix existing RTO data** - Correct or update inaccurate information
3. **Contribute SVG maps** - Create state district maps for visualization
4. **Report bugs** - Help us identify and fix issues
5. **Suggest features** - Share ideas for improving the project
6. **Improve documentation** - Enhance README, guides, or code comments

## Contributing RTO Data

### Option 1: Submit an Issue (Recommended for Non-Technical Users)

If you're not comfortable with Git/GitHub workflows, you can simply:

1. Go to [Issues](../../issues/new/choose)
2. Select "Add New RTO" or "Fix RTO Data" template
3. Fill in the information
4. Submit the issue

Our maintainers will create the necessary files and submit a PR.

### Option 2: Submit JSON Files (For Technical Contributors)

If you're comfortable with Git and JSON, you can directly contribute RTO data files.

#### Step 1: Prepare Your JSON File

Create a JSON file following this naming convention: `xx-yy.json` or `xx-yyy.json` (e.g., `ka-01.json`, `mh-12.json`, `tn-123.json`)

- `xx` = 2-letter state code (lowercase)
- `yy` = 2-digit RTO number (with leading zero if needed)

**JSON Structure:**

```json
{
  "code": "XX-YY", // or XX-YYY for 3-digit codes
  "region": "Region/Area Name",
  "city": "City Name",
  "state": "State Name",
  "stateCode": "XX",
  "district": "District Name",
  "division": "Administrative Division Name",
  "description": "Brief description of the RTO, its type (RTO/ARTO), and coverage.",
  "status": "active",
  "established": "Year or N/A",
  "address": "Full address of RTO office",
  "pinCode": "123456",
  "phone": "Contact number(s)",
  "email": "official@email.address",
  "jurisdictionAreas": ["Area1", "Area2", "Area3"]
}
```

**Required Fields:**

- `code`, `region`, `city`, `state`, `stateCode`, `district`

**Optional Fields:**

- `division`, `description`, `status`, `established`, `address`, `pinCode`, `phone`, `email`, `jurisdictionAreas`, `coverage`, `note`, `redirectTo`, `isDistrictHeadquarter`

**Field Guidelines:**

- `status`: Use `"active"` (default), `"not-in-use"`, or `"discontinued"`
- `redirectTo`: RTO code to redirect to when this RTO is not in use (e.g., `"GA-07"` for inactive GA-01). This creates automatic links in the UI.
- `jurisdictionAreas`: Array of talukas, mandals, or locality names
- `pinCode`: 6-digit string (not a number)
- `description`: 2-3 sentences describing the RTO and its significance

#### Step 2: Place the File

Place your JSON file in the appropriate state folder:

```
data/
  karnataka/
    ka-01.json
    ka-02.json
  maharashtra/
    mh-01.json
```

If the state folder doesn't exist, create it and also add a `config.json` (see [State Configuration](#state-configuration)).

#### Step 3: Submit a Pull Request

1. Fork this repository
2. Create a new branch: `git checkout -b add-rto-xx-yy` or `fix-rto-xx-yy`
3. Add your JSON file(s)
4. Commit: `git commit -m "Add RTO XX-YY data" -m "Source: [link to official source]"`
5. Push: `git push origin add-rto-xx-yy`
6. Create a Pull Request using our [PR template](.github/PULL_REQUEST_TEMPLATE.md)

**Important Notes:**

- ✅ **DO** contribute only JSON data files
- ✅ **DO** verify information from official sources
- ❌ **DON'T** manually update `index.json` - this is auto-generated
- ❌ **DON'T** generate or upload images - image generation is managed exclusively by maintainers via Cloudinary
- ❌ **DON'T** update the sitemap - this is auto-generated

### State Configuration

If you're adding data for a new state, create a `config.json` in the state folder:

```json
{
  "stateCode": "XX",
  "name": "State Name",
  "displayName": "State Name",
  "capital": "Capital City",
  "totalRTOs": 50,
  "mapFile": "map.svg",
  "districtMapping": {
    "District Name": "SVG_District_ID",
    "Another District": "Another_SVG_ID"
  },
  "svgDistrictIds": ["SVG_District_ID", "Another_SVG_ID"]
}
```

## Contributing SVG Maps

State district maps enable interactive visualization on RTO detail pages. If you have design or cartography skills, you can contribute SVG maps.

### Where to Find SVG Maps

**Wikimedia Commons** is an excellent source for state district maps:

- Search for "[State name] district map" on [Wikimedia Commons](https://commons.wikimedia.org/)
- Look for SVG format maps with clear district boundaries
- Most maps are licensed under **CC BY-SA** (Creative Commons Attribution-ShareAlike)
- Example: [Karnataka districts map](https://commons.wikimedia.org/wiki/File:Karnataka_locator_map.svg)

**Important**: Always check the license and provide proper attribution!

### Requirements for SVG Maps

1. **Format**: Clean, optimized SVG format
2. **Districts**: Each district should be a separate `<path>` or `<g>` element with a unique `id`
3. **IDs**: Use clear, consistent district IDs (e.g., `Bangalore_Urban`, `Mysore`, `Dakshina_Kannada`)
4. **Style**: Minimal inline styles; use classes where possible
5. **Size**: Optimize file size (remove unnecessary metadata, comments, etc.)
6. **License**: Must be Creative Commons licensed (e.g., from Wikimedia Commons) or your original work

### SVG Structure Example

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <g id="District_1">
    <path d="M..." />
  </g>
  <g id="District_2">
    <path d="M..." />
  </g>
  <!-- More districts -->
</svg>
```

### Submitting SVG Maps

1. Create your SVG map file
2. Name it `map.svg`
3. Place it in the appropriate state folder: `data/[state-name]/map.svg`
4. Update the state's `config.json` with district mappings
5. Test locally with the district map feature enabled
6. Submit a PR with:
   - The SVG file
   - Updated `config.json` with district mappings
   - A screenshot showing the map working
   - License/attribution information

## Contributing Code

If you want to contribute code changes, bug fixes, or new features:

1. **Discuss First**: For major changes, open an issue first to discuss the approach
2. **Follow Standards**: Match the existing code style (TypeScript, React, Next.js patterns)
3. **Test Thoroughly**: Test your changes locally
4. **Document**: Add comments for complex logic, update relevant documentation

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+
- Git

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/rtocodes.git
cd rtocodes

# Install dependencies
bun install  # or npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
bun run dev  # or npm run dev
```

Visit `http://localhost:3000` to see the site.

### Available Scripts

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run lint` - Lint code
- `bun scripts/generate-index.ts` - Generate index.json from RTO files (runs automatically during build)
- `bun scripts/validate-rto-data.ts [state]` - Validate RTO data
- `bun scripts/generate-sitemap.ts` - Generate sitemap (runs automatically during build)

**Maintainer-Only Scripts** (require API keys and are run via GitHub Actions):

- `bun scripts/populate-rto-data.ts <state>` - Enrich RTO data using AI
- `bun scripts/generate-rto-images.ts` - Generate city images via Cloudinary

**Note**: You don't need to run `generate-index.ts` or `generate-sitemap.ts` manually. These scripts run automatically:

- During local development as part of the `prebuild` step
- In CI/CD after PR merge via GitHub Actions

## Pull Request Process

### Before Submitting

1. **Verify Data**: Check that all RTO information is accurate
2. **Test Locally**: Run `bun run dev` and verify your changes work
3. **Lint**: Run `bun run lint` to check for code issues (if contributing code)
4. **Validate JSON**: Ensure your JSON files are properly formatted

### PR Guidelines

1. **Use the PR Template**: Fill out the provided PR template completely
2. **Clear Title**: Use descriptive titles like "Add RTO MH-01 data" or "Fix KA-05 district information"
3. **One Purpose**: Keep PRs focused on a single purpose (don't mix data additions with bug fixes)
4. **Provide Sources**: Link to official sources for data changes
5. **Small PRs**: Submit smaller PRs (5-10 RTOs) rather than massive ones (50+ RTOs)

### What Happens After Submission

1. **Automated Checks**: GitHub Actions will validate your JSON files (syntax, naming, required fields)
2. **Review**: Maintainers will review your contribution
3. **AI Enrichment**: Maintainers will run the "Enrich RTO Data" workflow to add:
   - Detailed descriptions
   - Jurisdiction areas
   - Contact information (when available)
   - Division and establishment details
4. **Review Enrichment**: Both you and the maintainer can review the AI-enriched data
5. **Approval**: Once satisfied, the maintainer will merge your PR
6. **Post-Merge**: Automated workflows will:
   - Generate index files
   - Update the sitemap
   - Deploy to production
   - Maintainers will generate RTO images via Cloudinary when appropriate

## Data Standards

### Data Quality Guidelines

1. **Accuracy**: Verify all information from official sources
2. **Completeness**: Fill in as many fields as possible
3. **Consistency**: Follow existing patterns in field formatting
4. **Sources**: Always cite your data sources

### Official Sources

Preferred sources for RTO data:

- State transport department websites
- Official government portals (e.g., parivahan.gov.in)
- Karnataka: [etc.karnataka.gov.in](https://etc.karnataka.gov.in/)
- Wikipedia (verify with primary sources)

### Data Validation

Your JSON files should pass these checks:

- Valid JSON syntax
- Required fields present
- Proper data types (strings for most, arrays for jurisdictionAreas)
- Correct naming format (XX-YY or XX-YYY)
- PIN codes are 6 digits
- Phone/email format is reasonable

## Questions or Issues?

- **Questions**: Open a [Discussion](../../discussions) or [Issue](../../issues)
- **Bugs**: Use the [Bug Report template](../../issues/new?template=bug-report.md)
- **Features**: Use the [Feature Request template](../../issues/new?template=feature-request.md)

## Recognition

Contributors will be recognized in our:

- Repository contributors list
- Release notes (for significant contributions)

Thank you for contributing to RTO Codes India! Your efforts help make Indian RTO information more accessible to everyone. 🙏
