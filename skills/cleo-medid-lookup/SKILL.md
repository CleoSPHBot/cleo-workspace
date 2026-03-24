---
name: cleo-medid-lookup
description: Look up FDB MEDIDs. Triggered by questions like "what is MEDID 181235?", "Cleo, MEDID lookup 158585", or any request referencing an FDB Med ID. Returns full drug description, brand/generic, strength, dose form, route, ingredient, generic equivalent, FDB hierarchy IDs, therapeutic classes, indications, equivalent products (same GCN), NDC samples, and optionally a pill image.
---

# Cleo MEDID Lookup

## Quick Start

```bash
node scripts/medid_lookup.js <MEDID>
node scripts/medid_lookup.js <MEDID> --img-dir ~/.openclaw/workspace
```

Auto-detects latest complete FDB database.

## Formatting the Response

Format results for Teams (no markdown tables — use bold labels and bullet lists).

### Template

```
💊 **MEDID {medid}**

**{description}** ({med_name_type})

- **Ingredient:** {ingredient}
- **Strength:** {strength} {strength_uom}
- **Dose Form:** {dose_form}
- **Route:** {route}
- **Status:** {status} | {legend} | DEA: {dea_schedule}
- **Generic Equivalent:** {generic_equivalent.description} (MEDID: {generic_equivalent.medid})

**FDB Hierarchy:**
- MED_NAME_ID: {med_name_id} ({med_name})
- ROUTED_MED_ID: {routed_med_id} ({routed_med_description})
- ROUTED_DOSAGE_FORM_MED_ID: {routed_dosage_form_med_id} ({routed_dose_form_description})
- GCN_SEQNO: {gcn_seqno}
- HICL_SEQNO: {hicl_seqno}

**Therapeutic Class:**
- {class name} (ETC {etc_id})

**Labeled Indications:**
- {indication 1}
- ...

**Off-Label Indications:**
- {indication 1}
- ...

**Equivalent Products (same strength):**
- {product description} (ROUTED_DOSAGE_FORM_MED_ID: {id}, MEDID: {medid})

**Representative NDCs:** ({ndc_count} total for this strength)
- {ndc} — {label} (pack: {pack_size})
- ...

_Source: FDB {database}_
```

### Formatting Rules

1. Show brand/generic indicator next to name
2. Include the full FDB hierarchy with internal IDs
3. Split indications into labeled and off-label
4. Show generic equivalent only for brand products (and vice versa)
5. Show equivalent products (same GCN_SEQNO = same strength, different brand/generic)
6. Show representative NDCs (one per labeler, matching the MEDID's brand/generic name)
7. Attach pill image if available
8. Omit empty sections
9. If `found: false`, respond: "MEDID {id} not found in FDB."

## Options

```bash
node scripts/medid_lookup.js <MEDID> --db fdb_20260305
node scripts/medid_lookup.js <MEDID> --uri mongodb+srv://...
node scripts/medid_lookup.js <MEDID> --img-dir ~/.openclaw/workspace
```
