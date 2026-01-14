# Handling Non-Sequential RTO Codes

## Problem

Many Indian states have **non-sequential RTO codes**. For example, Andhra Pradesh has:

- AP-01, AP-02, AP-03 (sequential)
- Then jumps to AP-135, AP-137, AP-141 (missing AP-04 through AP-134, AP-136, AP-138-140)
- Then jumps to AP-202, AP-203 (missing AP-142 through AP-201)

If we naively generate sequential codes like AP-01, AP-02, AP-03, ... AP-40, we'll create **invalid RTO codes** that don't actually exist.

## Solution

We use a `validCodes` array in each state's `config.json` to store the exact list of valid RTO codes.

### 1. Verify and Populate Valid Codes

Run the verification script to research and populate the `validCodes` array:

```bash
# Verify all states
export $(cat .env.local | xargs)
bun scripts/verify-total-rtos.ts

# Or verify a specific state
bun scripts/verify-total-rtos.ts --state=andhra-pradesh

# Dry run to preview changes
bun scripts/verify-total-rtos.ts --dry-run
```

This script:

- Uses Gemini AI to research official sources (transport dept websites, Wikipedia)
- Identifies ALL valid RTO codes including gaps
- Updates `config.json` with:
  - `totalRTOs`: Actual count of valid codes
  - `validCodes`: Complete array of valid codes (e.g., `["AP-01", "AP-02", "AP-03", "AP-135", ...]`)

### 2. Config Structure

After running verification, your `config.json` will look like:

```json
{
  "stateCode": "AP",
  "name": "Andhra Pradesh",
  "displayName": "Andhra Pradesh",
  "capital": "Amaravati",
  "totalRTOs": 40,
  "validCodes": [
    "AP-01",
    "AP-02",
    "AP-03",
    "AP-135",
    "AP-137",
    "AP-141",
    "AP-202",
    "AP-203"
  ],
  "mapFile": "map.svg",
  "districtMapping": {},
  "svgDistrictIds": [],
  "isComplete": false,
  "type": "state"
}
```

### 3. How Scripts Use Valid Codes

**populate-rto-data.ts** now:

1. Loads `validCodes` from `config.json`
2. Uses the actual valid codes instead of generating sequential ones
3. Handles ranges correctly: if you request "RTOs 1-50", it uses `validCodes.slice(0, 50)`

```bash
# Generate first 10 valid RTOs (uses validCodes[0-9])
bun scripts/populate-rto-data.ts ap 1 10

# Generate next batch (uses validCodes[10-59])
bun scripts/populate-rto-data.ts ap 11 60
```

**Fallback behavior**: If `validCodes` is not found, the script falls back to sequential generation with a warning.

### 4. Automated Workflow

The scheduled GitHub Actions workflow automatically:

1. Reads `validCodes` from config
2. Determines which codes to process next
3. Passes the correct range to `populate-rto-data.ts`
4. Creates PRs with accurate, valid RTO codes only

## Benefits

✅ **Accuracy**: Only generates RTOs that actually exist  
✅ **No gaps**: Avoids creating invalid codes like AP-04 through AP-134  
✅ **Flexibility**: Handles any numbering scheme (sequential, gaps, or completely custom)  
✅ **Automation-ready**: Workflows use the validated list automatically

## States Affected

While Karnataka and Goa have mostly sequential codes, many states have gaps:

- **Andhra Pradesh**: Large gaps (AP-03 → AP-135)
- **Maharashtra**: Some gaps in higher codes
- **Tamil Nadu**: Mixed sequential and special codes
- **Many others**: Need validation to confirm

**Recommendation**: Run `verify-total-rtos.ts` for ALL states before automation to ensure accuracy.

## Manual Override

If you know the exact valid codes for a state, you can manually edit `config.json`:

```json
{
  "totalRTOs": 5,
  "validCodes": ["XX-01", "XX-02", "XX-05", "XX-10", "XX-99"]
}
```

Then run populate scripts normally - they'll use your list.

## Testing

Test the non-sequential handling with a known state:

```bash
# 1. Verify codes (dry run first)
bun scripts/verify-total-rtos.ts --state=andhra-pradesh --dry-run
bun scripts/verify-total-rtos.ts --state=andhra-pradesh

# 2. Check config.json
cat data/andhra-pradesh/config.json | jq '.validCodes'

# 3. Generate a few RTOs to verify
bun scripts/populate-rto-data.ts ap 1 3

# 4. Verify it used the correct codes
ls data/andhra-pradesh/ap-*.json
```

You should see files like `ap-01.json`, `ap-02.json`, `ap-03.json` (not ap-04, ap-05, etc.).

## Notes

- The `verify-total-rtos.ts` script includes rate limiting (2s delay) to avoid API limits
- Gemini AI confidence scores are logged - review low-confidence results manually
- The `validCodes` array is optional - states with sequential codes work fine without it
- Existing sequential states (Karnataka, Goa) don't need `validCodes` unless you want to add it for consistency
