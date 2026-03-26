---
name: cleo-upc-lookup
description: Convert UPC barcodes to NDC and look up drug info. Triggered by "look up UPC 041100806024", "what drug is this barcode?", "Cleo, UPC lookup", or any request involving a UPC/barcode for a drug product. Also handles barcode images — extract the number using vision, then run the lookup. Returns the matched NDC, drug name, strength, form, route, therapeutic class, and indications.
---

# Cleo UPC-to-NDC Lookup

## Quick Start

```bash
node scripts/upc_to_ndc.js <UPC> [--img-dir /tmp]
```

Accepts:
- **12-digit UPC-A** (standard barcode): `041100806024`
- **13-digit EAN-13**: `0041100806024`
- **10-digit raw NDC** (if pre-extracted): `4110080602`

The script derives up to 3 NDC-11 candidates by inserting a zero in each possible segment position, then looks up each against FDB until a match is found.

## How UPC → NDC Works

A UPC-A barcode (12 digits) encodes an NDC like this:

```
UPC-A:  P LLLLPPPPKK C
        ↑ ↑         ↑
     prefix  NDC-10  check digit
```

1. Strip the leading prefix digit and trailing check digit → 10-digit raw NDC
2. The 10-digit NDC needs one zero inserted to become the 11-digit NDC:
   - **Candidate 1:** `0` + raw10 (zero prepended — labeler was 4 digits)
   - **Candidate 2:** raw10[0..3] + `0` + raw10[4..] (zero in product segment)
   - **Candidate 3:** raw10[0..7] + `0` + raw10[8..] (zero in package segment)
3. Look up each candidate against FDB until a match is found

## Handling Barcode Images

If the user sends a **photo of a barcode** instead of the number:

1. Use the `image` tool (vision model) to extract the UPC number from the image
   - Prompt: "Read the barcode number from this image. Return only the digits, nothing else."
2. Pass the extracted number to this script

## Formatting the Response

### Template

```
📦 **UPC {upc}** → NDC {matched_ndc}

**{brand_or_label}** ({generic_name}) — {strength} {dose_form}

- **Route:** {route}
- **Class:** {therapeutic_class_name}
- **Package:** {package_desc} ({pack_size})
- **DEA Schedule:** {schedule or "None"}

**Labeled Indications:**
- {indication 1}
- {indication 2}

**Off-Label Indications:**
- {indication 1}
```

### Formatting Rules

1. Show the UPC → NDC mapping prominently
2. Format NDC with dashes: `41100-0806-02`
3. If `found: false`, respond: "Could not find a drug match for UPC {upc}. The derived NDC candidates were: {list}. This UPC may not be a drug product, or it may not be in the FDB database."
4. **Pill image:** If `image.saved_to` exists in the result, save it to `~/.openclaw/workspace/` and include `MEDIA:./FILENAME.jpg` on its own line at the end of your **direct text reply** (NOT inside a message tool card call). The MEDIA tag must be in your normal reply text to work. Do NOT use the message tool to send the image.
5. Show which candidate matched in the response for transparency

## Fallback Chain

1. **Direct NDC conversion** (high confidence) — standard UPC→NDC encoding, FDB lookup
2. **UPC product database** (medium confidence) — queries upcitemdb.com free API (100/day, no key, by IP)
   - Identifies the product name, brand, description
   - Extracts active ingredient from description (e.g. "ferrous sulfate 325 mg")
   - Searches FDB by ingredient name to find matching drugs
3. **Not found** (low confidence) — UPC not in product database either

The `method` and `confidence` fields in the output indicate which path was taken.

## Dependencies

Uses `cleo-ndc-lookup` and `cleo-drug-search` skill scripts for FDB lookups. No additional npm dependencies needed.
