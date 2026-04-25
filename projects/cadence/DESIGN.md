# DESIGN.md — Cadence
**Version:** 0.1 (Phase 1 — living document)
**Started:** 2026-04-24
**Authors:** David Munguia, Cleo 🦉
**Status:** Active — decisions logged as made; to be ironed into full spec in Phase 2

---

## Purpose

This file documents design decisions made during prototyping — what was chosen, why, and what's still open. It serves as both a design spec and a decision log. By Phase 2 it will be complete enough for Hugo (iOS) or any AI coding tool to use as a source of truth.

---

## Design Methodology

We use an iterative HTML-first approach:

- **Phase 1 — HTML prototype:** Nail content, flow, and interaction before any native constraints. Fast, cheap, reversible. Decisions get logged here as they're made.
- **Phase 2 — Design.md ironed:** Once flow is validated, the spec is complete — colors, type, components, patterns. DESIGN.md becomes the handoff doc.
- **Phase 3 — Native build:** Hugo (iOS) or Claude Code builds from a clear spec. Minimal guessing.

---

## Product Vision

Cadence is a self-management tool for Hannah — not a caregiver dashboard, not a monitoring system. She uses it to understand her own patterns. Tools to help her manage herself, like Visible does for pacing.

**Decision (2026-04-24):** Hannah and David see the same view. There is no caregiver/patient split in the UI.

---

## Personas

### Primary user: Hannah
- Long COVID — gut/viral persistence + PEM + dysautonomia
- ~2 good days / 7
- Brain fog is a real constraint — app must work in under 60 seconds on worst days
- MIT grad student, technically literate, East Coast timezone
- Devices: WHOOP, Visible

### Secondary user: David
- Founder/developer — uses the same app to monitor progress and iterate
- PST timezone

---

## Color System

### Current palette (dark theme — Cadence app)

| Token | Value | Usage |
|---|---|---|
| `bg-base` | `#0f1923` | Page background |
| `bg-card` | `#1e2d3d` | Card/option backgrounds |
| `bg-card-alt` | `#131f2e` | Dashboard day cards |
| `accent-gold` | `#c9a84c` | Primary accent — brand, CTAs, labels |
| `accent-gold-light` | `#e8c96a` | CTA gradient end |
| `text-primary` | `#f0f4f8` | Body text |
| `text-muted` | `#7a9ab8` | Secondary text, labels |
| `text-dim` | `#5a7a98` | Tertiary, disabled |
| `border-subtle` | `#1e2d3d` | Card borders |
| `status-green` | `#4caf7d` | Good / none / complete |
| `status-yellow` | `#f0c040` | Mixed / mild / caution |
| `status-orange` | `#f2994a` | Moderate |
| `status-red` | `#e05a5a` | Bad / severe / alert |

**Decision rationale (2026-04-15):** Dark theme chosen for accessibility — on bad symptom days, bright screens are harder to tolerate. The gold accent gives warmth without clinical coldness.

**✅ Decided (2026-04-24):** Hannah confirmed she prefers the **dark theme**. No migration to light theme. Dark stays.

### Traffic light language
Used throughout for symptom severity. Consistent mapping:
- 🟢 Green = good / none / clean / rested
- 🟡 Yellow = mixed / mild / caution
- 🔴 Red = bad / severe / inflammatory / demanding

**Decision rationale:** Aligns with Hannah's existing use of Visible (which uses a similar traffic light framework). Reduces cognitive load — she already speaks this language.

---

## Typography

Using system fonts: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

**Decision rationale:** System fonts render crisply on iOS (target platform), require no loading, and look native. No custom font load = faster perceived performance.

| Scale | Size | Weight | Usage |
|---|---|---|---|
| Display | 24–26px | 700 | Screen titles, done states |
| Title | 20–22px | 700 | Question text, section headers |
| Body | 15–17px | 400–600 | Option labels, card content |
| Caption | 11–13px | 600 | Section labels (uppercase), metadata |
| Micro | 10–12px | 600 | Metric labels, pills |

---

## Interaction Patterns

### Traffic light options
Large tap targets (full-width cards, min 52px tall). Icon + label + sub-label. Selected state: colored border + tinted background. Active state: `scale(0.97)` on tap.

**Decision rationale:** Large targets for PEM/brain fog days. Visual feedback must be immediate and unambiguous.

### Navigation
- Back button: square icon button (52×52px), left of primary CTA
- Primary CTA: full-width gradient button, gold
- Skip: ghost button (outline only, muted color)
- Progress: thin bar at top of screen (not step numbers — less anxiety-inducing)

### Progress bar
3px height, gold gradient, animated width. Shows position in questionnaire flow without showing a countdown. No "Question X of 8" anxiety on bad days — though question number is still shown in smaller text above the question.

