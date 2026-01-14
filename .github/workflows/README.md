# Automation Workflows

This directory contains GitHub Actions workflows for automating RTO data population, validation, enrichment, and image generation.

## Overview

The automation system consists of 3 main workflows that work together:

```
┌──────────────────────────────────────────────────────────┐
│  scheduled-populate-rto.yml (Daily 2 AM UTC / Manual)   │
│  - Generates 50 RTOs/day for next incomplete state       │
│  - Commits directly to main branch (fully automated)     │
└─────────────────────┬────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────┐
│  post-merge.yml (On push to main)                        │
│  - Generates RTO images with Gemini + Cloudinary         │
│  - Updates rto-images.json tracking file                 │
└─────────────────────┬────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────┐
│  auto-complete-state.yml (After post-merge)              │
│  - Checks if state reached totalRTOs count               │
│  - Updates isComplete flag in config.json                │
│  - Creates celebration issue with metrics                │
└──────────────────────────────────────────────────────────┘

**Note**: The `enrich-pr.yml` workflow still exists for manual PR enrichment but is no longer part of the automated pipeline since the scheduled workflow now commits directly to main.
```

## Workflows

### 1. Scheduled RTO Population (`scheduled-populate-rto.yml`)

**Purpose**: Automatically generate RTO data for incomplete states on a daily schedule.

**Triggers**:

- **Schedule**: Daily at 2 AM UTC
- **Manual**: Via Actions → "Scheduled RTO Population" → Run workflow

**What it does**:

1. Determines next state to process using rotation cache
2. Generates 50 RTO JSON files using `populate-rto-data.ts`
3. Commits directly to main branch (fully automated)
4. Post-merge workflow triggers automatically for image generation
5. Retries up to 3 times on failure
6. Creates issue notification if workflow fails

**Manual Trigger Options**:

```yaml
state: "maharashtra" # Process specific state (optional)
limit:
  50 # Number of RTOs to generate (default: 50)
  # Use 2-5 for initial testing!
force: false # Process even if complete (default: false)
```

**Testing Recommendations**:

- **First run**: limit=2 (verify pipeline works)
- **Second run**: limit=5 (test with slightly more data)
- **Production**: limit=50 or empty (use default)

**Rate Limiting**:

- 50 RTOs/day = ~50 text API calls + ~50 image calls = ~100 total
- Well within Gemini's 500 images/day limit
- Leaves buffer for retries and manual operations

**State Rotation**:

- Processes states sequentially (alphabetical order)
- Skips states with `isComplete: true`
- Skips states with `totalRTOs: 0` (not researched yet)
- Caches last processed state in GitHub Actions cache

**Example Commit Message**:

```
chore: Add 50 RTOs for Maharashtra (50/300)

Automated RTO data population
- Generated: 50 new RTOs
- Progress: 50/300 (16%)
- State: Maharashtra
```

---

### 2. Enrich RTO Data (`enrich-pr.yml`)

**Purpose**: Enrich RTO data with AI-generated details and auto-merge high-confidence PRs.

**Triggers**:

- **Automatic**: When "enrich" label is added to a PR
- **Manual**: Via Actions → "Enrich RTO Data" → Run workflow (requires PR number)

**What it does**:

1. Checks out PR branch (supports fork PRs with maintainer edit permission)
2. Detects changed RTO JSON files
3. Enriches data using `populate-rto-data.ts` with Gemini AI
4. Validates enriched data using `validate-rto-data.ts`
5. **Auto-merges** if all RTOs have ≥90% confidence AND PR has "automated" label
6. Comments on PR with validation metrics
7. Removes "enrich" label after processing

**Enrichment Includes**:

- ✅ Detailed descriptions (2-3 sentences)
- ✅ Jurisdiction areas (talukas/mandals)
- ✅ Contact info (phone, email, address)
- ✅ Division and establishment year
- ✅ District assignment verification

**Auto-Merge Criteria**:

