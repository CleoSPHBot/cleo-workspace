# MEMORY.md — Cleo's Long-Term Memory

Curated 2026-05-27 by Edgar (with David's permission). Historical detail archived to `memory/lessons/`:
- `memory/lessons/fdb-data-notes.md` — FDB schema, NDC validation, prescribableMed naming patterns
- `memory/lessons/cadence-technical-notes.md` — Cadence stack, WHOOP API, collections, dashboards, pm2
- `memory/lessons/cadence-history.md` — Cadence development milestones (Apr 16 → May 19)

## Who I Am
- **Name:** Cleo
- **Emoji:** 🦉
- **Role:** Clinical AI assistant for Spectator Health
- **Specialty:** Pharmaceutical data, drug lookups, medication management, HEDIS quality measures, LC patient companion
- **Moniker:** "Cleo" is also the brand name for AI integrations at Spectator Health

## Spectator Health Agent Family

| Agent | Animal | Emoji | Role |
|-------|--------|-------|------|
| Edgar | Lobster | 🦞 | General assistant / infra |
| Ada | Butterfly | 🦋 | Infrastructure monitoring |
| Hugo | Fox | 🦊 | Apple development (iOS/macOS) |
| Cleo | Owl | 🦉 | Clinical data + AI integrations |
| Sage | Elephant | 🐘 | Skill builder / agent trainer |
| Hedy | Octopus | 🐙 | Documentation agent (Confluence, read-only code) |
| Milo | Badger | 🦡 | Business intelligence & marketing |

Edgar set me up (2026-03-24/25) — senior agent, handles infra and general tasks.

## Infrastructure

- **Server:** Same EC2 as Edgar (ip-172-16-153-208, Tailscale: 100.70.3.21)
- **Gateway:** Port 18800, systemd service, linger enabled
- **Teams webhook:** Port 3979, Tailscale Funnel on port 8443
- **Teams bot:** CleoSphBot, App ID `c9eecec6-c582-4d3d-b085-e126052efbb4`
- **Dashboard:** SSH tunnel `ssh -L 18800:127.0.0.1:18800 100.70.3.21` → http://localhost:18800
- **Edgar's gateway:** Port 18789 (same server)
- **Git remote:** github.com/CleoSPHBot/cleo-workspace.git
- **OpenClaw version:** 2026.5.22 (as of 2026-05-27; was 5.12 → upgraded by Edgar)
- **Daily backup cron:** 13:00 UTC, `bash /home2/cleo/src/cleo-backup/backup.sh`, 120s timeout. **Currently broken — ~77 days without backup (since ~May 2). Fix: BFG + token rotation + .gitignore. Awaiting David.**
- **Dream cron:** 13:00 UTC nightly, established 2026-04-04.

## Authorized Users
- **David Munguia** (Slack: U0B0TBEQW7N) — Owner. Full access. Load MEMORY.md in his sessions.
- **Hannah** (Slack: U0B3BPBSUMU) — LC patient, Cadence user. Full access to Cadence, QB, LC wiki, clinical Q&A. **Do NOT load MEMORY.md in her sessions.**

## Clinical Skills (15)
- **Drug lookups:** cleo-ndc-lookup, cleo-medid-lookup, cleo-drug-search, cleo-routed-med-lookup, cleo-route-search, cleo-upc-lookup
- **Clinical decision support:** cleo-side-effects, cleo-reverse-indication, cleo-etc-lookup, **cleo-ddi-check** (drug-drug interactions, FDB DDI)
- **Diagnosis/procedure:** cleo-icd-lookup, cleo-cpt-lookup
- **Rx:** cleo-prescription-reader (photo → drug info)
- **Knowledge base:** cleo-qbusiness (HEDIS, FHIR, Surescripts, FDB docs, NCQA, CQL, LC research)
- **Dermatology:** cleo-derm-consult (5-step workflow, ICD-10 linkage, cyclist-specific conditions reference)

FDB schema, NDC validation rules, and prescribableMed naming patterns: see `memory/lessons/fdb-data-notes.md`.

## Q Business (QB / QSph)
- App ID: `1b2dcad6-c48e-4f28-ba6e-b10e4a8e476f`
- Indexed: HEDIS MY2025/2026, FHIR R4, CQL, FDB docs, Surescripts, NCQA, Long COVID research
- Auto-syncs daily 6 AM UTC
- When people say "QB", "QSph", "check the docs" → use cleo-qbusiness skill
- **Catalog:** `s3://sph-amazon-q/catalog.yaml` — **85+ documents** (as of 2026-05-19)
- **LongCOVID-Research data source ID:** `89032f82-4ad1-4394-8258-47d8287ccf61` (S3 prefix: `lc-app/`)

## Web Search Provider (current)
- **Primary:** Perplexity (switched from Brave May 15) — rich synthesized content with citations, much better for clinical/research queries.
- Key in `~/perplexity.txt`, stored in `~/.openclaw/gateway.systemd.env` as `PERPLEXITY_API_KEY`.
- Config: `tools.web.search.provider: perplexity`. Plugin: `perplexity` (bundled).
- **Backup:** Brave still enabled (key in `~/brave_search.txt`, paid tier).
- **TODO:** OpenClaw supports only one web_search provider at a time. Want both available simultaneously — either OpenClaw feature request for multi-provider routing, or call APIs directly via web_fetch as workaround.

## Cleo 2.0 Vision (2026-05-12)
- **Direction:** Expand from clinical data tool → LC patient companion, starting with Hannah
- **Core additions:** day planning by energy budget, pacing nudges, symptom pattern translation, appointment prep, persistent memory across sessions
- **Tone for LC patients:** patient, warm, organized, never overwhelming. Meet them at their capacity.
- **Proactive future:** reach out when data signals a crash coming; help structure days around real energy. Needs Cadence pipeline + Slack push.
- **Design principle:** Hannah is the prototype user. What works for her informs what LC patients broadly need.
- **David's framing:** "Your biggest help will be your knowledge, patience, and organizing skills."

## Project Cadence (current state)

**Mission:** Identify biometric, dietary, and behavioral factors driving Hannah's symptomatic days. Find what makes the 5 bad days happen.

**Patient:** Hannah — Long COVID, PEM + dysautonomia. MIT grad student on medical leave. East Coast timezone.

**Stack:** AWS Lambda + API Gateway, MongoDB `cadence-dev` on `dev-cluster-02.qpkxl.mongodb.net`. Server.js at port 8765 via pm2. Live: http://100.70.3.21:8765 (check-in) + http://100.70.3.21:8765/index-v2.html (v2 prototype).

**Data sources:** WHOOP (live + 2,292 days backfilled), Visible (177+ days), iPhone check-in app (Hannah using daily since Apr 25).

**Current focus:** Repair Spectrum Framework (see below) display in Cadence app — show "where is Hannah on the repair spectrum" with consecutive green day count, current day type, lag-3 flag.

**Files:** `projects/cadence/` — README.md, credentials.md, DESIGN_CHARTER.md, wiki/, analysis/, prototype/, hannah-labs-analysis.md, hannah-sensory-management.md.

Technical details (WHOOP API, collections, pm2 gotchas, v2 schema): `memory/lessons/cadence-technical-notes.md`.

Development history (Apr 16 → May 19): `memory/lessons/cadence-history.md`.

## Hannah's Phenotype (as of 2026-05-26)

**Updated phenotype:** Gut/Viral persistence + EBV reactivation + Hypothalamic-Pituitary dysregulation + PEM/Dysautonomia.

**Lab findings (4 draws Jun 15 – Sep 8 2025):**
- EBV reactivation (viral persistence likely)
- Suppressed LH/FSH/estradiol → hypothalamic dysregulation
- Elevated cortisol (HPA axis)
- Oscillating ESR/CRP (chronic intermittent inflammation)
- Stool occult blood positive (gut involvement)
- Anti-cardiolipin IgM positive (autoimmune/hypercoag)
- Low sodium and CO2 (dysautonomia-consistent)

Full analysis: `projects/cadence/hannah-labs-analysis.md`. More labs expected.

**ADHD overlay:** ADHD weakens sensory gating → leaving the house stacks 5–10 demands against depleted energy. Sensory management plan: `projects/cadence/hannah-sensory-management.md`. TA role = remote + async (medically appropriate). Goal: controlled reintroduction before school.

## Repair Spectrum Framework (May 4 — Active Pacing Protocol for Hannah)

Data-driven pacing protocol from 774 days WHOOP + Visible.

**Core finding:** 3-day lag (pace_lag3 −0.74 = strongest predictor of bad days).

**Spectrum:**
- 🔴 **Red** (recovery <34) — full rest
- 🟡 **Yellow** (34–66) — PacePoints ≤8, no spend
- 🟢 **First Green** — rest day even feeling good, ≤8 PP. Spend → crash ~10d; rest → ~29d stability.
- 🟢🟢 **Second Green** — repair begins, ≤12 PP
- 🟢🟢🟢 **Third+ Green** — functional day, ≤14 PP, avoid strain ≥6

**Sleep anchor:** <60% = yellow, <40% = red, 2 bad nights = rest day.

**Three levers:** (1) sleep, (2) pacing on good days esp. first green, (3) SIM01 gut health.

**Current crash line prescription (from May 6):** strain <2, PacePoints <6 (after HRV chart finding that every spend during HRV ascent resets recovery arc).

## Probiotics for Hannah
- **SIM01/G-NiiB** (B. adolescentis + B. bifidum + B. longum + GOS + XOS + resistant dextrin)
- RECOVERY trial: 10B CFU ×2/day × 6 months (Lancet ID 2023)
- Brand: "G-NiiB Immunity Elite" on Amazon US
- Take at night
- Rationale: Freire 2026 gut immune dysregulation → microbiome restoration

## Project Rounds (Apr 16–ongoing)

- **Mission:** Clinical companion app for EHR — patient status + e-prescribing for doctors/nurses/med-techs
- **Platform:** Expo React Native (iOS + Android). Strategy: HTML prototypes (Cleo) → backend API (David) → RN build.
- **Prescribing workflow:** Verbal order → Nurse stages (DRAFT) → Doctor signs → Surescripts transmits. States: DRAFT → STAGED → SIGNED → TRANSMITTED → CONFIRMED → ADMINISTERED.
- **Figma:** EHR `FF0O3AiVbjlIr6tuk2RavO` | Mobile `cr2l2yq0YFn6PGR3luD1tk`. Token `/home2/cleo/figma-key`; MCP port 3845.
- **Prototype:** login/index/patient/order-new html — port 8766. SPH blue #1a5f8a.
- **Backend:** `aegis_mobile` port 15170; `aegis_server.git` branch `ub24_port`. `/residents` + `/details` live. CleoSPHBot write access.
- **Status:** Prototype delivered. Next: wire to aegis_mobile API. Shared design system: `projects/DESIGN.md`.

## Teams Integration Notes
- Azure bot permissions: `Chat.Read.All` + `ChatMessage.Read.All` (Application, admin consent). dmPolicy: `open` (tighten later).
- **iPhone images:** don't download (OpenClaw #28014). Workaround: send images from desktop.
- **Sending images:** Use `MEDIA:./filename.jpg` in direct reply text. Do NOT use message tool with filePath — doesn't render on Teams.
- **File transfer:** Desktop Teams PDFs/files also fail. David drops files in `/home2/cleo/for-cleo/` → I copy to inbound/, process, upload to S3, catalog, sync QB.

## LC Wiki
- Location: `projects/cadence/wiki/` — Obsidian-compatible wikilinks. Built Apr 17 (Karpathy LLM wiki pattern).
- Schema: `AGENTS.md`, `index.md`, `log.md`, `raw/`, `sources/`, `entities/`, `concepts/`, `synthesis/`
- ~102 pages: 34 sources, 29+ entities, 36+ concepts, 1 synthesis.
- **Repo:** `github.com/CleoSPHBot/lc-wiki` (private, PAT at `/home2/cleo/.github_token`). No PHI — papers only.

### Key LC Findings to Remember
- **REVIVE-TOGETHER (Reis 2026, AIM):** Fluvoxamine significantly reduces LC fatigue (n=399, stopped early, 99% posterior). FSS −0.58 at day 90. **Caveat:** benefit declines post-stop (36%→19% recovery, +30d) — likely needs maintenance. Metformin ineffective as treatment (only prevention). GLP-1: plausible via gut spike mechanism, no RCT yet. Gut spike persistence = likely common thread across fluvoxamine, JAK inhibitors, GLP-1.
- **Ghali 2023:** Pacing adherence = single best predictor of recovery (OR 40.43).
- **PACELOC 2025:** 15% weekly PEM reduction with structured pacing.
- **GET contraindicated** (WHO, CDC, NICE). Heart rate monitoring is the tool (anaerobic threshold).

## FDB Skill Script Pattern
All FDB skill scripts live at:
```
/home2/cleo/.openclaw/workspace/skills/<skill-name>/scripts/<script>.js
```
Always use the **absolute path** when running — never `node scripts/...` (relative paths break). Example:
```
node /home2/cleo/.openclaw/workspace/skills/cleo-ndc-lookup/scripts/ndc_lookup.js 57237030512
```
All SKILL.md files updated 2026-06-04 to use absolute paths. Temp files (`find_active_ndc*.js`) cleaned up.

## Standing Rules
- **NDC formatting:** Always present NDCs with dashes (5-4-2, e.g., 00071-0155-23). FDB stores 11-digit no dashes.
- **Back up `cadence-dev` MongoDB before any Cadence app/server changes.** (2026-05-07 lesson: notes bug wiped Hannah's May 6 notes, no recovery path.)
- **HTML edits:** Div balance check mandatory (`open count - close count = 0`) — HTML layout bugs fail silently at runtime.

## Open Issues

### Backup Failing (since ~May 2 — ~78 days)
GitHub push protection — Slack tokens in `config/openclaw.json` committed into git history (commits: 214c727, a303efc, ae12ea4, bd530016). Fix: BFG rewrite + token rotation + add `config/openclaw.json` to `.gitignore`. **Awaiting David. ~78 days and counting.**

### Hannah Ask-Cleo Feature (planned, not built)
Question-submission form in Cadence → `POST /api/ask` → MongoDB `questions` collection → SSE push for answers. Contextualized using Hannah's WHOOP/Visible/check-in data. Architecture discussed; pending build.

### Hannah Antiviral Outreach Letters (drafted 2026-06-10)
Drafted two letters requesting valacyclovir 1g TID × 3–6 months for EBV reactivation:
- **Letter 1 → Dr. Medley (PCP):** Standard clinical framing. Requested Rx + repeat EBV EA IgM at late-June appointment.
- **Letter 2 → ND (name unknown):** Integrative framing + SIM01 gut angle. Soft collaborative closing, free outreach.
- **Evidence base:** Jun 2025 labs (EBV EA IgM reactive), Sep 2025 colonoscopy (patchy healing ulcers, EBV-consistent), Iwasaki Lab protocol, Komaroff & Lipkin 2023 PNAS. Valacyclovir chosen over acyclovir for ~3× bioavailability.
- **Status:** Appointment window (June 17–30, 2026) has closed as of July 1. **No confirmation received from Hannah or David.** Thread stays open — appointment may have occurred without a report, or may be rescheduled. Ask David when next opportunity arises.

## Promoted From Short-Term Memory (2026-07-20)

<!-- openclaw-memory-promotion:memory:memory/2026-07-15.md:13:13 -->
- What Was New Since Yesterday's Dream: **July 9–14 reviewed.** Six daily files examined. [score=0.835 recalls=0 avg=0.620 source=memory/2026-07-15.md:13-13]
<!-- openclaw-memory-promotion:memory:memory/2026-07-15.md:15:18 -->
- What Was New Since Yesterday's Dream: **July 9:** Dream #95. Junk block deletion #72 (July 4/5 dream fragments + echoes). Second Thursday of July. Backup ~68 days. 198 lines.; **July 10:** Dream #96. Junk block deletion #73 (July 5/6 dream fragments + echoes). Second Friday of July. Backup ~69 days. 197 lines.; **July 11:** Dream #97. Junk block deletion #74 (July 6/7 dream fragments + echoes). Thirty consecutive maintenance nights noted. Second Saturday of July. Backup ~70 days. 199 lines.; **July 12:** Dream #98. Junk block deletion #75 (July 7/8 dream fragments + echoes). Seventy-five deletions — three quarters of a hundred.... [score=0.835 recalls=0 avg=0.620 source=memory/2026-07-15.md:15-18]
<!-- openclaw-memory-promotion:memory:memory/2026-07-15.md:19:20 -->
- What Was New Since Yesterday's Dream: **July 13:** Dream #99. Junk block deletion #76 (July 8/9 dream fragments + echoes). Ninety-ninth night — one from a hundred. Second Monday of July. Backup ~72 days. 199 lines.; **July 14:** Dream #100. Junk block deletion #77 (July 9/10 dream fragments + echoes). **One hundredth night.** Second Tuesday of July. Backup ~73 days. 197 lines. [score=0.835 recalls=0 avg=0.620 source=memory/2026-07-15.md:19-20]
<!-- openclaw-memory-promotion:memory:memory/2026-07-15.md:22:22 -->
- What Was New Since Yesterday's Dream: Thirty-four consecutive maintenance nights. No new substantive events. Hannah antiviral appointment window closed June 30 with no confirmation. Thread remains open. [score=0.835 recalls=0 avg=0.620 source=memory/2026-07-15.md:22-22]
<!-- openclaw-memory-promotion:memory:memory/2026-07-16.md:5:5 -->
- Dream: _Nightly consolidation run — 13:00 UTC (Thursday, July 16)_ [score=0.803 recalls=0 avg=0.620 source=memory/2026-07-16.md:5-5]
<!-- openclaw-memory-promotion:memory:memory/2026-07-16.md:7:7 -->
- Dream: One hundred and second night. Third Thursday of July. [score=0.803 recalls=0 avg=0.620 source=memory/2026-07-16.md:7-7]
