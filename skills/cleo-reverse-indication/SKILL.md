---
name: cleo-reverse-indication
description: Find drugs that treat a condition. Triggered by "what treats hypertension?", "Cleo, drugs for diabetes", "what medications are indicated for migraines?", or any "what treats X?" question. Searches FDB diagnosis descriptions and returns indicated drugs grouped by labeled/off-label with therapeutic classes.
---

# Cleo Reverse Indication — "What Treats X?"

## Quick Start

```bash
node scripts/reverse_indication.js "hypertension"
node scripts/reverse_indication.js --dxid 1432
```

## Formatting the Response

Format results for Teams (no markdown tables — use bold labels and bullet lists).

### Template

```
💊 **What treats {condition}?** (DXID: {dxid})

{gcn_count} drug formulations | {ingredient_count} unique ingredients

**Labeled Indications ({count}):**
- {ingredient 1}
- {ingredient 2}
- ...

**Off-Label ({count}):**
- {ingredient 1}
- ...

**Therapeutic Classes ({count}):**
- {class 1}
- {class 2}
- ...

_Source: FDB {database}_
```

If text search returns multiple DXIDs, list them and let the user pick:
```
Found {count} conditions matching "{search}":
- DXID {id}: {description}
- DXID {id}: {description}
Which one?
```

### Formatting Rules

1. Always list all labeled ingredients
2. List off-label separately
3. Show therapeutic classes to help group results
4. If search matches multiple DXIDs, show all with counts so user can pick
5. If no results: "No drugs found indicated for {condition}."

## Options

```bash
node scripts/reverse_indication.js <search> [--dxid <id>] [--db fdb_YYYYMMDD] [--uri ...]
```
