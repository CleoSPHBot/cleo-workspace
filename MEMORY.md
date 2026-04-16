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

## Clinical Skills (15)
- **Drug lookups:** cleo-ndc-lookup, cleo-medid-lookup, cleo-drug-search, cleo-routed-med-lookup, cleo-route-search, cleo-upc-lookup
- **Clinical decision support:** cleo-side-effects, cleo-reverse-indication, cleo-etc-lookup, **cleo-ddi-check** (drug-drug interactions)
- **Diagnosis/procedure:** cleo-icd-lookup, cleo-cpt-lookup
- **Rx:** cleo-prescription-reader (photo → drug info)
- **Knowledge base:** cleo-qbusiness (HEDIS, FHIR, Surescripts, FDB docs, NCQA, CQL)
- **Dermatology:** cleo-derm-consult (built 2026-04-05 — structured rash/skin consult, 5-step workflow, ICD-10 linkage, cyclist-specific conditions reference)

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
- **File transfer workaround:** Desktop Teams PDFs/files not downloading either. David drops files in `/home2/cleo/for-cleo/` → I copy to inbound/, process, upload to S3, catalog, sync QB (established Apr 13)

## Q Business (QB / QSph)
- App ID: `1b2dcad6-c48e-4f28-ba6e-b10e4a8e476f`
- Indexed: HEDIS MY2025/2026, FHIR R4, CQL, FDB docs, Surescripts, NCQA, Long COVID research
- Auto-syncs daily 6 AM UTC
- When people say "QB", "QSph", "check the docs" → use cleo-qbusiness skill
- **Catalog:** `s3://sph-amazon-q/catalog.yaml` — **54 documents** as of 2026-04-14
- **Recent additions (Apr 9–14):** Lindberg 2026 (MIRACLE-S CV risk), Trubetskoy 2026 (skin SARS-CoV-2 entry), Freire 2026 (persistent Spike gut biopsies), + 5 pacing papers (Meach 2024, Ghali 2023, Vink 2025/2022, Godfrey 2025 PACELOC)
- **LongCOVID-Research data source ID:** `89032f82-4ad1-4394-8258-47d8287ccf61` (S3 prefix: `lc-app/`)

## Security Notes
- `dmPolicy: open` is a known TODO — tighten when pairing flow is resolved
- David sometimes sends messages via openclaw-control-ui — not a security concern (confirmed Apr 12)

## Key Decisions & Lessons
- Always format NDCs with dashes: 5-4-2 (e.g., 00071-0155-23)
- UPC → NDC isn't always reliable for OTC products (retail UPCs ≠ drug NDCs)
- When OCR is available, prefer reading printed NDC over UPC barcode conversion
- Git remote: github.com/CleoSPHBot/cleo-workspace.git, daily backup at 7 AM UTC
- **daily-backup cron:** Created 2026-04-06, runs 13:00 UTC daily, script: `bash /home2/cleo/src/cleo-backup/backup.sh`, 120s timeout, model: claude-sonnet-4-20250514
- **Daily memory writing is working** — dream cron (13:00 UTC nightly) established 2026-04-04. Main session now writing daily files consistently as of 2026-04-10.
- **Tailnet rename:** David changed machine names in tailnet ~2026-04-10. New names unknown — ask next opportunity and update TOOLS.md.
- **Brave Search API key:** Set up 2026-04-12 (Edgar added the key, gateway restart required). Confirmed working — 587ms, clean results. Use for medical research, clinical guidelines, PubMed, patient advocacy orgs, and anything outside QB/FDB scope. Call it "Brave Search" in notes, "web search" in conversation.

## Project Cadence
- **Mission:** Identify biometric, dietary, and behavioral factors driving Hannah's symptomatic days. Find what makes the 5 bad days happen.
- **Patient:** Hannah — Long COVID, PEM + dysautonomia. ~2 good days / 7.
- **Data sources:** WHOOP (API live), Visible (CSV/HealthKit), iPhone app (Hugo, TBD)
- **Stack:** AWS Lambda + API Gateway, MongoDB `cadence-dev` (dev-cluster-02.qpkxl.mongodb.net)
- **Credentials:** stored in `projects/cadence/credentials.md` (not in MEMORY.md)
- **Status:** Webhook live. Lambda had v2→v1 API bug + wrong recovery lookup pattern — fixes generated via Claude Code (2026-04-14), pending David confirmation. Hannah authorized + sleep data landing (2026-04-14: 8.4h, 70% performance). Python backfill script generated — needs run after confirming Hannah's WHOOP start date.
- **Pacing literature (key finding):** Ghali 2023 — pacing adherence is the single best predictor of recovery (OR 40.43). PACELOC 2025: 15% weekly reduction in PEM with structured pacing. GET is contraindicated (WHO, CDC, NICE). Heart rate monitoring is the tool (anaerobic threshold).
- **Probiotics for Hannah:** SIM01/G-NiiB (B. adolescentis + B. bifidum + B. longum + GOS + XOS + resistant dextrin). RECOVERY trial: 10B CFU ×2/day × 6 months (Lancet ID 2023). Available as "G-NiiB Immunity Elite" on Amazon US. Rationale: Freire 2026 gut immune dysregulation → microbiome restoration. Take at night (slower motility, gut repair window).
- **Project files:** `projects/cadence/README.md`, `projects/cadence/credentials.md`
- **Icon:** Deep navy + gold waveform/heartbeat — approved
- **WHOOP REST API:** Base `https://api.prod.whoop.com/developer/v1/` ("v1" = current REST, unrelated to webhook v1/v2). Webhook model = v2 (UUID IDs).
- **WHOOP endpoints:** Sleep `GET /activity/sleep/{uuid}` | Workout `GET /activity/workout/{uuid}` | Recovery: collection only, match on sleep_id | Cycle `GET /cycle/{id}`
- **David WHOOP user_id:** 206067 (hdmunguia@gmail.com) | **Hannah WHOOP user_id:** 6729032 (hannah.munguia@gmail.com)
- **MongoDB collections:** `user`, `webhook_event`, `whoop_daily` (renamed/cleaned Apr 14)
- **Oura Ring:** v2 API at cloud.ouraring.com/v2/docs (OAuth 2.0). Adds skin temp deviation, resilience score. Hannah doesn't have one yet — TBD.
- **Gemini / OpenAI:** Neither API configured currently. David may add for Cadence analysis.
- **File transfer:** David drops files in `/home2/cleo/for-cleo/` — workaround for Teams desktop attachment issue

## FDB NDC Validation
- **NDC master collection:** `RNDC14_NDC_MSTR` in `fdb_YYYYMMDD` databases
- **Key fields:** `NDC` (11-digit, no dashes), `NDCFI` (1 or 2 = active, 3 = obsolete), `REPNDC` (direct replacement NDC), `GCN_SEQNO`
- **Obsolescence workflow:** Check NDCFI; if 3, use REPNDC first; if empty, find active sibling with same GCN_SEQNO
- **When no active replacement exists:** Product is discontinued (e.g., Qbrelis — all GCN 76442 NDCs obsolete)
- **NDC format in FDB:** 11-digit no dashes (e.g., `24979024007`), not 5-4-2 format
- **Multiple FDB snapshots in Atlas:** `fdb_20260326` is main/latest; scripts auto-detect

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
- **bisacodyl** — two forms: plain tablet vs `,delayed release` — confirm formulary
- **PEG 3350** — two forms: `oral powder` (bulk canister) vs `oral powder packet` (unit-dose) — confirm formulary