- ALL RTOs must have ≥90% confidence
- PR must have "automated" label
- All GitHub checks must pass
- Falls back to enabling auto-merge if checks still running

**Fork PR Requirements**:

- Contributor must enable "Allow edits from maintainers"
- Otherwise, workflow exits with instructions for manual enrichment

**Example Validation Comment**:

```markdown
## 🤖 RTO Data Enriched

### 📊 Validation Results

- Total RTOs: 50
- High confidence (≥90%): 50/50
- Average confidence: 94%
- Range: 90% - 98%

✅ All RTOs passed validation - This PR will auto-merge after checks pass.
```

---

### 3. Post-Merge Processing (`post-merge.yml`)

**Purpose**: Generate RTO images and update tracking file after merge.

**Triggers**:

- **Automatic**: Push to `main` branch with changes to `data/**/*.json`

**What it does**:

1. Detects changed states from merged PR
2. Generates city images using Gemini 2.5 Flash Image model
3. Uploads images to Cloudinary (WebP, 800×600, auto quality)
4. Updates `data/rto-images.json` with generated codes
5. Commits tracking file back to main

**Image Generation**:

- Style: Minimalist architectural sketches with watercolor washes
- Theme colors: 58 predefined colors based on city
- Format: WebP with transformations applied
- Delay: 2000ms between generations (rate limiting)
- Skips existing images automatically

**Graceful Degradation**:

- Silently skips if API secrets not configured
- Index and sitemap still generated during Vercel build
- Notifies in logs but doesn't fail the workflow

**Example Commit**:

```
chore: update RTO images tracking
```

---

### 4. Auto-Complete State (`auto-complete-state.yml`)

**Purpose**: Automatically mark states as complete when totalRTOs count is reached.

**Triggers**:

- **Automatic**: After "Post-Merge Processing" workflow completes
- **Manual**: Via Actions → "Auto-Complete State" → Run workflow

**What it does**:

1. Counts actual RTO files in each state folder
2. Compares with `totalRTOs` in `config.json`
3. Updates `isComplete: true` when counts match
4. Commits updated config files
5. Creates celebration issue with:
   - Newly completed states table
   - Overall project progress bar
   - Next steps and timeline estimate

**Manual Trigger Options**:

```yaml
state: "karnataka" # Check specific state (optional, defaults to all)
```

**Example Celebration Issue**:

```markdown
## 🎉 State(s) Completed!

| State       | Code | RTOs Added | Total RTOs | Completion |
| ----------- | ---- | ---------- | ---------- | ---------- |
| Maharashtra | MH   | 300        | 300        | 100%       |

### 🗺️ Overall Project Progress

- Complete: 5/36 ✅
- RTOs: 450/8000 (6%)

### 📈 Progress Bar

████░░░░░░░░░░░░░░░░ 6%
```

---

### 5. Validate RTO Data (`validate-pr.yml`)

**Purpose**: Validate incoming RTO data contributions for correctness.

**Triggers**:

- **Automatic**: On pull requests modifying `data/**/*.json`

**What it validates**:

- ✅ JSON syntax (using `jq`)
- ✅ File naming convention (`xx-yy.json` or `xx-yyy.json`)
- ✅ Required fields: code, region, city, state, stateCode, district
- ✅ Code format matches state code
- ✅ PIN code is 6 digits (if present)
- ✅ Status values: "active", "not-in-use", "discontinued"
- ✅ `jurisdictionAreas` is array (if present)
- ✅ Blocks auto-generated files (index.json, rto-images.json)

**Example Validation Output**:

```
✅ data/maharashtra/mh-01.json
  - Valid JSON syntax
  - File naming: OK
  - Required fields: OK
  - Code format: OK
```

---

## Required Secrets

Configure these in **Repository Settings → Secrets and variables → Actions**:

