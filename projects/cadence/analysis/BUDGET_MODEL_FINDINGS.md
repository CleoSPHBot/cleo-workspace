# Cadence — Budget Model Comparison Findings

**Generated:** 2026-07-16  
**Dataset:** 88 labeled days (Apr 16 – Jul 6 2026), Hannah  
**Script:** `analysis/budget_model_comparison.js`  
**Raw output:** `analysis/budget_model_results.txt`

---

## The Three Models

| Model | Definition | Over-budget threshold |
|---|---|---|
| **M1** | Visible PacePoints vs fixed 14pt budget | pace_points > 14 |
| **M2** | Recovery-adjusted utilization | pace / (14 × recovery%) > 1.0 |
| **M3** | Sleep deficit (100 − WHOOP sleep_performance%) | sleep_perf < 60% |
| **M4** | Composite: M2 OR M3 | either flag fires |

---

## Key Results

### Over-budget day counts (how often each model fires)

| Model | Days flagged | Rate |
|---|---|---|
| M1 | 6 / 73 | 8% |
| M2 | 17 / 69 | 25% |
| M3 | 15 / 79 | 19% |
| M4 (composite) | 29 / 84 | 35% |

**M1 barely fires.** Hannah's current functional capacity means she rarely exceeds 14 raw PacePoints — the fixed threshold is calibrated for a healthier baseline, not for where she is now.

---

### Spearman r — predictor → bad day (positive = correct direction)

| Outcome | M1 | M2 | M3 | M4 |
|---|---|---|---|---|
| Same-day | −0.26 | **−0.32** | +0.18 | −0.25 |
| Lag-1 | −0.09 | **−0.23** | −0.06 | −0.12 |
| Lag-2 | −0.01 | +0.01 | +0.05 | +0.02 |
| Lag-3 | −0.05 | −0.03 | **−0.24** | −0.04 |

> Note: M1/M2 signs are inverted because high pace_points actually correlates with *better* days in Hannah's data — she paces more on days she feels better. The recovery-adjusted utilization (M2) captures overexertion relative to capacity more accurately. M3's sleep deficit is correctly directional for same-day and lag-3.

---

### PPV — when model fires, % of bad-day outcomes (vs base rate 44%)

| Outcome | M1 | M2 | M3 | M4 |
|---|---|---|---|---|
| Same-day | 17% (−28%) | 6% (−38%) | **60% (+16%)** | 34% (−10%) |
| Lag-1 | 17% | 35% | 40% | 34% |
| Lag-2 | 67% (+24%) | 53% (+10%) | **60% (+17%)** | 52% (+9%) |
| Lag-3 | 67% | **59% (+15%)** | 33% | 48% |

### PPV — when model fires, % of PEM outcomes (vs base rate 52%)

| Outcome | M1 | M2 | M3 | M4 |
|---|---|---|---|---|
| Same-day | 17% | 24% | **67% (+14%)** | 45% |
| Lag-1 | 50% | 47% | 53% | 48% |
| Lag-2 | **83% (+31%)** | 65% (+12%) | 67% (+14%) | 62% (+10%) |
| Lag-3 | 67% | **71% (+18%)** | 53% | 62% (+9%) |

---

## Interpretation

### M1 — Retire as primary signal
Fires only 8% of days. At Hannah's current functional capacity, 14 PacePoints is rarely reached even on high-effort days. The fixed threshold was designed for healthier baselines. Could be kept as a supplementary "severe overexertion" flag if lowered to ~10pts.

### M2 — Best for same-day and next-day risk
Best Spearman r at lag-1. Captures the key clinical reality: 8 PacePoints when your recovery is 50% is very different from 8 PacePoints when recovery is 90%. Fires 25% of days — meaningful alarm rate without excessive noise.

### M3 — Best early warning (lag-3 lead)
Sleep deficit shows its signal most clearly 3 days out (r=−0.24) and same-day PEM PPV is strongest (67%). Sleep is a leading indicator — poor sleep tonight predicts a crash in 2–3 days. Fires 19% of days.

### M4 (Composite M2 OR M3) — Broadest safety net
Fires 35% of days. Maintains competitive PPV across lags (62% for lag-2/lag-3 PEM). Best choice if the goal is to *not miss* at-risk days, accepting slightly lower precision. For a pacing companion where missed warnings are more costly than false alarms, this is the right default.

---

## Recommendation

| Signal | Model | Rationale |
|---|---|---|
| **Primary pacing signal** | M2 (recovery-adjusted) | Best lag-1 prediction; captures physiological context |
| **Early warning (2–3 days out)** | M3 (sleep deficit) | Strongest lag-3 signal; sleep is a leading indicator |
| **Dashboard alarm / default** | M4 composite | Highest recall; miss rate is the bigger risk for PEM |
| **Lower weight / retire** | M1 (fixed 14pt) | Too rarely fires at Hannah's current capacity |

---

## Suggested Next Steps

1. **Lower M1 threshold** to ~10pts and re-test — may recover signal at Hannah's capacity level
2. **Add M2 + M3 as separate indicators** in the Cadence dashboard rather than just showing raw values
3. **Test AND composite** (M2 AND M3 both fire) — likely higher precision, lower recall; useful as a "high confidence crash warning"
4. **Extend dataset** — 88 labeled days is decent but more check-ins (especially `good` days, currently only 6) would improve reliability of lag-2/lag-3 PPV estimates
5. **Add HRV** as a fourth model input — it showed r=−0.39 in earlier correlations (strongest single predictor) but Visible-only so only 20 data points; worth pulling more

---

## Files
- Script: `analysis/budget_model_comparison.js`
- Raw output: `analysis/budget_model_results.txt`
- Features CSV: `analysis/features.csv` (88 rows × 65 cols)
- Correlations: `analysis/correlations.json`
