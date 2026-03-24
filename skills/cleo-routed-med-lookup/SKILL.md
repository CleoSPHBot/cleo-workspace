---
name: cleo-routed-med-lookup
description: Look up FDB Routed Med IDs. Triggered by questions like "what is routed med 3330?", "Cleo, routed med ID 3330", "look up RMID 3330", or any request referencing an FDB routed med identifier. Returns drug name, route, dose forms, available strengths/products, therapeutic classes, ingredients, indications, and NDC count.
---

# Cleo Routed Med Lookup

## Quick Start

```bash
node scripts/routed_med_lookup.js <ROUTED_MED_ID>
```

Auto-detects latest complete FDB database.

## Formatting the Response

Format results for Teams (no markdown tables — use bold labels and bullet lists).

### Template

```
💊 **Routed Med {id}**

**{description}** ({med_name_type}) — {ingredient}

- **Route:** {route}
- **Class:** {therapeutic classes}
- **Status:** {active/inactive}
- **NDCs:** {ndc_count} across {product_count} products

**Available Strengths:**
- {strength 1} — {product description} (ROUTED_DOSAGE_FORM_MED_ID: {id}, MEDID: {medid})
- {strength 2} — {product description} (ROUTED_DOSAGE_FORM_MED_ID: {id}, MEDID: {medid})
- ...

**Labeled Indications:**
- {indication 1}
- ...

**Off-Label Indications:**
- {indication 1}
- ...

_Source: FDB {database}_
```

### Formatting Rules

1. Show brand/generic indicator next to name
2. List all strengths with their product descriptions
3. Split indications into labeled and off-label
4. Omit empty sections
5. If `found: false`, respond: "Routed Med ID {id} not found in FDB."

## Options

```bash
node scripts/routed_med_lookup.js <ID> --db fdb_20260305
node scripts/routed_med_lookup.js <ID> --uri mongodb+srv://...
```
