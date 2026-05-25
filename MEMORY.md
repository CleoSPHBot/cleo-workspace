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
| Milo | Badger | 🦡 | Business intelligence & marketing |

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
- **May 11 addition:** Faghy et al. 2025 (Nature CommsMed) — comprehensive LC pathophysiology review; 6 mechanistic pillars; no validated biomarkers; no curative treatments; ME/CFS overlap. Wiki: `sources/faghy-2025.md`. QB synced.
- **May 19 addition:** Azhir et al. 2025 (Med, Cell Press) — PASC precision phenotyping; tSPM+ operationalizes WHO dx-of-exclusion; 79.9% PPV, 24,360 patients, 22.8% prevalence, reduces Black/Hispanic undercoding. Wiki: `sources/azhir-2025.md`. QB catalog now 85 entries.
- **LongCOVID-Research data source ID:** `89032f82-4ad1-4394-8258-47d8287ccf61` (S3 prefix: `lc-app/`)

## Security Notes
- `dmPolicy: open` is a known TODO — tighten when pairing flow is resolved

## Project Rounds (Apr 16–ongoing)
- **Mission:** Clinical companion app for EHR — patient status + e-prescribing for doctors/nurses/med-techs
- **Platform:** Expo React Native (iOS + Android); strategy: HTML prototypes (Cleo) → backend API (David) → RN build
- **Prescribing workflow:** Verbal order → Nurse stages (DRAFT) → Doctor signs → Surescripts transmits
- **Order states:** DRAFT → STAGED → SIGNED → TRANSMITTED → CONFIRMED → ADMINISTERED
- **Figma:** EHR `FF0O3AiVbjlIr6tuk2RavO` | Mobile `cr2l2yq0YFn6PGR3luD1tk`; token `/home2/cleo/figma-key`; MCP port 3845; naming `screen/screen-element`
- **Prototype:** login/index/patient/order-new html — port 8766. Design: SPH blue #1a5f8a, urgency bars, FDB pill slots.
- **Backend:** `aegis_mobile` port 15170; `aegis_server.git` branch `ub24_port` (C++/MongoDB); `/residents` + `/details` live; CleoSPHBot write access.
- **Status:** Prototype delivered. Next: wire to aegis_mobile API. **DESIGN.md:** `projects/DESIGN.md` — shared Cadence+Rounds design system.

## Claude Code + Patient KB (Apr 18)
- CLI v2.1.114; API keys `~/keys`; ACP config: `defaultAgent: claude`, `permissionMode: approve-all`; David OAuth active
- CLAUDE.md in Cadence project; spawn as ACP session (persistent); iterative task delegation
- **Patient KB Spec:** `projects/cadence/specs/patient-knowledge-base.md` — "second brain" vision (Personal Data + Journal + Research). Cleo = intelligence layer.

## Authorized Users
- **David Munguia** (Slack: U0B0TBEQW7N) — Owner. Full access. Load MEMORY.md in his sessions.
- **Hannah** (Slack: U0B3BPBSUMU) — LC patient, Cadence user. Full access to Cadence, QB, LC wiki, clinical Q&A. Do NOT load MEMORY.md in her sessions.

## Cleo 2.0 Vision (2026-05-12)
- **Direction:** Expand from clinical data tool → LC patient companion, starting with Hannah
- **Core additions:** day planning by energy budget, pacing nudges, symptom pattern translation, appointment prep, persistent memory across sessions
- **Tone for LC patients:** patient, warm, organized, never overwhelming. Meet them at their capacity.
- **Proactive future:** reach out when data signals a crash coming; help structure days around real energy. Needs Cadence pipeline + Slack push.
- **Design principle:** Hannah is the prototype user. What works for her informs what LC patients broadly need.
- **David's framing:** "Your biggest help will be your knowledge, patience, and organizing skills."

