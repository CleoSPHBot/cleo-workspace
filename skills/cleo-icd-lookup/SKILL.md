---
name: cleo-icd-lookup
description: Look up ICD-10-CM diagnosis codes against FDB data. Triggered by questions like "what is ICD-10 C50.911?", "look up ICD code E11.9", "Cleo, ICD lookup Z23", or any request to identify a diagnosis by its ICD-10 code. Returns description, code hierarchy, related clinical diagnoses, and indicated medications.
---

# Cleo ICD-10 Lookup

## Quick Start

```bash
node /home2/cleo/.openclaw/workspace/skills/cleo-icd-lookup/scripts/icd_lookup.js <ICD-CODE>
```

Accepts codes with or without dots: `C50.911`, `C50911`, `E11.9`. Auto-normalizes and auto-detects latest FDB database.

## Formatting the Response

Format results for Teams (no markdown tables — use bold labels and bullet lists).

### Template

```
🏥 **ICD-10-CM {code}**

**{description}**
⏱ **Disease Duration:** {Acute | Chronic | Both | Not Applicable}

**Hierarchy:**
- {parent_code}: {parent_desc}
- {child_code}: {child_desc}
- ...
- **{this_code}: {this_desc}** ← (bold the queried code)

**Related Clinical Diagnoses ({count}):**
- {diagnosis 1}
- {diagnosis 2}
- ... (show top 15, note if more exist)

**Indicated Medications ({count}):**
- {drug 1}
- {drug 2}
- ... (show top 20, note if more exist)

_Source: FDB {database}_
```

### Formatting Rules

1. Bold the queried code in the hierarchy
2. Group related diagnoses — show all if ≤15, otherwise show top 15 and note total
3. For indicated drugs, show top 20 alphabetically and note total count if more
4. If `found: false`, respond: "ICD-10 code {code} not found in FDB. Check the format or try a different code."
5. Status: note if code is inactive
6. Disease duration: show `disease_duration.summary` from the result. If null (no DXID mapping), omit the line. For "Both", clarify as "Acute or Chronic"

## Options

```bash
node /home2/cleo/.openclaw/workspace/skills/cleo-icd-lookup/scripts/icd_lookup.js <CODE> --db fdb_20260305
node /home2/cleo/.openclaw/workspace/skills/cleo-icd-lookup/scripts/icd_lookup.js <CODE> --uri mongodb+srv://...
```
