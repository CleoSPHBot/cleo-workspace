---
name: cleo-etc-lookup
description: Browse and search FDB Enhanced Therapeutic Classification (ETC). Triggered by questions like "what is the ETC for statins?", "Cleo, therapeutic class for atorvastatin", "show me cardiovascular drug classes", "browse ETC", "what drugs are in class 2747?", or any request about therapeutic drug classification. Supports name search, class drill-down, and hierarchy browsing.
---

# Cleo ETC (Therapeutic Class) Lookup

## Quick Start

```bash
node scripts/etc_lookup.js --search "statin"           # name search
node scripts/etc_lookup.js --id 2747                    # drill into a class
node scripts/etc_lookup.js --id 2747 --drugs            # list all drugs in a leaf class
node scripts/etc_lookup.js --browse                     # top-level categories (47)
node scripts/etc_lookup.js --browse --parent 2553       # children of Cardiovascular
```

## Modes

### Search (`--search`)
Text search on ETC_NAME. Returns matching classes with breadcrumb path, ingredients (for leaf classes), and child count (for branch classes).

### Drill (`--id`)
Drill into a specific ETC ID. For leaf classes: shows ingredients, GCN count, MEDID count, and strength summary. For branch classes: shows children. Add `--drugs` to list all MEDIDs in a leaf class.

### Browse (`--browse`)
Lists top-level categories (47 classes). Add `--parent <ETC_ID>` to browse children of a specific class.

## Formatting the Response

Format results for Teams (no markdown tables — use bold labels and bullet lists).

### Default View: Tree

Use tree format by default. Groups results by their hierarchy and shows structure visually.

**Search:**
```
🏷️ **ETC Search: "{query}"** ({count} results)

📁 {top-level ancestor} (ETC {id})
└── 📁 {parent} (ETC {id})
    └── 🍃 {match} (ETC {id})
          {ingredients, comma-separated}
          {gcn_count} GCNs | {medid_count} MEDIDs

(group each result under its own tree path)

_Source: FDB {database}_
```

**Drill (leaf):**
```
🏷️ **ETC {id}** — {name}

📁 {top} → 📁 {mid} → 🍃 {this class}

**Ingredients ({count}):**
- {ingredient 1}
- {ingredient 2}

{gcn_count} GCNs | {medid_count} MEDIDs

_Source: FDB {database}_
```

**Drill (branch):**
```
🏷️ **ETC {id}** — {name}

📁 {top} → 📁 {mid} → 📁 {this class}

**Children ({count}):**
├── 🍃 {name} (ETC {id})
├── 📁 {name} (ETC {id})
└── 🍃 {name} (ETC {id})

_Source: FDB {database}_
```

**Browse:**
```
🏷️ **ETC Categories** ({parent_name} or "Top Level")

├── 📁 {name} (ETC {id})
├── 🍃 {name} (ETC {id})
└── 📁 {name} (ETC {id})

_Source: FDB {database}_
```

### Compact View (mobile / on request)

Use when user asks for compact view, or on mobile. No tree lines, abbreviated paths.

**Search:**
```
🏷️ **ETC Search: "{query}"**

**ETC {id}** — {name} 🍃
{abbreviated breadcrumb using →}
{ingredients, comma-separated}
{gcn_count} GCNs | {medid_count} MEDIDs

**ETC {id}** — {name} 📁
{abbreviated breadcrumb using →}
{child_count} children

_Source: FDB {database}_
```

**Drill:**
```
🏷️ **ETC {id}** — {name} 🍃
{breadcrumb →}
{ingredients}
{gcn_count} GCNs | {medid_count} MEDIDs

_Source: FDB {database}_
```

### Formatting Rules

1. Use 🏷️ emoji for ETC lookups
2. Use 🍃 for leaf classes (drugs linked), 📁 for branch classes (has children)
3. **Default to tree view** — use compact only when asked or on mobile
4. For search results, show ingredients for leaf classes
5. For drill on leaf, show ingredients and stats; add drug list only if --drugs or user asks
6. For browse, mark each class as leaf or branch
7. If class not found: "ETC {id} not found in FDB."

## Options

```bash
node scripts/etc_lookup.js --search <text> [--db fdb_YYYYMMDD] [--uri ...]
node scripts/etc_lookup.js --id <ETC_ID> [--drugs] [--db ...] [--uri ...]
node scripts/etc_lookup.js --browse [--parent <ETC_ID>] [--db ...] [--uri ...]
```

## ETC Hierarchy

- 8 levels deep, 3,265 active classes
- 47 top-level categories (level 1)
- `ETC_ULTIMATE_CHILD_IND = 1` → leaf class with drugs
- `ETC_PARENT_ETC_ID` → parent class
- `ETC_ULTIMATE_PARENT_ETC_ID` → top-level ancestor
- Drugs link via `RETCGC0_ETC_GCNSEQNO` (GCN level) and `RETCMED0_ETC_MEDID` (MEDID level)
