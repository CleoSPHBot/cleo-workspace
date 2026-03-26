---
name: cleo-ndc-lookup
description: Look up National Drug Codes (NDC) against FDB data. Triggered by questions like "what is NDC X?", "look up NDC 00069-3150-83", "Cleo, NDC lookup", or any request to identify a drug by its NDC number. Returns drug name, strength, form, route, therapeutic class, and indications.
---

# Cleo NDC Lookup

## Quick Start

Run the lookup script with `--img-dir` to save any pill image:

```bash
node scripts/ndc_lookup.js <NDC> --img-dir ~/.openclaw/workspace
```

Accepts any NDC format: `00069-3150-83`, `00069315083`, `0069-3150-83`. The script auto-detects the latest `fdb_YYYYMMDD` database.

## Formatting the Response

Format results for Teams (no markdown tables — use bold labels and bullet lists).

### Template

```
💊 **NDC {formatted_ndc}**

**{brand_or_label}** ({generic_name}) — {strength} {dose_form}

- **Route:** {route}
- **Class:** {therapeutic_class_name}
- **Package:** {package_desc} ({pack_size})
- **DEA Schedule:** {schedule or "None"}
- **Status:** {active/obsolete + date if obsolete}

**Labeled Indications:**
- {indication 1}
- {indication 2}
- ...

**Off-Label Indications:**
- {indication 1}
- ...

_Source: FDB {database}_
```

### Formatting Rules

1. Format NDC with dashes: `00069-3150-83` (5-4-2)
2. Split indications into **Labeled** and **Off-Label** groups
3. Capitalize generic name in the header, lowercase in indication list
4. Omit sections with no data (don't show empty off-label section)
5. DEA schedule: show "None" for 0, "Schedule II-V" for 2-5
6. If `found: false`, respond: "NDC {ndc} not found in FDB. Check the format (11 digits, no dashes) or try a different NDC."
7. **Pill image:** Always run with `--img-dir ~/.openclaw/workspace`. If `image.saved_to` exists in the result, include `MEDIA:./FILENAME.jpg` on its own line at the end of your **direct text reply** (NOT inside a message tool card call). The MEDIA tag must be in your normal reply text to work. Do NOT use the message tool to send the image. Example:

```
💊 **NDC 00071-0155-23**
...drug info here...

MEDIA:./00071015523.jpg
```

## Schema Reference

For FDB schema details and entity relationships, see [references/fdb-schema.md](references/fdb-schema.md).

## Options

```bash
node scripts/ndc_lookup.js <NDC> --db fdb_20260305   # specific snapshot
node scripts/ndc_lookup.js <NDC> --uri mongodb+srv://...  # custom URI
```

Environment variable `FDB_MONGO_URI` can also set the connection string.