---

## Screen Inventory

### Current screens (Phase 1 prototype)

| Screen | File | Status |
|---|---|---|
| Home / hub | `index.html` | Live — flow refinement pending |
| Q1–Q8 + notes + summary | `index.html` | Live |
| Dashboard (3-day view) | `dashboard.html` | Live — dynamic, pulls from MongoDB |
| Hannah dashboard | `hannah-dashboard.html` | Live — static, manually updated |

### Planned screens (Phase 1 — not yet built)

| Screen | Description | Status |
|---|---|---|
| Post check-in stats | Quick WHOOP + check-in summary after submission | **Pending design decisions** |
| "My Day" | Home hub: where are you now, yesterday, insights, advice | **Pending design decisions** |

---

## Navigation Model

**Current:** Single-page with JavaScript screen transitions (no URL routing).

**Open (2026-04-24):** Tab bar vs. single-page scroll is under discussion. WHOOP uses Overview / Sleep / Recovery / Strain tabs. David is thinking through whether Cadence needs this or stays single-page. Decision pending.

---

## App Flow

### Check-in flow (current)
Home screen → Q1 → Q2 → … → Q8 → Notes (optional) → Summary → Submit → Done → Home

### Auto-redirect logic (decided 2026-04-24, not yet implemented)
- **No data for today** → bounce directly to Q1 on app open (like WHOOP)
- **Partial data** → stay on home screen; show "continue" / "finish" prompt
- **Complete** → home screen with check-in marked done

**Decision rationale:** Mirrors WHOOP's behavior, which David found effective. Ensures data capture on days when Hannah might forget to open the questionnaire intentionally.

### Home screen — new hub vision (decided 2026-04-24, not yet built)
Replace the current "list of days" home with a personal health briefing:
1. **Where are you now** — today's check-in state
2. **Where were you yesterday** — quick summary
3. **Insights** (not "Trends" — David, 2026-04-24) — patterns surfaced automatically
4. **Advice** — actionable suggestion from the app

**Open questions (to resolve before building):**
- "Where are you now" — check-in data only, or include real-time WHOOP metrics?
- Insights — server-side via `/api/patterns`? Time window (7 days? 14 days?)?
- Advice — static rules-based, or LLM-generated personalized insight?
- Do "fill in past days" rows stay on home, or move to a history tab?
- Single-page scroll or tab bar?

---

## Component Library

### Cards
- Border radius: 16–20px
- Padding: 18–24px
- Background: `bg-card`
- Border: 1.5px solid (transparent or `bg-card`)
- Highlight border: `accent-gold` (selected/active state)

### Pills
- Border radius: 8px
- Padding: 6px 10px
- Font size: 12px
- Background: `bg-base` (on card surfaces)

### Metric cells
- Border radius: 10px
- Background: `bg-base`
- Label: uppercase, 10px, `text-dim`
- Value: 20px, bold, `text-primary`
- Unit: 11px, `text-muted`

### Status badges
- Border radius: 20px
- Font: 11px, 600
- Background/color pair from status color scale

---

## Data & Backend

- **Server:** Node.js `server.js`, port 8765, on cleo server (172.16.128.101)
- **Database:** MongoDB `cadence-dev` cluster, `self_report` collection
- **WHOOP:** Webhook → Lambda → MongoDB `whoop_daily`
- **Visible:** CSV upload → `/api/visible/upload` → `visible_daily`
- **Timezone:** All date logic uses Eastern time (Hannah's timezone), server-authoritative

**⚠️ Known issue:** `server.js` is not daemonized — needs pm2 or systemd.

---

## Open Decisions Log

| Decision | Status | Notes |
|---|---|---|
| Dark vs. light theme | ✅ Dark confirmed | Hannah prefers dark (2026-04-24) |
| Home screen hub design | ⏳ Pending — 5 open questions | See App Flow above |
| Auto-redirect (no data → Q1) | ✅ Decided | Not yet implemented |
| Tab bar vs. single-page | ⏳ Pending | David thinking it through |
| Insights time window | ⏳ Pending | 7 days? 14 days? |
| Advice: rules-based vs. LLM | ⏳ Pending | Long-term direction unclear |
| Post check-in stats screen | ⏳ Pending | Show WHOOP metrics after submit? |
| "Fill in past days" UX | ⏳ Pending | Stay on home, or move to history tab? |

---

## Shared Design Language (SPH)

Cadence and Rounds (EHR mobile app) are separate products but share a parent brand — Spectator Health. A shared `DESIGN.md` at the workspace root is planned to capture cross-product brand constants (logo, color brand values, type, voice). This file will reference that when it exists.

**Status:** Not yet started. Will begin after Hannah's color feedback and Cadence flow decisions are settled.
