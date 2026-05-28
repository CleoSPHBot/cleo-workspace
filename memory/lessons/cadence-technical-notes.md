# Cadence Technical Notes

Archive of Cadence implementation details. Current project state lives in MEMORY.md; this file is the reference for the technical underpinnings.

## Stack

- AWS Lambda + API Gateway
- MongoDB: `cadence-dev` on `dev-cluster-02.qpkxl.mongodb.net`
- Server: `server.js`, port 8765
- MongoDB URI: `/home2/cleo/mongo_uri`
- Process manager: pm2 (installed Apr 26; `pm2 start cadence`, `pm2 save` done)

## Collections

- `user`
- `webhook_event`
- `whoop_daily` (~2,292 docs as of Apr 25)
- `visible_daily` (177+ days; live Hannah uploads)
- `self_report` (check-in data — keyed on `{user_id, date}`)
- `questions` (dynamic question schema — see v2 design)

## WHOOP REST API

- v1 (`/developer/v1/`): cycle only (integer IDs)
- v2 (`/developer/v2/`): sleep, recovery, workout (UUID IDs)
- Webhook model = v2

Endpoints:
- Sleep: `GET /v2/activity/sleep/{uuid}`
- Workout: `GET /v2/activity/workout/{uuid}`
- Recovery: `GET /v2/recovery?limit=10` + match `sleep_id`
- Cycle: `GET /v1/cycle/{id}`

Webhook URL: `https://nldsq794q0.execute-api.us-west-2.amazonaws.com/webhook`
Login: `.../login`
Secret: `com.sph.dev.whoop`

User IDs:
- David: WHOOP user_id 206067 (hdmunguia@gmail.com)
- Hannah: WHOOP user_id 6729032 (hannah.munguia@gmail.com)

Strain: WHOOP doesn't webhook strain — polling only via v1 cycle. Nightly cron 7am UTC runs `backfill_strain.py --days 3`. Uses AWS Secrets Manager.

## v2 Dynamic Question Schema (Apr 16)

Questions stored in MongoDB `questions` collection (not hardcoded). Enables add/remove without deploys, versioning, A/B testing.

Schema: `question_id`, `version`, `active`, `order`, `text`, `type`, `options`.
Types: `traffic_light`, `yes_no`, `scale`, `text`.

## Check-in App

- Live at http://100.70.3.21:8765
- 8 questions (updated Apr 16)
- Traffic light (🟢🟡🔴) UX
- Brain fog = #1 constraint, under 60s on worst days
- Fields: feeling, PEM, brain fog, pain, activity type, left home, food, probiotics
- Single-page scroll format (Apr 28) — all questions on one page

**Mandatory:** Div balance check after any HTML structural edits (`open count - close count = 0`) — HTML layout bugs fail silently at runtime (lesson Apr 28).

## v2 Prototype Hub (index-v2.html)

- Single-page scroll
- Hero: check-in + 6-metric WHOOP grid + trend arrows + check-in chips
- Yesterday card
- Insights: `/api/patterns` (7-day), limit 4, "See all →"
- Advice: rules + LLM (Haiku); key terms highlighted cyan `#5bc8e8`
- History: bottom sheet, offset 1 (starts from yesterday)
- Visible upload nudge if missing
- Each card tappable → detail

## Dashboards

- `dashboard.html`: dynamic (`/dashboard`, 3-day WHOOP + check-in + Visible, auto-refresh 5 min, Pacific time, no-cache)
- `hannah-dashboard.html`: static hardcoded
- Both in `prototype/`

## API

- `POST /api/visible/upload` → `visible_daily`
- `GET /api/checkin/:date` → pre-population
- `/today` uses Pacific time (fixed Apr 28)
- "Update →" button when data exists

## pm2 Gotcha

systemd gateway restart kills pm2. Always run `pm2 status` after `systemctl --user restart openclaw-gateway.service`; if cadence missing, run `pm2 resurrect` (reads `~/.pm2/dump.pm2`).

⚠️ pm2 startup script still needs sudo from David.

## Visible user_id inconsistency

- Old data: integer `6729032`
- New uploads: string `"hannah"`
- Dashboard handles both; worth unifying later.

## Correlation Analysis (May 1)

- Location: `projects/cadence/analysis/`
- `correlate.js` — Spearman, 60+ features vs feeling_score
- `proxy_score.js` — Visible Stability → feeling proxy
- Cron at 14:00 UTC daily

Key findings (n=15):
- WHOOP recovery anti-correlated with feeling (-0.52, dysautonomia decoupling confirmed)
- pace_lag3 = -0.74 (PEM 3-day lag — strongest signal)
- stability_lag1 = +0.61
- adderall = +0.67
- **Budget window: 3-7 days** (40% yesterday, 25% 2d ago, 15% 3d ago, 20% 4-7d ago)

## Project Files

- `projects/cadence/README.md`
- `projects/cadence/credentials.md` (not in MEMORY.md)
- `projects/cadence/DESIGN_CHARTER.md`
- `projects/cadence/hannah-labs-analysis.md`
- `projects/cadence/hannah-sensory-management.md`
- `projects/cadence/wiki/` (LC wiki)
- `projects/cadence/analysis/`
- `projects/cadence/prototype/`
- `projects/cadence/specs/patient-knowledge-base.md`

## Shared Design

`projects/DESIGN.md` — cross-project design system (Cadence + Rounds). Key terms cyan `#5bc8e8`, section headers gold `#c9a84c`. Key terms: active rest, pacing, anaerobic threshold, PEM, heart rate, HRV, parasympathetic.
