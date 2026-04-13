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
- [ ] WHOOP API integration scoped + built
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
