# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

Cadence is a Long COVID patient-tracking system for **Hannah** (the primary user). It ingests WHOOP biometrics, Visible CSV exports, and daily self-reports into MongoDB, then surfaces them in a dashboard. The goal is to find what predicts Hannah's bad days. See `README.md` for mission and `DESIGN_CHARTER.md` for design principles — **brain fog is a design constraint**, not a UX preference: check-ins must be completable in under 60 seconds, tap-only, and optional fields must never block.

## Running the App

```bash
node server.js          # starts Express on 0.0.0.0:8765
```

- Mongo URI is read from `/home2/cleo/mongo_uri` (plain text file, not env var).
- Database name is **`cadence-dev`** (not `cadence`) — hardcoded in `server.js`.
- `USER_ID = 'hannah'` is hardcoded; there is no auth yet.
- No build, lint, or test tooling is set up. There are no tests.

## Endpoints

| Route | Purpose |
|---|---|
| `GET /` → `prototype/index.html` | Daily check-in UI |
| `GET /dashboard` → `prototype/dashboard.html` | 3-day rollup dashboard |
| `POST /api/checkin` | Upsert self-report by `{user_id, date}` |
| `GET  /api/checkin/status?days=7` | Which recent days have entries |
| `GET  /api/checkin/:date` | Fetch a single day's answers |
| `GET  /api/dashboard` | Aggregated 4-day window: whoop + checkins + visible |
| `POST /api/visible/upload` | Multipart CSV upload, grouped by `observation_date`, upserted into `visible_daily` |

Route order matters: named routes come before `express.static`, and `/api/checkin/status` is declared before `/api/checkin/:date` so the literal path wins.

## MongoDB Collections

- `self_report` — one doc per `{user_id, date}`; upserted from `/api/checkin`.
- `whoop_daily` — WHOOP API ingest; **keyed by numeric `user_id`** (Hannah = `6729032`, David = `206067`), not the string `'hannah'`.
- `visible_daily` — grouped rows from Visible CSV export; keyed by `{user_id: 'hannah', date}`.
- `meals`, `daily_summary` — planned, not yet populated.

Date handling uses **Eastern time** (`America/New_York`) everywhere since Hannah is East Coast and WHOOP/Visible days are aligned to her local day. Use the `toEasternDate(offset)` helper pattern in `server.js` rather than `new Date().toISOString().slice(0,10)` — UTC slicing will drop a day for evening submissions.

## Repository Layout (the parts that aren't self-explanatory)

- `prototype/` — vanilla HTML/CSS/JS (no framework, no build). Served statically with `Cache-Control: no-store` on `.html` so local edits show up on refresh.
- `specs/` — product specs (not implementation).
- `wiki/` — **a separate git repo** (has its own `.git/`) containing the Long COVID research knowledge base. It has its own `AGENTS.md` defining Obsidian-compatible wikilink conventions, page types (source/entity/concept/synthesis), and ingest/query/lint workflows. When working inside `wiki/`, read and follow `wiki/AGENTS.md`; do not apply general repo conventions there. Raw sources in `wiki/raw/` are immutable.
- `credentials.md` — WHOOP OAuth + Mongo config. Keep private; do not commit (the file itself says so but there is no `.gitignore`, so be explicit when staging).

## Conventions

- Single-file server: everything lives in `server.js`. No controllers, routers, or service layers yet — resist adding them until there's a reason.
- Upserts use the `{$set: {...}, $setOnInsert: {submitted_at/imported_at}}` pattern so the first-write timestamp is preserved across re-submits. Follow this for any new collection.
- New check-in questions are currently hardcoded in both `server.js` (the `$set` block) and `prototype/index.html`. The `DESIGN_CHARTER.md` v2 section describes moving these to a `questions` collection — don't build that yet; it's explicitly deferred.

---
name: karpathy-guidelines
description: Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria.
license: MIT
---

# Karpathy Guidelines

Behavioral guidelines to reduce common LLM coding mistakes, derived from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