| Secret                  | Required By                  | Purpose                       |
| ----------------------- | ---------------------------- | ----------------------------- |
| `GEMINI_API_KEY`        | populate, enrich, post-merge | Gemini AI API access          |
| `CLOUDINARY_CLOUD_NAME` | post-merge                   | Cloudinary account identifier |
| `CLOUDINARY_API_KEY`    | post-merge                   | Cloudinary API key            |
| `CLOUDINARY_API_SECRET` | post-merge                   | Cloudinary API secret         |

**Note**: If secrets are not configured:

- Scheduled population will fail (notifies via issue)
- Enrichment will fail with clear error message
- Post-merge will skip image generation gracefully
- Validation works without any secrets

---

## Scripts

### `verify-total-rtos.ts`

**Purpose**: Research and verify total RTO counts for each state using Gemini AI.

**Run ONCE before starting automation** to populate `totalRTOs` in config.json files.

```bash
# Verify all states with totalRTOs=0
bun scripts/verify-total-rtos.ts

# Verify specific state
bun scripts/verify-total-rtos.ts --state=maharashtra

# Preview without changes
bun scripts/verify-total-rtos.ts --dry-run

# Force update even if already set
bun scripts/verify-total-rtos.ts --force
```

**What it does**:

- Researches official RTO counts from government sources and Wikipedia
- Uses Gemini to parse and validate information
- Returns confidence score (0-100)
- Updates `totalRTOs` in config.json
- Skips states where `totalRTOs > 0` (unless --force)

**Example Output**:

```
📍 Maharashtra (MH)
  🔍 Researching Maharashtra...
  📊 Results:
     Total RTOs: 300
     Highest Code: MH-300
     Confidence: 95%
     Sources: Maharashtra Transport Department, Wikipedia
  ✅ Updated: 0 → 300
```

---

### `populate-rto-data.ts`

**Purpose**: Generate and enrich RTO JSON files using Gemini AI.

```bash
# Generate all RTOs for a state
bun scripts/populate-rto-data.ts ga

# Generate specific range
bun scripts/populate-rto-data.ts ka 1 10

# Enrich single RTO
bun scripts/populate-rto-data.ts ga GA-07 --force

# Preview without saving
bun scripts/populate-rto-data.ts ga --dry-run
```

**Pre-configured States**:

- Karnataka (ka), Goa (ga), Tamil Nadu (tn), Maharashtra (mh)
- Andhra Pradesh (ap), Telangana (ts), Kerala (kl)
- Delhi (dl), Gujarat (gj)

---

### `validate-rto-data.ts`

**Purpose**: Validate RTO data accuracy using Gemini AI.

```bash
# Validate all Karnataka RTOs
bun scripts/validate-rto-data.ts karnataka

# Validate single RTO
bun scripts/validate-rto-data.ts goa ga-07

# Save detailed report
bun scripts/validate-rto-data.ts goa --save

# Save simple report for CI
bun scripts/validate-rto-data.ts goa --save-report
```

---

### `validate-and-fix-rto-data.ts`

**Purpose**: Validate and auto-fix issues with AI suggestions.

```bash
# Fix all issues in Goa
bun scripts/validate-and-fix-rto-data.ts goa --fix

# Preview fixes without applying
bun scripts/validate-and-fix-rto-data.ts goa --fix --dry-run
```

---

### `generate-rto-images.ts`

**Purpose**: Generate RTO city images using Gemini + Cloudinary.

```bash
# Generate for all states
bun scripts/generate-rto-images.ts

# Generate for specific state
bun scripts/generate-rto-images.ts --state=goa

# Generate single RTO
bun scripts/generate-rto-images.ts --code=GA-07

# Regenerate existing images
bun scripts/generate-rto-images.ts --force

# Limit batch size
bun scripts/generate-rto-images.ts --limit=10
```

**Note**: Normally run automatically by post-merge workflow. Manual use is for backfilling or testing.

---

## Setup Instructions

### 1. Initial Setup (One-Time)

