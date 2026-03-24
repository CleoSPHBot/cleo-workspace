---
name: cleo-drug-search
description: Search drugs by name. Triggered by "Cleo, search for metformin", "find drug lipitor", "look up amoxicillin", or any drug name query that isn't a specific MEDID/NDC/code lookup. Returns matching products grouped by brand/generic family with strengths, MEDIDs, therapeutic class, and FDB hierarchy IDs.
---

# Cleo Drug Name Search

## Quick Start

```bash
node scripts/drug_search.js "metformin"
node scripts/drug_search.js "lipitor"
node scripts/drug_search.js "amoxicillin" --limit 20
```

## Formatting the Response

Format results for Teams (no markdown tables — use bold labels and bullet lists).

### Template

```
🔍 **Drug Search: "{query}"** ({total_matches} matches)

**{med_name}** ({brand/generic}) — {ingredient}
- ROUTED_MED_ID: {id} | ROUTED_DOSAGE_FORM_MED_ID: {id}
- **Class:** {therapeutic classes}
- **Products:**
  - {strength} {uom} — {description} (MEDID: {medid})
  - {strength} {uom} — {description} (MEDID: {medid})
  - ...

(repeat for each group)

_Source: FDB {database}_
```

### Formatting Rules

1. Group results by brand/generic family (routed dose form)
2. Show FDB hierarchy IDs (ROUTED_MED_ID, ROUTED_DOSAGE_FORM_MED_ID)
3. Sort products by strength within each group
4. Note Rx vs OTC
5. If no results: "No drugs found matching '{query}'."
6. If many matches, note total and suggest narrowing the search

## Options

```bash
node scripts/drug_search.js <name> [--limit 50] [--db fdb_YYYYMMDD] [--uri ...]
```
