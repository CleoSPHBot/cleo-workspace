# FDB Schema Reference — NDC Lookup Path

## Core Entity Relationships

```
NDC (RNDC14_NDC_MSTR)
 └─ GCN_SEQNO → RGCNSEQ4_GCNSEQNO_MSTR (generic clinical number)
     ├─ GCRT → RROUTED3_ROUTE_DESC (route: oral, IV, etc.)
     ├─ GCDF → RMIDFD1_DOSE_FORM (dose form: tablet, capsule, etc.)
     ├─ HICL_SEQNO → RHICLSQ1_HICLSEQNO_MSTR (ingredient identity)
     ├─ → RETCGC0_ETC_GCNSEQNO → RETCTBL0_ETC_ID (therapeutic class)
     ├─ → RINDMGC0_INDCTS_GCNSEQNO_LINK → RINDMMA2_INDCTS_MSTR
     │     └─ DXID → RFMLDX0_DXID (diagnosis descriptions)
     └─ → RMIID1_MED (med ID, product-level info)
```

## Key Collections

| Collection | PK Index | Join Key | Purpose |
|-----------|----------|----------|---------|
| `RNDC14_NDC_MSTR` | `NDC` | `GCN_SEQNO` | 499K NDCs — entry point for NDC lookups |
| `RGCNSEQ4_GCNSEQNO_MSTR` | `GCN_SEQNO` | HICL_SEQNO, GCDF, GCRT | 38K generic clinical numbers — the hub |
| `RETCTBL0_ETC_ID` | `ETC_ID` | — | 3.3K therapeutic class hierarchy |
| `RETCGC0_ETC_GCNSEQNO` | `GCN_SEQNO, ETC_ID` | — | GCN → therapeutic class links |
| `RINDMMA2_INDCTS_MSTR` | `INDCTS, INDCTS_SN` | DXID | 17K indication master |
| `RINDMGC0_INDCTS_GCNSEQNO_LINK` | `GCN_SEQNO, INDCTS` | — | GCN → indication links |
| `RINDMDD0_INDCTS_DRUG_DESC` | `INDCTS` | — | 4K indication → drug name descriptions |
| `RFMLDX0_DXID` | `DXID` | — | 7.9K diagnosis descriptions |
| `RROUTED3_ROUTE_DESC` | `GCRT` | — | Route descriptions |
| `RMIDFD1_DOSE_FORM` | `GCDF` | — | Dose form descriptions |
| `RHICLSQ1_HICLSEQNO_MSTR` | `HICL_SEQNO` | — | 14K ingredient descriptions |
| `RMIID1_MED` | `MEDID` | GCN_SEQNO | 114K med product records |

## NDC Format

FDB stores NDCs as 11-digit zero-padded strings without dashes: `00069315083`

Standard NDC formats (5-4-2, 5-3-2, 4-4-2) should be normalized by stripping dashes/spaces.

## Key Fields in RNDC14_NDC_MSTR

| Field | Description |
|-------|-------------|
| `NDC` | 11-digit NDC |
| `LN` / `LN60` | Label name (short / long) |
| `BN` | Brand name |
| `GCN_SEQNO` | Generic clinical number (join key) |
| `DEA` | DEA schedule (0=none, 2-5=schedule) |
| `PD` | Package description |
| `PS` | Package size |
| `OBC` | Orange Book code |
| `OBSDTEC` | Obsolete date |
| `CL` | Class (O=OTC, R=Rx) |

## Database Naming & Readiness

FDB snapshots are stored as `fdb_YYYYMMDD` databases. Always use the latest *complete* one unless a specific date is requested.

**Readiness check:** `NDDF_PRODUCT_INFO` is a single-document metadata collection. The `createDate` field is written only after ETL completes. If `createDate` is missing, the database is still loading — fall back to the previous snapshot.

| Field | Meaning |
|-------|---------|
| `PRODUCTION_DATE` | When FDB produced the source data |
| `createDate` | When ETL finished loading (DB is ready) |
| `imageCreateDate` | When drug images were loaded |
| `imageDataCreateDate` | When image binary data was loaded |
