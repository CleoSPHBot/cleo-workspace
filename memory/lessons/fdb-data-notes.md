# FDB Data Notes — Reference

Archive of FDB technical notes. Active clinical lookups are still in skills (cleo-ndc-lookup, cleo-medid-lookup, etc.). This file is for reference when working with FDB schema directly.

## FDB Source

- Atlas cluster: `dev-fdb-01.qpkxl.mongodb.net`
- Env var: `FDB_MONGO_URI`
- Database naming: `fdb_YYYYMMDD` snapshots (e.g., `fdb_20260326` is main/latest)
- Scripts auto-detect latest snapshot

## NDC Master

- Collection: `RNDC14_NDC_MSTR`
- Key fields:
  - `NDC` — 11-digit, no dashes (e.g., `24979024007`)
  - `NDCFI` — 1 or 2 = active, 3 = obsolete
  - `REPNDC` — direct replacement NDC
  - `GCN_SEQNO` — clinical equivalence key

## Obsolescence Workflow

1. Check `NDCFI`.
2. If 3 (obsolete), use `REPNDC` first.
3. If `REPNDC` is empty, find active sibling with same `GCN_SEQNO`.
4. If no active replacement exists, product is discontinued (e.g., Qbrelis — all GCN 76442 NDCs obsolete).

## NDC Format

- FDB stores 11-digit no dashes: `24979024007`
- User-facing format: 5-4-2 with dashes: `24979-0240-07`
- ALWAYS format NDCs with dashes when presenting to users.

## NDC → Pill Image

Direct lookup chain:
1. `RIMGUDG2_UNQ_DRUG.IMGNDC` → `IMGUNIQID`
2. `IMGUNIQID` → `IMGID`
3. `IMGID` → `IMGFILENM` → JPEG data

Image collections: `RIMGUDG2_UNQ_DRUG`, `RIMGUIJ2_UNQ_DRUG_JRNL`, `RIMGIMG2_IMAGE`, `RIMGIMG2_IMAGE_DATA`.

**Important:** 1 MEDID can map to multiple representative NDCs — each may have different pill images. Critical for future pill picker UI for nurses.

## UPC → NDC Caveats

- Not always reliable for OTC products (retail UPCs ≠ drug NDCs).
- When OCR is available, prefer reading printed NDC over UPC barcode conversion.

## DDI Skill Internals (cleo-ddi-check, built 2026-03-31)

- FDB DDI source: `fdb_20260326` snapshot
- Scale: 4,551 monographs, 712,650 GCN→DDI links
- Lookup chain: drug name → HICL_SEQNO → GCN_SEQNOs → DDI_CODEXes → monographs
- `node_modules` symlinked from cleo-medid-lookup (shared)
- Inputs supported: drug name, MEDID (--medids), GCN (--gcns), 2+ drugs at once

## FDB prescribableMed Naming Patterns (LTC)

Common corrections when verifying medication names against FDB:

- **metformin 1000mg** → `metformin 1,000 mg tablet` (comma in 4-digit strengths)
- **omeprazole capsule** → `omeprazole 20 mg capsule,delayed release` (always delayed release)
- **cholecalciferol 2000 unit** → `cholecalciferol (vitamin D3) 50 mcg (2,000 unit) tablet` (full name + dual units)
- **hydroxyzine** → `hydroxyzine HCl 25 mg tablet` (always HCl salt form)
- **insulin regular** → `insulin U-100 regular human 100 unit/mL injection solution` (U-100, human, injection solution)
- **ipratropium nebulizer** → `ipratropium bromide 0.02 % solution for inhalation` (bromide, % not mg/mL)
- **albuterol nebulizer** → `albuterol sulfate 2.5 mg/3 mL (0.083 %) solution for nebulization` (sulfate + %)
- **tiotropium capsule** → `tiotropium bromide 18 mcg capsule with inhalation device` (bromide + device)
- **potassium chloride tablet** → `potassium chloride ER 20 mEq tablet,extended release` (ER, confirm wax-matrix vs part/cryst)
- **morphine injection** → `morphine 2 mg/mL injection solution` (add "solution")
- **bisacodyl** — plain tablet vs `,delayed release` (confirm formulary)
- **PEG 3350** — `oral powder` (bulk) vs `oral powder packet` (unit-dose) (confirm formulary)
