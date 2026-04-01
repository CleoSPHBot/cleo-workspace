---
name: cleo-ddi-check
description: "Check drug-drug interactions (DDI) between two or more medications using FDB data. Triggered by questions like 'do X and Y interact?', 'is it safe to take A with B?', 'check interactions for these drugs', 'what are the interactions between drug1 and drug2?', or any multi-drug safety question. Returns severity level, monograph title, mechanism, clinical effects, and patient management guidance."
metadata:
  openclaw:
    emoji: "⚠️"
    requires:
      bins: ["node"]
---

# Drug-Drug Interaction (DDI) Checker

Check for interactions between 2+ drugs using FDB's full DDI monograph database.

## When to Use

✅ **USE this skill when:**
- User asks if two or more drugs interact
- Questions like "is it safe to take X with Y?"
- Medication reconciliation checks
- Multi-drug interaction screening
- Questions about drug combination safety

❌ **DON'T use this skill when:**
- Looking up a single drug (use cleo-medid-lookup or cleo-drug-search)
- Side effects of a single drug (use cleo-side-effects)
- Allergy/cross-reactivity questions

## Data Source

- **FDB DDI Database:** `fdb_20260326` (or latest `fdb_YYYYMMDD` db)
- **4,551 DDI monographs**, **712,650 GCN→DDI links**
- Drug resolution uses `fdb_ok_20250925` for name→GCN lookups

## Severity Levels

| Level | Label | Meaning |
|-------|-------|---------|
| 1 | 🔴 CONTRAINDICATED | Should not be dispensed/administered together |
| 2 | 🟠 SEVERE | Action required to reduce risk |
| 3 | 🟡 MODERATE | Assess risk, take action as needed |
| 9 | 🔵 UNDETERMINED | Alternative therapy interaction; assess risk |

## Usage

```bash
# By drug name (recommended)
node ~/.openclaw/workspace/skills/cleo-ddi-check/scripts/ddi_check.js "drug1" "drug2"
node ~/.openclaw/workspace/skills/cleo-ddi-check/scripts/ddi_check.js "atorvastatin" "gemfibrozil"
node ~/.openclaw/workspace/skills/cleo-ddi-check/scripts/ddi_check.js "warfarin" "aspirin" "ibuprofen"

# By MEDID
node ~/.openclaw/workspace/skills/cleo-ddi-check/scripts/ddi_check.js --medids 283712 304570

# By GCN_SEQNO
node ~/.openclaw/workspace/skills/cleo-ddi-check/scripts/ddi_check.js --gcns 29967 45890
```

Run from the scripts directory (has symlinked node_modules):
```bash
cd ~/.openclaw/workspace/skills/cleo-ddi-check && node scripts/ddi_check.js "drug1" "drug2"
```

## Output Format

```json
{
  "ddiDatabase": "fdb_20260326",
  "drugs": [
    { "input": "atorvastatin", "resolved": "atorvastatin calcium", "gcnCount": 5, "codexCount": 68 }
  ],
  "interactionCount": 1,
  "interactions": [
    {
      "pair": ["atorvastatin calcium", "gemfibrozil"],
      "title": "Atorvastatin/Gemfibrozil",
      "severity": "1",
      "severityLabel": "🔴 CONTRAINDICATED",
      "displayAction": "Interrupt",
      "pharmacodynamic": true,
      "pharmacokinetic": false,
      "text": "full monograph text..."
    }
  ]
}
```

## Interpreting Results

- **No interactions found:** The drug pair has no FDB monograph — may still have minor interactions; always recommend clinical review
- **CONTRAINDICATED (1):** Flag clearly — should not be co-administered
- **SEVERE (2):** Recommend clinical review and action
- **MODERATE (3):** Present with context; patient-specific assessment needed
- **Multiple drugs:** All pairs are checked (n*(n-1)/2 combinations)

## Formatting for Users

When presenting DDI results:
1. Lead with severity badge and drug pair
2. Summarize clinical effects in plain language
3. Include key patient management points
4. Note predisposing factors if present (age, renal function, etc.)
5. Remind: this is clinical decision support, not a substitute for clinical judgment

## Important Notes

- FDB DDI operates at the GCN_SEQNO (generic ingredient + strength + form) level
- The checker resolves drug names → HICL_SEQNO → GCN_SEQNOs → DDI_CODEXes for matching
- Brand names should also resolve correctly via ingredient matching
- Always clarify that DDI checking is for clinical decision support only