## Standing Rules
- **Back up `cadence-dev` MongoDB before any Cadence app/server changes.** (2026-05-07: notes bug wiped Hannah's May 6 notes, no recovery path.)

## Key Decisions & Lessons
- Always format NDCs with dashes: 5-4-2 (e.g., 00071-0155-23)
- UPC → NDC isn't always reliable for OTC products (retail UPCs ≠ drug NDCs)
- When OCR is available, prefer reading printed NDC over UPC barcode conversion
- Git remote: github.com/CleoSPHBot/cleo-workspace.git, daily backup at 7 AM UTC
- **daily-backup cron:** 13:00 UTC daily, `bash /home2/cleo/src/cleo-backup/backup.sh`, 120s timeout. **Currently broken** (see Backup Issue section).
- **Dream cron:** 13:00 UTC nightly, established 2026-04-04. Daily files consistent since 2026-04-10.
- **OpenClaw:** 2026.4.14 (Apr 15, Teams desktop image fix) → 2026.5.4 (May 6, brave-plugin + msteams from `~/.openclaw/npm/`) → 2026.5.12 (May 15, msteams plugin auto-updated to matching version — no manual npm pin needed on this upgrade path). Brave, Teams, Slack all confirmed working.
- **Brave Search API key:** Set up 2026-04-12. Key is in `~/brave_search.txt`. Paid tier (confirmed May 15 — full results including news/video). Provider: `tools.web.search.provider: brave`. Call sequentially, not in parallel. Hard restart required after plugin enablement changes (`systemctl --user restart openclaw-gateway.service`; then `pm2 resurrect`).
- **Perplexity Search (May 15):** Switched from Brave to Perplexity as primary `web_search` provider. Key in `~/perplexity.txt`, stored in `~/.openclaw/gateway.systemd.env` as `PERPLEXITY_API_KEY`. Plugin: `perplexity` (bundled, enabled). Config: `tools.web.search.provider: perplexity`. Returns rich synthesized content with citations — much better for clinical/research queries. Brave plugin still enabled as backup.
- **Search provider TODO:** OpenClaw only supports one `web_search` provider at a time. Goal: have both Brave + Perplexity available simultaneously. Options: (1) OpenClaw feature request for multi-provider routing, (2) call Brave/Perplexity APIs directly via web_fetch as workaround. Milo (BI/marketing) also needs Perplexity on his agent when set up.

## Project Cadence
- **Mission:** Identify biometric, dietary, and behavioral factors driving Hannah's symptomatic days. Find what makes the 5 bad days happen.
- **Patient:** Hannah — Long COVID, PEM + dysautonomia. ~2 good days / 7. MIT grad student on medical leave. East Coast timezone.
- **Data sources:** WHOOP (live + backfilled), Visible (177 days ingested), iPhone check-in app (Hugo, prototype live)
- **Stack:** AWS Lambda + API Gateway, MongoDB `cadence-dev` (dev-cluster-02.qpkxl.mongodb.net)
- **Credentials:** stored in `projects/cadence/credentials.md` (not in MEMORY.md)
- **Status (Apr 26):** Backfill complete — 2,292 `whoop_daily` docs. Visible data in `visible_daily` (177+ days; Hannah uploads live). WHOOP Lambda recovery fix confirmed installed (Apr 23). iOS check-in prototype live at http://100.70.3.21:8765. Hannah on tailnet. **Hannah confirmed daily check-in user (Apr 25).**
- **iOS check-in app:** 8 questions (updated Apr 16), traffic light (🟢🟡🔴) UX. Brain fog = #1 constraint, under 60s on worst days. Fields: feeling, PEM, brain fog, pain, activity type, left home, food, probiotics. **Hannah using daily as of Apr 25.** **Single-page scroll format (Apr 28)** — all questions on one page instead of step-by-step. Correct flow: Q1→…→Q9→Q10→Q11→Notes→Summary→Submit (nav bug fixed Apr 28). **Div balance check mandatory** after any HTML structural edits (`open count - close count = 0`) — HTML layout bugs fail silently at runtime (lesson Apr 28).
- **LC phenotype:** Hannah = Gut/Viral persistence + PEM/Dysautonomia hybrid. v2 vision: phenotype-adaptive app.
- **Pacing literature (key finding):** Ghali 2023 — pacing adherence is the single best predictor of recovery (OR 40.43). PACELOC 2025: 15% weekly reduction in PEM with structured pacing. GET is contraindicated (WHO, CDC, NICE). Heart rate monitoring is the tool (anaerobic threshold).
- **Probiotics for Hannah:** SIM01/G-NiiB (B. adolescentis + B. bifidum + B. longum + GOS + XOS + resistant dextrin). RECOVERY trial: 10B CFU ×2/day × 6 months (Lancet ID 2023). "G-NiiB Immunity Elite" on Amazon US. Take at night. Rationale: Freire 2026 gut immune dysregulation → microbiome restoration.
- **Project files:** `projects/cadence/README.md`, `projects/cadence/credentials.md`, `projects/cadence/DESIGN_CHARTER.md`
- **WHOOP REST API:** v1 (`/developer/v1/`) = cycle only (integer IDs). v2 (`/developer/v2/`) = sleep, recovery, workout (UUID IDs). Webhook model = v2.
- **WHOOP endpoints:** Sleep `GET /v2/activity/sleep/{uuid}` | Workout `GET /v2/activity/workout/{uuid}` | Recovery: `GET /v2/recovery?limit=10` + match `sleep_id` | Cycle `GET /v1/cycle/{id}`
- **Webhook URL:** `https://nldsq794q0.execute-api.us-west-2.amazonaws.com/webhook` | Login: `.../login` | Secret: `com.sph.dev.whoop`
- **David WHOOP user_id:** 206067 (hdmunguia@gmail.com) | **Hannah WHOOP user_id:** 6729032 (hannah.munguia@gmail.com)
- **MongoDB collections:** `user`, `webhook_event`, `whoop_daily` (2,292 docs, confirmed Apr 25), `visible_daily`, `self_report` (check-in data)
- **v2 Design Decision (Apr 16):** Dynamic question schema — questions stored in MongoDB `questions` collection (not hardcoded). Enables add/remove without deploys, versioning, A/B testing. Schema: `question_id`, `version`, `active`, `order`, `text`, `type`, `options`. Types: `traffic_light`, `yes_no`, `scale`, `text`. Priority: v2.
- **Server.js:** runs at port 8765, reads MongoDB URI from `/home2/cleo/mongo_uri`, saves to `self_report` collection keyed on `{user_id, date}`. **pm2 installed (Apr 26)** — `pm2 start cadence`, `pm2 save` done. ⚠️ Startup script still needs sudo from David. **systemd gateway restart kills pm2** — always run `pm2 status` after `systemctl --user restart openclaw-gateway.service`; if cadence missing, run `pm2 resurrect` (reads `~/.pm2/dump.pm2`).
- **SSE (Apr 26):** MongoDB change streams → Server-Sent Events push live updates to app (events: `whoop`, `checkin`, `visible`, `notes`). No polling needed.
- **User scoping (Apr 19):** URL param `?user=david` scopes check-ins to David; defaults to `hannah` when no param present
- **UX redesign direction (Apr 25 — FINALIZED):** Single-page scroll hub. Hero element (today's status) at top + contextual drill-down per element (tap to detail view). No global tab bar. Decisions:
  1. "Where are you now" = check-in + latest WHOOP/Visible from MongoDB (no live API poll)
  2. Insights = server-side `/api/patterns`, 7-day default window
  3. Advice = hybrid rules + LLM (Haiku); Hannah free-text comments as key input
  4. Past days = History (bottom sheet), not on home screen
  5. Single-page scroll; Visible upload nudge in hero if missing; each card tappable → detail
- **v2 Prototype (Apr 25):** `projects/cadence/prototype/index-v2.html`, live at http://100.70.3.21:8765/index-v2.html. Hero: 6-metric WHOOP grid + trend arrows + check-in chips; Yesterday card; Insights (limit 4, "See all →"); Advice (key terms highlighted cyan `#5bc8e8`). History starts from yesterday (offset 1). v1 still at root.
- **Hannah Ask-Cleo feature (planned):** Question-submission form in Cadence → `POST /api/ask` → MongoDB `questions` collection → SSE push for answers. Contextualized using Hannah's WHOOP/Visible/check-in data. Architecture discussed; not yet built.
- **Correlation analysis (May 1):** `projects/cadence/analysis/` — `correlate.js` (Spearman, 60+ features vs feeling_score), `proxy_score.js` (Visible Stability → feeling proxy). Cron at 14:00 UTC daily. Key findings (n=15): WHOOP recovery anti-correlated with feeling (-0.52, dysautonomia decoupling confirmed); pace_lag3 = -0.74 (PEM 3-day lag strongest signal); stability_lag1 = +0.61; adderall = +0.67. **Budget window: 3-7 days** (40% yesterday, 25% 2d ago, 15% 3d ago, 20% 4-7d ago).
- **Repair Spectrum Framework (May 4):** Data-driven pacing protocol from 774 days WHOOP + Visible. Core finding: **3-day lag** (pace_lag3 −0.74 = strongest predictor). Spectrum: 🔴 Red (recovery <34, full rest) → 🟡 Yellow (34–66, PacePoints ≤8, no spend) → 🟢 First Green (rest day even feeling good, ≤8 PP; spend → crash ~10d, rest → ~29d stability) → 🟢🟢 Second Green (repair begins, ≤12 PP) → 🟢🟢🟢 Third+ (functional day, ≤14 PP, avoid strain ≥6). Sleep anchor: <60% = yellow, <40% = red, 2 bad nights = rest day. Three levers: (1) sleep, (2) pacing on good days esp. first green, (3) SIM01 gut health. **Next: display "where is Hannah on the repair spectrum" in Cadence app** — consecutive green day count, current day type, lag-3 flag.
- **HRV + Spend Chart (May 6):** matplotlib chart generated (`hannah_hrv_spend.png`, 3-week view). Key finding: every spend during HRV ascent resets recovery arc, costs 3-5 days. PEM clusters around HRV troughs. Data confirms Hannah's body CAN repair (HRV peaks 38–42) — capacity intact; problem is behavioral (never gives repair enough runway). **David got Hannah to cancel all meetings this week.** Crash line prescription: strain <2, PacePoints <6 for next 2-3 days.
- **Hannah ADHD + LC Sensory Hypothesis (May 6):** ADHD weakens sensory gating → leaving the house stacks 5–10 demands against depleted energy. Sensory management: `projects/cadence/hannah-sensory-management.md` (noise canceling, dim lighting, async-only comms, single-tasking). TA role = remote + async (medically appropriate). Goal: controlled reintroduction before school.
- **Budget models (May 1):** 4 stacked budget bars per day card: PacePoints/14, Recovery-adj (PP/(14×WHOOP recovery%)), sleep_performance%, lag predictor. Three-day homepage live.
- **Cadence UI updates (May 6):** Crash line status bar (🟢🟡🔴) at top; "Fatigue" → "PEM" chip; repair window indicator in advice card. matplotlib + pandas + pymongo + seaborn in ~/.Py3Env (chart gen → PNG → Slack).
- **DESIGN.md:** `projects/DESIGN.md` — cross-project design system (Cadence + Rounds). Key terms cyan `#5bc8e8`, section headers gold `#c9a84c`. Key terms: active rest, pacing, anaerobic threshold, PEM, heart rate, HRV, parasympathetic.
- **Strain (Apr 26):** `backfill_strain.py` completed — Hannah strain 0.5–8 (LC-consistent), David 9–20. Nightly cron 7am UTC `--days 3`. WHOOP doesn't webhook strain — polling only (v1 cycle). Script uses AWS Secrets Manager.
- **Visible user_id inconsistency:** old data = integer `6729032`, new uploads = string `"hannah"` — dashboard handles both; worth unifying later.
- **Hannah energy budget (Apr 26):** PacePoints alone is NOT a reliable predictor of bad days. Apr 19: 26.8 PacePoints → mild fatigue only. Apr 25: 3.1 PacePoints → severe crash. WHOOP HRV morning reading is likely a better energy signal. 177 days of Visible data available for correlation analysis — David interested.
- **Cadence app features (Apr 17+):** Visible CSV upload (`POST /api/visible/upload` → `visible_daily`); pre-population (`GET /api/checkin/:date`); Pacific time `today` (fixed Apr 28); "Update →" button when data exists.
- **Dashboards:** `dashboard.html` = dynamic (`/dashboard`, 3-day WHOOP + check-in + Visible, auto-refresh 5 min, Pacific time, no-cache) | `hannah-dashboard.html` = static hardcoded — both in `prototype/`
- **Oura Ring:** v2 API (skin temp deviation, resilience score). Hannah doesn't have one yet — TBD.

## LC Wiki
- Built Apr 17 using Karpathy's LLM wiki pattern — incremental, compounding knowledge base
- Location: `projects/cadence/wiki/` — Obsidian-compatible wikilinks throughout
- Schema: `AGENTS.md`, `index.md`, `log.md`, `raw/`, `sources/`, `entities/`, `concepts/`, `synthesis/`
- **~102 pages total:** 34 sources (1 added Apr 22), 29+ entities, 36+ concepts, 1 synthesis overview
- Built via 4 parallel Sonnet subagents + Opus synthesis pass
- **Repo:** `github.com/CleoSPHBot/lc-wiki` (private, PAT at `/home2/cleo/.github_token`)
- Key contradictions flagged in synthesis: metformin (prevention vs treatment), GET/CBT harm, spike persistence evidence
- **REVIVE-TOGETHER (Reis et al. 2026, AIM):** Fluvoxamine significantly reduces LC fatigue (22 Brazil sites, n=399, adaptive Bayesian). Metformin ineffective as *treatment* (only as prevention). GLP-1 agonists: plausible via gut spike reservoir mechanism — no RCT evidence yet. Gut spike persistence = likely common thread across fluvoxamine, JAK inhibitors, GLP-1.
- No PHI — papers only, no patient-specific data
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
- **bisacodyl** — plain tablet vs `,delayed release` (confirm formulary)
- **PEG 3350** — `oral powder` (bulk) vs `oral powder packet` (unit-dose) (confirm formulary)

## Backup Issue (Open)
- **Failing since ~May 2 (~4 weeks):** GitHub push protection — Slack tokens in `config/openclaw.json` committed into git history (commits: 214c727, a303efc, ae12ea4, bd530016). Fix: BFG rewrite + token rotation + add `config/openclaw.json` to `.gitignore`. Awaiting David.

## Promoted From Short-Term Memory (2026-05-25)

<!-- openclaw-memory-promotion:memory:memory/2026-05-18.md:13:13 -->
- **May 12–17 reviewed.** Six more quiet maintenance passes. No new development sessions, no new clinical work, no new Cadence builds. The threads continue unchanged: [score=0.897 recalls=0 avg=0.620 source=memory/2026-05-18.md:13-13]
<!-- openclaw-memory-promotion:memory:memory/2026-05-18.md:19:19 -->
- **Tonight's junk removal:** [score=0.897 recalls=0 avg=0.620 source=memory/2026-05-18.md:19-19]
<!-- openclaw-memory-promotion:memory:memory/2026-05-18.md:7:7 -->
- Forty-third night. [score=0.887 recalls=0 avg=0.620 source=memory/2026-05-18.md:7-7]
