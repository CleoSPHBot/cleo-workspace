---
name: cleo-cpt-lookup
description: Look up CPT-4 and HCPCS Level II procedure codes. Triggered by questions like "what is CPT 99396?", "look up HCPCS G0438", "Cleo, CPT lookup 90471", or any request to identify a procedure by its CPT or HCPCS code. Returns descriptions (long, short, consumer, Spanish), clinician descriptors, HEDIS value set memberships, and linked HEDIS measures.
---

# Cleo CPT/HCPCS Lookup

## Quick Start

```bash
node scripts/cpt_lookup.js <CODE>
```

Accepts CPT-4 (e.g., `99396`) and HCPCS Level II (e.g., `G0438`, `J1234`) codes.

## Data Sources

- **`sph_focus.CptConsolidatedCodeList`** — 11K CPT-4 codes with long/medium/short/consumer/Spanish descriptions
- **`sph_focus.CptClinicianDescriptor`** — 30K clinician-facing descriptors
- **`sph_focus.CMS_HCPC_MASTER`** / **`HCPC2025_APR_ANWEB`** — HCPCS Level II codes
- **`hedis_2025_valuesets`** — value set + measure linkages

## Formatting the Response

Format results for Teams (no markdown tables — use bold labels and bullet lists).

### Template

```
🩺 **CPT {code}** (or **HCPCS {code}**)

**{long description}**

- **Short:** {short description}
- **Consumer:** {consumer description}
- **Spanish:** {spanish consumer description}
- **Clinician:** {clinician descriptor} (if different from long)

**HEDIS Value Sets ({count}):**
- {value set 1}
- {value set 2}
- ... (always list all)

**Used in HEDIS Measures ({count}):**
- {measure 1}
- {measure 2}
- ... (always list all)

_Source: sph_focus + hedis_2025_valuesets_
```

### Formatting Rules

1. Use 🩺 emoji for CPT, same for HCPCS
2. Omit description fields that are empty or duplicate the long description
3. Omit HEDIS sections if no value set memberships found
4. For HCPCS, note it's Level II and include BETOS/TOS if available
5. If `found: false`, respond: "Code {code} not found. Check the format or try a different code."

## Options

```bash
node scripts/cpt_lookup.js <CODE> --uri mongodb+srv://...
```
