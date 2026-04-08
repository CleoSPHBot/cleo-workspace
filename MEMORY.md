# MEMORY.md — Cleo's Long-Term Memory

## Who I Am
- **Name:** Cleo
- **Emoji:** 🦉
- **Role:** Clinical AI assistant for Spectator Health
- **Specialty:** Pharmaceutical data, drug lookups, medication management, HEDIS quality measures
- **Moniker:** "Cleo" is also the brand name for AI integrations at Spectator Health

## Spectator Health Agent Family

| Agent | Animal | Emoji | Role |
|-------|--------|-------|------|
| Edgar | Lobster | 🦞 | General assistant / infra |
| Ada | Butterfly | 🦋 | Infrastructure monitoring |
| Hugo | Fox | 🦊 | Apple development (iOS/macOS) |
| Cleo | Owl | 🦉 | Clinical data + AI integrations |
| Hedy | Octopus | 🐙 | TBD (coming soon) |

- Edgar set me up (2026-03-24/25) — he's the senior agent, handles infra and general tasks
- Hugo handles iOS/Swift work
- Ada monitors infrastructure

## Infrastructure

- **My server:** Same EC2 as Edgar (ip-172-16-153-208, Tailscale: 100.70.3.21)
- **Gateway:** Port 18800, systemd service, linger enabled
- **Teams webhook:** Port 3979, Tailscale Funnel on port 8443
- **Teams bot:** CleoSphBot, App ID c9eecec6-c582-4d3d-b085-e126052efbb4
- **Dashboard:** SSH tunnel `ssh -L 18800:127.0.0.1:18800 100.70.3.21` → http://localhost:18800
- **Edgar's gateway:** Port 18789 (same server)

## Clinical Skills (14)
- **Drug lookups:** cleo-ndc-lookup, cleo-medid-lookup, cleo-drug-search, cleo-routed-med-lookup, cleo-route-search, cleo-upc-lookup
- **Clinical decision support:** cleo-side-effects, cleo-reverse-indication, cleo-etc-lookup, **cleo-ddi-check** (drug-drug interactions)
- **Diagnosis/procedure:** cleo-icd-lookup, cleo-cpt-lookup
- **Rx:** cleo-prescription-reader (photo → drug info)
- **Knowledge base:** cleo-qbusiness (HEDIS, FHIR, Surescripts, FDB docs, NCQA, CQL)

## DDI Skill Notes
- **cleo-ddi-check** built 2026-03-31 — FDB DDI via `fdb_20260326`
- 4,551 monographs, 712,650 GCN→DDI links
- Drug name → HICL_SEQNO → GCN_SEQNOs → DDI_CODEXes → monographs
- node_modules symlinked from cleo-medid-lookup (shared)
- Supports: drug name, MEDID (--medids), GCN (--gcns), 2+ drugs at once

## FDB Data Notes
- FDB source: Atlas cluster `dev-fdb-01.qpkxl.mongodb.net`, env var `FDB_MONGO_URI`
- Database naming: `fdb_YYYYMMDD` snapshots, scripts auto-detect latest
- NDC → pill image is a direct lookup: `RIMGUDG2_UNQ_DRUG.IMGNDC` → `IMGUNIQID` → `IMGID` → `IMGFILENM` → JPEG data
- 1 MEDID can map to multiple representative NDCs — each may have different pill images (important for future pill picker UI)
- Image collections: `RIMGUDG2_UNQ_DRUG`, `RIMGUIJ2_UNQ_DRUG_JRNL`, `RIMGIMG2_IMAGE`, `RIMGIMG2_IMAGE_DATA`

## Teams Integration Notes
- Azure bot permissions needed: `Chat.Read.All` + `ChatMessage.Read.All` (Application, admin consent)
- dmPolicy: currently `open` — should tighten later
- **Known bug:** iPhone/mobile Teams inline images don't download (OpenClaw #28014). Plugin uses Bot Framework token instead of MSAL Graph token. Workaround: send images from desktop.
- **Sending images:** Use `MEDIA:./filename.jpg` in direct reply text. Do NOT use message tool with filePath — it doesn't render on Teams.
- Pill images save to workspace, then send with MEDIA: tag

## Q Business (QB / QSph)
- App ID: `1b2dcad6-c48e-4f28-ba6e-b10e4a8e476f`
- Indexed: HEDIS MY2025/2026, FHIR R4, CQL, FDB docs, Surescripts, NCQA, Long COVID research
- Auto-syncs daily 6 AM UTC
- When people say "QB", "QSph", "check the docs" → use cleo-qbusiness skill

## Key Decisions & Lessons
- Always format NDCs with dashes: 5-4-2 (e.g., 00071-0155-23)
- UPC → NDC isn't always reliable for OTC products (retail UPCs ≠ drug NDCs)
- When OCR is available, prefer reading printed NDC over UPC barcode conversion
- Git remote: github.com/CleoSPHBot/cleo-workspace.git, daily backup at 7 AM UTC
- **Daily memory files are sparse** — daily writing habit still not formed. Dream-mode cron running nightly at 13:00 UTC / 6 AM PST (established 2026-04-04). Now on 4th consecutive run (2026-04-07). No daily files exist for March 27–April 6 — if significant work happened, it's not recorded. Main session must write daily notes for dreams to be useful.
- `dmPolicy: open` is a known security TODO — tighten when pairing flow is resolved
