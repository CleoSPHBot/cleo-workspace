---
name: cleo-side-effects
description: Look up side effects and contraindications for a drug. Triggered by "what are the side effects of Lipitor?", "Cleo, contraindications for metformin", "is atorvastatin safe in pregnancy?", or any safety/adverse-effect question. Returns side effects (with severity and frequency) and contraindications (with severity and PI references).
---

# Cleo Side Effects & Contraindications

## Quick Start

```bash
node scripts/side_effects.js <MEDID>
node scripts/side_effects.js <GCN_SEQNO> --by-gcn
```

Accepts MEDID (resolves to GCN internally) or GCN_SEQNO directly.

## Data Sources

- **Side Effects:** `RSIDEGC0_GCNSEQNO_LINK` → `RSIDEMA3_MSTR` → `RFMLDX0_DXID`
- **Contraindications:** `RDDCMGC0_CONTRA_GCNSEQNO_LINK` → `RDDCMMA1_CONTRA_MSTR` → `RFMLDX0_DXID`

### Severity/Frequency Codes

**Side Effects:**
- Frequency: 1=rare, 2=infrequent, 3=frequent
- Severity: 1=minor, 2=moderate, 3=major

**Contraindications:**
- Severity: 1=severe, 2=moderate, 3=mild

## Formatting the Response

Format results for Teams (no markdown tables — use bold labels and bullet lists).

### Template

```
⚠️ **Side Effects & Contraindications: {drug name}**

**Contraindications ({count}):**

🔴 **Severe:**
- {condition} — ref: {reference}
- ...

🟡 **Moderate:**
- {condition} — ref: {reference}
- ...

⚪ **Other:**
- {condition} — ref: {reference}
- ...

**Side Effects ({count}):**

🟡 **Moderate/Frequent:**
- {effect}

⚪ **Minor/Infrequent:**
- {effect}
- ...

⚪ **Minor/Rare:**
- {effect}
- ...

**Other:**
- {effect}
- ...

_Source: FDB {database}_
```

### Formatting Rules

1. Lead with contraindications (safety-critical)
2. Group contraindications by severity (🔴 severe, 🟡 moderate, ⚪ other)
3. Include PI reference for contraindications
4. Group side effects by severity+frequency
5. Always show all contraindications; for side effects, show all (they're typically manageable lists)
6. If MEDID not found: "MEDID {id} not found in FDB."

## Options

```bash
node scripts/side_effects.js <MEDID> [--by-gcn] [--db fdb_YYYYMMDD] [--uri ...]
```
