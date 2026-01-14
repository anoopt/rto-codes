# Lakshadweep RTO Data

This folder is set up for Lakshadweep RTO codes but doesn't contain any RTO data yet.

## How to Contribute

To add RTO data for Lakshadweep, create JSON files following this pattern:

### File Naming
- Format: `ld-NN.json` (e.g., `ld-01.json`, `ld-02.json`)
- Use lowercase for the state code
- Use 2-3 digit numbers

### File Structure
Each RTO file should follow this structure:

```json
{
  "code": "LD-01",
  "region": "Region/Area Name",
  "city": "City Name",
  "state": "Lakshadweep",
  "stateCode": "LD",
  "district": "District Name",
  "description": "Brief description (optional)",
  "status": "active",
  "address": "Full address (optional)",
  "pinCode": "000000",
  "phone": "+91-XXX-XXXXXXX (optional)",
  "email": "rto@example.com (optional)",
  "jurisdictionAreas": ["Area 1", "Area 2"],
  "isDistrictHeadquarter": true
}
```

### Required Fields
- `code` - RTO code (e.g., "LD-01")
- `region` - Area/region name
- `city` - City name
- `state` - "Lakshadweep"
- `stateCode` - "LD"
- `district` - District name

### Optional Fields
- `description` - Additional information about the RTO
- `status` - "active" (default), "not-in-use", or "discontinued"
- `address` - Physical address
- `pinCode` - 6-digit PIN code
- `phone` - Contact number
- `email` - Official email
- `jurisdictionAreas` - Array of areas under this RTO
- `isDistrictHeadquarter` - Boolean flag

## Steps to Add RTOs

1. Create a new file: `ld-XX.json`
2. Add the RTO data following the structure above
3. Run validation: `bun scripts/validate-rto-data.ts lakshadweep`
4. The index will be auto-generated during build

## Need Help?

- See existing RTOs in [Karnataka](../karnataka/) or [Goa](../goa/) folders
- Check the [CONTRIBUTING.md](../../CONTRIBUTING.md) guide
- Read the [DATA.md](../../DATA.md) documentation

Thank you for contributing! 🙏
