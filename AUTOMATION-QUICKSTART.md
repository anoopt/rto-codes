# Automation Quick Start Guide

This guide will help you set up and start the automated RTO data population system.

## Prerequisites

- ✅ GitHub repository with workflows enabled
- ✅ Bun installed locally (for testing)
- ✅ Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))
- ✅ Cloudinary account ([Sign up here](https://cloudinary.com/)) - optional but recommended

## Step 1: Configure Secrets (5 minutes)

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

| Secret Name             | Value                      | Required?      |
| ----------------------- | -------------------------- | -------------- |
| `GEMINI_API_KEY`        | Your Gemini API key        | ✅ Yes         |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name | ⚠️ Recommended |
| `CLOUDINARY_API_KEY`    | Your Cloudinary API key    | ⚠️ Recommended |
| `CLOUDINARY_API_SECRET` | Your Cloudinary API secret | ⚠️ Recommended |

**Note**: Without Cloudinary secrets, the automation will work but images won't be generated automatically.

## Step 2: Populate Total RTO Counts (OPTIONAL - Auto-verified by workflow)

⚠️ **NEW**: The workflow now auto-verifies states with `totalRTOs=0`, so this step is **optional**. The workflow will automatically run verification when needed.

However, you may want to run this manually first to:

- Review and validate the AI-researched RTO codes before automation starts
- Manually correct any missing codes (AI research may miss some 3-digit codes)
- Commit verified data in one batch instead of per-state

⚠️ **Important**: This script populates `validCodes` arrays to handle non-sequential RTO numbering (e.g., AP-01, AP-02, AP-03, then AP-135, AP-707, AP-955). See [docs/NON-SEQUENTIAL-RTOS.md](docs/NON-SEQUENTIAL-RTOS.md) for details.

**Known limitation**: AI research may miss some codes (e.g., found OD-01 to OD-37, but missed OD-111, OD-201, OD-901). Manual verification recommended for critical accuracy.

```bash
# Check current status (should show many states with totalRTOs=0)
grep -r "totalRTOs" data/*/config.json | grep ": 0"

# Set up environment with your API key
export $(cat .env.local | xargs)

# Run verification script for all states (dry run first)
bun scripts/verify-total-rtos.ts --dry-run

# Review the output, then apply changes
bun scripts/verify-total-rtos.ts

# Check what was populated (including validCodes)
cat data/andhra-pradesh/config.json | jq '{totalRTOs, validCodes: .validCodes | length}'

# Commit and push
git add data/*/config.json
git commit -m "chore: populate totalRTOs and validCodes for all states"
git push
```

**Expected output**: Each state will have:

- ✅ Researched `totalRTOs` count (e.g., Maharashtra: 300, Tamil Nadu: 150)
- ✅ `validCodes` array with complete list of valid RTO codes
- ✅ Notes about any gaps or non-sequential numbering

## Step 3: Verify Everything Works

Test the scripts locally before relying on automation:

```bash
# Test populate script with a state that has validCodes (dry run)
bun scripts/populate-rto-data.ts ap 1 3 --dry-run

# Verify it's using valid codes correctly (check output for "Using valid codes list")
# Should show: AP-01, AP-02, AP-03 (not sequential if state has gaps)

# Test with actual generation (small batch)
bun scripts/populate-rto-data.ts ga 1 5 --dry-run

# Test validation script
bun scripts/validate-rto-data.ts goa --limit=3

# Test image generation (if Cloudinary configured)
bun scripts/generate-rto-images.ts --code=KA-01 --force
```

If all tests pass, you're ready for automation!

**✅ Success indicators:**

- `populate-rto-data.ts` shows "Using valid codes list" message
- Only valid RTO codes are generated (no gaps like AP-04 through AP-134)
- Validation passes with confidence ≥80%

## Step 4: Trigger First Automation Run (Manual Test)

Let's manually trigger the workflow with a **small test batch** to verify everything works:

1. Go to **Actions** → **Scheduled RTO Population**
2. Click **Run workflow**
3. Fill in:
   - **state**: `kerala` (or any state - can have totalRTOs=0, workflow will auto-verify)
   - **limit**: `2` ⚠️ **Start with just 2 RTOs for testing!**
   - **force**: `false`
4. Click **Run workflow**

**What happens**:

- If state has `totalRTOs=0`, workflow will auto-run verification first
- Then generates the specified number of RTOs
- Creates PR with enrichment and validation

**Important**: Start with limit=2 for your first test. Once that succeeds:

- Try limit=5 for a slightly larger test
- Then try limit=50 (or leave empty for default)
- Finally, enable daily automation
  Auto-verify state (if totalRTOs=0) and commit config

2. ✅ Generate specified number of RTO JSON files
3. ✅ Create a PR with "automated" + "enrich" labels
4. ✅ Trigger AI enrichment automatically
5. ✅ Validate data (confidence scores)
6. ✅ Auto-merge if confidence ≥90%
7. ✅ Generate images after merge
8. ✅ Create a PR with "automated" + "enrich" labels
9. ✅ Trigger AI enrichment automatically
10. ✅ Validate data (confidence scores)
11. ✅ Auto-merge if confidence ≥90%
12. ✅ Generate images after merge
13. ✅ Update completion status if needed

**Watch these tabs**:

- [Pull Requests](../../pulls) - See generated PRs
- [Actions](../../actions) - Monitor workflow execution
- [Issues](../../issues) - Check for errors or celebrations

## Step 6: Enable Daily Automation

If manual test succeeds, the daily automation is already enabled! It will run every day at 2 AM UTC.

**No additional configuration needed.**

## What Happens Next?

### Daily Cycle (Automatic)

```Auto-verify (if needed) → Generate 50 RTOs → Enrich → Merge → Generate Images
Day 2: State A - Generate 50 RTOs → Enrich → Merge → Generate Images
Day 3: State A - Generate 50 RTOs → Enrich → Merge → Generate Images
...
Day N: State A complete! 🎉
Day N+1: State B - Auto-verify (if needed) →plete! 🎉
Day N+1: State B - Generate 50 RTOs → ...
```

**Note**: The system automatically uses `validCodes` arrays for states with non-sequential RTO numbering. This ensures only valid RTO codes are generated (e.g., AP-01, AP-02, AP-03, AP-135, skipping invalid codes like AP-04 through AP-134).

### Timeline Estimates

At 50 RTOs/day:

| States            | Total RTOs | Estimated Days |
| ----------------- | ---------- | -------------- |
| 5 high-priority   | ~1,500     | ~30 days       |
| All 34 incomplete | ~6,000     | ~120 days      |

### Progress Tracking

**Celebration issues** are created automatically when states complete:

```markdown
## 🎉 State(s) Completed!

Maharashtra now has complete RTO data: 300/300 RTOs ✅

### 🗺️ Overall Project Progress

- Complete: 5/36 states (14%)
- Total RTOs: 850/8,000 (11%)

████░░░░░░░░░░░░░░░░ 11%
```

## Troubleshooting

### Workflow fails immediately

**Check**: Are secrets configured correctly?

```bash
# Secrets should be visible in Settings → Secrets
# (values are hidden but names should be listed)
```

### Low validation confidence (<90%)

**Action**: Review the PR manually. The data might still be good, or you can:

```bash
# Re-run enrichment with force flag
gh pr checkout <PR_NUMBER>
bun scripts/populate-rto-data.ts <state> <code> --force
git add . && git commit -m "Re-enrich with higher quality" && git push
```

### State stuck in rotation

**Action**: Skip to next state manually:

```bash
# Go to Actions → Scheduled RTO Population → Run workflow
# Set state: "next-state-name"
```

### Images not generating

**Check**: Are Cloudinary secrets configured?

If not, images can be generated later in bulk:

```bash
# Generate all missing images for a state
bun scripts/generate-rto-images.ts --state=goa
```

## Advanced: Prioritize Specific States

To process high-priority states first:

1. **Pause daily automation** (optional):

   - Edit [.github/workflows/scheduled-populate-rto.yml](.github/workflows/scheduled-populate-rto.yml)
   - Comment out the `schedule:` section temporarily

2. **Run manual triggers** for priority states:

   ```yaml
   state: "maharashtra"
   limit: 50
   ```

3. **Resume daily automation** once priorities are done

## Best Practices

✅ **Do**:

- Monitor the first few runs closely (especially auto-verification commits)
- Review low-confidence PRs before merging
- Manually verify `validCodes` for critical states (AI may miss some 3-digit codes)
- Keep secrets secure and rotated periodically
- Update `totalRTOs` and `validCodes` if official counts change or AI research is incomplete

❌ **Don't**:

- Edit auto-generated files (`index.json`, `rto-images.json`, `validCodes` arrays)
- Commit API keys to the repository
- Manually merge automated PRs with <90% confidence without review
- Increase limit above 50/day (API rate limits)
- Assume RTO codes are sequential - always use `verify-total-rtos.ts`

## Getting Help

- **Non-sequential RTOs**: [docs/NON-SEQUENTIAL-RTOS.md](docs/NON-SEQUENTIAL-RTOS.md)
- **Workflow documentation**: [.github/workflows/README.md](.github/workflows/README.md)
- **Script usage**: Each script has `--help` flag
- **Issues**: Create a GitHub issue with `[automation]` prefix
- **Logs**: Check Actions → Workflow run → Job logs

## Success Metrics

After setup is complete, you should see:

- ✅ 1 new PR daily (automated)
- ✅ ~45-50 RTOs added per day (accounting for some manual review)
- ✅ Images generated for all merged RTOs
- ✅ Celebration issues when states complete
- ✅ Overall progress bar moving steadily

## Timeline

| Milestone            | Target Date   | RTOs Added    |
| -------------------- | ------------- | ------------- |
| Setup complete       | Day 0         | 83 (existing) |
| First state complete | ~Day 30       | +1,500        |
| 10 states complete   | ~Day 60       | +3,000        |
| All states complete  | ~Day 120      | +6,000        |
| **Total**            | **~4 months** | **8,083** ✨  |

---

**Ready to start?** Follow the steps above and watch your RTO database grow automatically! 🚀

**Questions?** Check the [detailed workflows documentation](.github/workflows/README.md) or create an issue.
