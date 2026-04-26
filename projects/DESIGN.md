# DESIGN.md — Spectator Health Design System

Shared design principles, color palette, component patterns, and interaction conventions
for Cadence and Rounds. Single source of truth — update here, not scattered across READMEs.

---

## Color Palette

| Role | Hex | Usage |
|------|-----|-------|
| Background | `#0f1923` | App body, dark base |
| Surface | `#131f2e` | Cards (secondary) |
| Surface raised | `#1e2d3d` | Cards (elevated), inputs, chips |
| Border | `#2a3d54` | Subtle dividers |
| **Gold** | `#c9a84c` | Section labels, primary actions, logo accent |
| Gold light | `#e8c96a` | Gradient highlight on gold buttons |
| **Cyan** | `#5bc8e8` | Clinical key terms in advice/insight text |
| Text primary | `#f0f4f8` | Main content |
| Text secondary | `#b0c8e0` | Supporting content |
| Text muted | `#7a9ab8` | Labels, metadata |
| Text dim | `#5a7a98` | Inactive, placeholders |
| Text inactive | `#3a5a78` | Empty states |

### Severity Colors

| Level | Hex | Usage |
|-------|-----|-------|
| Good / Green | `#4caf7d` | Positive values, no symptoms, done states |
| Warning / Yellow | `#f0c040` | Mild symptoms, caution, partial states |
| Critical / Red | `#e05a5a` | Severe symptoms, crashes, alerts |

### WHOOP Recovery Color Thresholds
- ≥ 67% → Green `#4caf7d`
- 34–66% → Yellow `#f0c040`
- < 34% → Red `#e05a5a`

---

## Typography

- **Font stack:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **Section labels:** 11px, 700 weight, 1.5px letter-spacing, uppercase, gold `#c9a84c`
- **Card titles / names:** 15–20px, 700 weight, text primary
- **Body / advice text:** 12–14px, text secondary `#7a9ab8`, line-height 1.5
- **Metric values:** 18–22px, 700 weight
- **Metric units:** 10–11px, text muted
- **Status pills:** 12px, 700 weight, padded badge style

---

## Key Terms (Clinical Highlighting)

Clinical terms in advice and insight text are highlighted in **cyan `#5bc8e8`**, bold.
This distinguishes them from section header gold and makes actionable language scannable.

**Current term list:**
- active rest
- pacing
- anaerobic threshold
- PEM
- heart rate
- HRV
- parasympathetic

> Add terms here as the advice engine grows. Keep the list focused on terms a patient
> might not immediately recognize or that carry specific clinical weight.

---

## Component Patterns

### Tappable Cards
- `border-radius: 20px` (primary), `18px` (secondary)
- `transform: scale(0.985)` on `:active` for tactile feedback
- Chevron `›` at right edge for drill-down cards
- `-webkit-tap-highlight-color: transparent` always

### Status Pills
```
done:    background rgba(76,175,125,0.15) | color #4caf7d
partial: background rgba(240,192,64,0.12) | color #f0c040
empty:   background rgba(201,168,76,0.12) | color #c9a84c
```

### Check-in Chips (compact)
- Background `#0f192380`, `border-radius: 8px`, `padding: 5px 9px`
- Label: 9px, uppercase, muted | Value: 11px, bold, severity-colored

### Insight / Advice Rows
- Icon (20px) + title (14px bold, severity-colored) + text (12px muted)
- Separated by `border-bottom: 1px solid #1e2d3d`

### Buttons
| Type | Style |
|------|-------|
| Primary | Gold gradient `#c9a84c → #e8c96a`, dark text, `border-radius: 12–16px` |
| Secondary / Edit | Transparent bg, gold border `#c9a84c55`, gold text |
| Destructive / Continue | Transparent bg, yellow border `#f0c040`, yellow text |
| Back | `#1e2d3d` bg, muted text, square-ish `border-radius: 14px` |

---

## Interaction Conventions

### Home Screen (Hub Model)
- **Single-page scroll** — no tab bar
- Each section has a label (gold uppercase) + tappable card
- Cards navigate to detail screens via tap (not tabs)
- Overflow items (>4) get a "See all X →" link, never visible by default

### Auto-redirect Rules (Cadence)
- No data today → redirect straight to check-in
- Partial data → stay on home, show "Finish check-in →" prompt
- Complete data → home screen, show "✏️ Update check-in"

### Detail Navigation
- Back button always top-left: `← Back` in muted text, no border
- Detail screens are full-page replacements, not modals

### Visible Data Nudge
- Shown inside the hero card when no Visible data uploaded for today
- Appears as a secondary action below the primary CTA button
- Disappears after successful upload without page reload

### Cognitive Load Principle
Design for bad brain fog days. Every interaction should be completable in under 60 seconds.
- Prefer large tap targets (min 48px height)
- Limit choices per screen (≤3 options for check-in questions)
- No pagination — scroll is always preferable to "next page"
- Critical info first, details behind a tap

---

## Projects Using This System

| Project | Description |
|---------|-------------|
| Cadence | Long COVID symptom + biometric tracking (Hannah) |
| Rounds | Clinical companion app for EHR (LTC / SNF) |

---

*Last updated: 2026-04-25*