```bash
# 1. Research and populate totalRTOs for all states
bun scripts/verify-total-rtos.ts

# 2. Review and commit config.json updates
git add data/*/config.json
git commit -m "chore: populate totalRTOs for all states"
git push

# 3. Configure secrets in GitHub repository settings
#    - GEMINI_API_KEY
#    - CLOUDINARY_CLOUD_NAME
#    - CLOUDINARY_API_KEY
#    - CLOUDINARY_API_SECRET
```

### 2. Enable Scheduled Automation

The scheduled workflow will run automatically daily at 2 AM UTC. No additional configuration needed!

### 3. Monitor Progress

- **PRs**: Check [Pull Requests](../../pulls) for automated RTO additions
- **Issues**: Check [Issues](../../issues) for celebration milestones or failure notifications
- **Actions**: Check [Actions](../../actions) for workflow execution logs

---

## Timeline Estimates

At **50 RTOs/day**:

| Scenario                 | States | Total RTOs | Days | Completion Date |
| ------------------------ | ------ | ---------- | ---- | --------------- |
| All incomplete states    | 34     | ~6,000     | ~120 | ~4 months       |
| High-priority states (5) | 5      | ~1,500     | ~30  | ~1 month        |
| Single large state (UP)  | 1      | ~800       | ~16  | ~2 weeks        |

**Factors affecting timeline**:

- API rate limits (500 images/day)
- Failed attempts requiring retries
- Manual review time for low-confidence RTOs
- States with `totalRTOs=0` (need verification first)

---

## Troubleshooting

### Workflow fails with "GEMINI_API_KEY is not set"

**Solution**: Add the secret in Repository Settings → Secrets and variables → Actions

### Fork PR enrichment fails

**Solution**: Ask contributor to enable "Allow edits from maintainers" in PR settings, or enrich manually:

```bash
gh pr checkout <PR_NUMBER>
bun scripts/populate-rto-data.ts <state-code> <rto-code>
git add . && git commit -m 'Enrich RTO data' && git push
```

### Image generation skipped

**Solution**: Configure Cloudinary secrets. Images will generate on next merge if secrets are added.

### State rotation stuck

**Solution**: Manually trigger workflow with specific state:

```yaml
state: "next-state-name"
```

### Low validation confidence (<90%)

**Solution**: These PRs won't auto-merge. Review manually and either:

1. Fix data based on validation suggestions
2. Merge anyway if data is acceptable
3. Re-run enrichment with `--force` flag

---

## Best Practices

1. **Run `verify-total-rtos.ts` first** before starting automation
2. **Monitor the first few PRs** to ensure automation is working correctly
3. **Review low-confidence RTOs** before merging manually
4. **Check celebration issues** for overall progress tracking
5. **Use manual triggers** for high-priority states or catch-up
6. **Keep secrets secure** - never commit them to the repository
7. **Let automation run** - it's designed to be hands-off!

---

## Architecture Decisions

### Why 50 RTOs/day?

- Stays well within Gemini's 500 images/day limit
- Allows buffer for retries (3× = 150 API calls max)
- Leaves room for manual operations and testing
- Predictable timeline for completion

### Why auto-merge at 90% confidence?

- Balances automation speed with data quality
- 90% is high enough to trust AI enrichment
- Manual review still catches the 10% edge cases
- Can adjust threshold in workflow if needed

### Why state rotation?

- Ensures even progress across all states
- Prevents focusing on one state too long
- Easy to prioritize by running manual trigger
- Cache-based approach is simple and reliable

### Why separate workflows?

- Clear separation of concerns
- Each workflow can be triggered independently
- Easier to debug and maintain
- Allows parallel execution where possible

---

## Contributing

To improve the automation:

1. Test changes locally using manual workflow triggers
2. Use `--dry-run` flags to preview without side effects
3. Monitor Actions logs for errors or unexpected behavior
4. Update this README with any new workflows or changes

---

**Last Updated**: January 14, 2026
**Maintainer**: @anoopt
