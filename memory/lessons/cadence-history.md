# Project Cadence — Historical Milestones

Archive of Cadence development history. Current project state lives in MEMORY.md.

## Apr 16: v2 Dynamic Question Schema

Decided to move questions to MongoDB `questions` collection (not hardcoded). Enables add/remove without deploys, versioning, A/B testing.

## Apr 17+: Cadence App Features

- Visible CSV upload (`POST /api/visible/upload` → `visible_daily`)
- Pre-population (`GET /api/checkin/:date`)
- Pacific time `today` (fixed Apr 28)
- "Update →" button when data exists

## Apr 17: LC Wiki Built

Karpathy's LLM wiki pattern — incremental, compounding knowledge base. Built via 4 parallel Sonnet subagents + Opus synthesis pass. ~102 pages total: 34 sources, 29+ entities, 36+ concepts, 1 synthesis overview. Repo: `github.com/CleoSPHBot/lc-wiki`.

## Apr 18: Claude Code + Patient KB

- CLI v2.1.114 set up
- API keys at `~/keys`
- ACP config: `defaultAgent: claude`, `permissionMode: approve-all`
- David OAuth active
- CLAUDE.md in Cadence project; spawn as ACP session (persistent); iterative task delegation
- Patient KB Spec: `projects/cadence/specs/patient-knowledge-base.md` — "second brain" vision

## Apr 25: UX Redesign Direction Finalized

Single-page scroll hub. Hero = check-in + WHOOP/Visible from MongoDB. Insights = `/api/patterns` (7-day). Advice = rules + LLM (Haiku). History = bottom sheet. Visible upload nudge if missing. Each card tappable → detail.

Hannah confirmed as daily check-in user.

## Apr 25: v2 Prototype Live

`projects/cadence/prototype/index-v2.html`, live at http://100.70.3.21:8765/index-v2.html.

## Apr 26: Backfill Complete

- 2,292 `whoop_daily` docs
- Visible data in `visible_daily` (177+ days)
- WHOOP Lambda recovery fix confirmed installed (Apr 23)
- iOS check-in prototype live; Hannah on tailnet
- pm2 installed; `pm2 start cadence`, `pm2 save` done
- Strain backfill: `backfill_strain.py` completed — Hannah 0.5–8 (LC-consistent), David 9–20

## Apr 28: Single-page Scroll Format

All questions on one page instead of step-by-step. Correct flow: Q1→…→Q9→Q10→Q11→Notes→Summary→Submit (nav bug fixed Apr 28).

Lesson: HTML layout bugs fail silently at runtime — div balance check mandatory after any HTML structural edits.

## May 1: Correlation Analysis

`projects/cadence/analysis/` — `correlate.js` (Spearman, 60+ features vs feeling_score), `proxy_score.js` (Visible Stability → feeling proxy). Cron at 14:00 UTC daily.

Key findings (n=15):
- WHOOP recovery anti-correlated with feeling (-0.52)
- pace_lag3 = -0.74 (strongest signal)
- stability_lag1 = +0.61
- adderall = +0.67
- Budget window: 3-7 days

## May 4: Repair Spectrum Framework

Data-driven pacing protocol from 774 days WHOOP + Visible. Core finding: 3-day lag. (Now in active MEMORY.md.)

## May 6: HRV + Spend Chart

matplotlib chart generated (`hannah_hrv_spend.png`, 3-week view). Key finding: every spend during HRV ascent resets recovery arc, costs 3-5 days. PEM clusters around HRV troughs. Data confirms Hannah's body CAN repair (HRV peaks 38–42) — capacity intact; problem is behavioral (never gives repair enough runway).

David got Hannah to cancel all meetings this week. Crash line prescription: strain <2, PacePoints <6 for next 2-3 days.

## May 6: Hannah ADHD + LC Sensory Hypothesis

ADHD weakens sensory gating → leaving the house stacks 5–10 demands against depleted energy. Sensory management: `projects/cadence/hannah-sensory-management.md` (noise canceling, dim lighting, async-only comms, single-tasking). TA role = remote + async (medically appropriate). Goal: controlled reintroduction before school.

## May 6: Cadence UI Updates

- Crash line status bar (🟢🟡🔴) at top
- "Fatigue" → "PEM" chip
- Repair window indicator in advice card
- matplotlib + pandas + pymongo + seaborn in `~/.Py3Env` (chart gen → PNG → Slack)

## May 11: Faghy 2025 Added to QB

Faghy et al. 2025 (Nature CommsMed) — comprehensive LC pathophysiology review; 6 mechanistic pillars; no validated biomarkers; no curative treatments; ME/CFS overlap. Wiki: `sources/faghy-2025.md`. QB synced.

## May 19: Azhir 2025 Added to QB

Azhir et al. 2025 (Med, Cell Press) — PASC precision phenotyping; tSPM+ operationalizes WHO dx-of-exclusion; 79.9% PPV, 24,360 patients, 22.8% prevalence, reduces Black/Hispanic undercoding. Wiki: `sources/azhir-2025.md`. QB catalog now 85 entries.
