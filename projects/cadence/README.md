# Project Cadence

## Mission
Identify the biometric, dietary, and behavioral factors that contribute to Hannah's symptomatic days, with the goal of finding actionable patterns that reduce her bad days and extend her good ones.

> **In plain terms:** Turn Hannah's wearable and self-report data into answers — why does she have 5 bad days a week, and what can she do about it?

## The Problem
Hannah has Long COVID with PEM (post-exertional malaise) and dysautonomia. She averages 2 good days out of 7. The question: **what factors contribute to the other 5?**

## Patient
- **Name:** Hannah
- **Diagnosis:** Long COVID
- **Primary symptoms:** PEM, dysautonomia
- **Devices:** WHOOP, Visible

## Data Sources

| Source | Access | Notes |
|---|---|---|
| WHOOP | ✅ API (confirmed working) | HRV, resting HR, sleep, recovery score, strain, respiratory rate |
| Visible | ⚠️ No public API | Data export (CSV) or HealthKit bridge; research partnership possible |
| Patient self-report | 📱 iPhone app (to build) | Symptoms, notes, diet |

## iPhone App (Patient Feedback)
- **Tracking:** symptoms, free-text notes, diet
- **Diet approach:** Simple food types + amounts — no complex food databases. Granularity to evolve as we learn what matters.
- **Insights page:** Pattern visualization, correlations
- **Design principle:** Minimal — low cognitive load (cognitive symptoms are part of Hannah's condition)
- **Platform:** iOS (Hugo's domain)

## Cadence Budget (CB)

The **Cadence Budget** is the central behavioral metric — the daily energy ceiling derived from Hannah's own biometric data, used to guide pacing and track compliance.

### Philosophy
Cadence's purpose is to help the patient **moderate their behavior guided by their own data**. CB compliance isn't a grade — it's a mirror. The goal is to build the feedback loop where Hannah sees the connection between her choices and how she feels 24–48 hours later, and gradually internalizes it. Predictive and actionable, not judgmental.

### CB Lifecycle
- **v1 CB:** First approximation using published LC/ME-CFS anaerobic threshold estimates, calibrated to WHOOP recovery score. Best guess before personal history exists.
- **v2 CB:** Refined by backtesting against Hannah's actual crash patterns — what biometric levels on day N predicted PEM on day N+1 or N+2.
- **vN CB:** Continuously updated as data accumulates. The threshold tightens or relaxes based on what her body actually shows.

### Compliance Metric
- **Definition:** Did today's objective biometrics (WHOOP strain, Visible energy) stay below the current CB threshold?
- **Display:** "Within budget" / "Over by ~X%" — not a raw score. Paired with PEM prediction when threshold is exceeded.
- **Triggered self-report:** When biometrics show anomalies (unexpected strain spike, recovery drop), the app surfaces targeted questions — not a fixed daily questionnaire.

### Data Sources for CB
- **WHOOP:** Recovery score (sets daily ceiling), strain (actual exertion), HRV, resting HR
- **Visible:** Energy envelope, HR trend (corroborates or contradicts WHOOP)
- **Self-report:** Adaptive questions triggered by anomalies, not asked daily

---

## Core Hypotheses to Test
1. Low HRV night → bad day next day
2. High WHOOP strain → PEM 24–48h later
3. Poor sleep staging → cognitive symptoms next morning
4. Certain food types / meal timing → symptom flare same/next day
5. Consecutive activity days → crash on day 3

## Key Clinical Context
- PEM has a known **12–48h delay** — yesterday's activity predicts today's crash
- Dysautonomia = autonomic nervous system dysfunction — HRV and orthostatic HR are key markers
- ~29% good day rate gives enough signal contrast for pattern detection
- With 60–90 days of data: ~35 good days, ~85 bad days — workable for analysis

## Related QB Documents
- `long-covid-treatment-guide.pdf` — PLRC + RTHM (pacing, dysautonomia treatment)
- `lindberg-2026-long-covid-cardiovascular-miracle-s.pdf` — CV risk / autonomic patterns
- `Eur Respir J-2026-Cao-13993003.02611-2025-2.pdf` — ERJ clinical guidelines

## Data Infrastructure
- **MongoDB:** Existing Atlas cluster (TBD — get connection details from David)
- **Database:** `cadence` (proposed)
- **Collections:**
  - `whoop_daily` — WHOOP API data, one doc per patient per day
  - `visible_daily` — Visible export data
  - `self_report` — Hannah's app entries, timestamped
  - `meals` — Individual meal logs, timestamped
  - `daily_summary` — Computed rollup: all streams merged + good_day label (this is what insights queries)
- **WHOOP → Mongo pipeline:** Needs to be built (nightly pull from WHOOP API → insert to whoop_daily)
- **Visible → Mongo:** CSV export ingestion or HealthKit bridge

## Status
- [x] Project named: Cadence
- [x] Mission defined
- [x] Patient identified: Hannah
- [x] Data sources mapped
- [x] iPhone app concept defined
- [x] Data model designed
- [x] MongoDB cluster identified (existing Atlas)
- [ ] MongoDB connection details / cluster name
- [x] WHOOP API integration scoped
- [x] Webhook live and receiving events (API Gateway + Lambda)
- [x] OAuth complete — David (206067) + Hannah (6729032) authorized
- [x] First real data in whoop_daily (David's walk, 2026-04-13)
- [ ] WHOOP historical backfill script (Python) — **next up**
- [ ] Hannah sleep/recovery data flowing
- [ ] Visible data access resolved
- [ ] iPhone app spec (Hugo)
- [ ] daily_summary rollup pipeline
- [ ] Analysis pipeline
- [ ] Insights dashboard

## Started
2026-04-12

## Team
- **David** — project lead
- **Cleo** — clinical data, research, analysis
- **Hugo** — iOS app development

## Feature Ideas (backlog)

### Dynamic med list from notes (2026-05-20)
- Parse Hannah's free-text check-in notes using LLM to extract medication/treatment mentions
- Cross-reference against existing `med_log` keys — surface new items not yet in the tracker
- Prompt her to add them to the med list (or auto-add with confirmation)
- Goal: keep the tracker list close to reality without manual maintenance
- Trigger: on each note submission, or periodic batch scan

### Med list curation workflow (2026-05-20)
- When a new med/treatment is detected in notes, don't auto-add blindly
- Pipeline:
  1. Detect mention (LLM extraction from notes)
  2. Research: mechanism, LC/dysautonomia/MCAS relevance, typical dosing
  3. Curate decision: does this belong on the tracker? (skip food/noise, add clinical items)
  4. Add with full metadata: display name, subtitle (dose + purpose), category, clinical keywords
- Goal: med list = curated clinical vocabulary, enabling meaningful correlation
  - e.g., "VNS sessions vs. next-day HRV", "Xolair weeks vs. allergy severity"
- Keywords/tags per item enable downstream pattern analysis without manual mapping
