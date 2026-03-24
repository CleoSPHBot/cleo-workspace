---
name: cleo-route-search
description: Search for drug routes and dose forms by name. Triggered by "what are the routes for Lipitor?", "Cleo, how is amphotericin administered?", "what forms does metformin come in?", or any question about drug routes, administration, or available dose forms. Returns all routed meds matching the name with routes, dose forms, and products.
---

# Cleo Route Search

## Quick Start

```bash
node scripts/route_search.js "lipitor"
node scripts/route_search.js "amphotericin"
node scripts/route_search.js "insulin aspart"
```

## Formatting the Response

Format results for Teams (no markdown tables — use bold labels and bullet lists).

### Template

```
💊 **Routes for "{search}"** ({result_count} routed meds)

**{med_name}** ({brand/generic}) — {ingredient}
- **Route:** {route}
- **ROUTED_MED_ID:** {id}
- **Dose Forms:**
  - {dose_form}: {description} (ROUTED_DOSAGE_FORM_MED_ID: {id})
    - {strength} — {product description} (MEDID: {medid})
    - {strength} — {product description} (MEDID: {medid})

(repeat for each routed med)

_Source: FDB {database}_
```

### Formatting Rules

1. Group by routed med (each represents a unique drug + route combination)
2. Show brand results first, then generic
3. Include route, dose forms, and products with strengths
4. Include FDB hierarchy IDs (ROUTED_MED_ID, ROUTED_DOSAGE_FORM_MED_ID, MEDID)
5. If no results: "No routes found for '{search}'."

## Options

```bash
node scripts/route_search.js <name> [--db fdb_YYYYMMDD] [--uri ...]
```
