# Project Cadence — Design Charter

**Version:** 0.1 (Draft)
**Date:** 2026-04-15
**Authors:** David Munguia, Cleo 🦉

---

## Mission

> Identify the biometric, dietary, and behavioral factors that contribute to Hannah's symptomatic days, with the goal of finding actionable patterns that reduce her bad days and extend her good ones.
>
> *In plain terms: Turn Hannah's wearable and self-report data into answers — why does she have 5 bad days a week, and what can she do about it?*

---

## Core Design Principles

### 1. Brain Fog Is a Design Constraint
The primary user is someone who may be suffering from significant cognitive impairment on any given day. The app must be usable in under 60 seconds on the worst days. Cognitive load is not a UX preference — it is a clinical symptom.

- No typing required for core fields
- Maximum 3 required questions per daily check-in
- All responses are taps, not sliders or text
- Optional fields are truly optional — never blocking

### 2. Minimal First, Expand Later
Start with the smallest data set that can generate meaningful signal. Add tracking fields only when the data justifies it or Hannah requests it. Over-engineering the intake at launch will reduce compliance, and low compliance data is worse than no data.

### 3. Timing Matters as Much as Content
PEM has a 12–48 hour delay. Diet effects may appear same-day or next-day. Sleep quality affects cognition hours later. All entries must be timestamped. Morning and evening check-ins capture different states. Time-of-day is a variable, not metadata.

### 4. Data Should Feel Meaningful to Hannah
If she understands *why* she's tracking something, compliance improves. The dietary inflammation framework (🟢 anti-inflammatory / 🔴 pro-inflammatory) gives her a mental model that connects to her condition. Explain the "why" in onboarding.

### 5. Phenotype-Aware Design
Long COVID is not one disease. The data collected should adapt to the patient's primary phenotype cluster. What matters for a POTS patient is different from what matters for a gut/viral persistence patient. Start with Hannah's phenotype; design for adaptability.

---

## Patient Profile: Hannah

- **Diagnosis:** Long COVID
- **Primary phenotype:** Gut/viral persistence + PEM + dysautonomia
- **Pattern:** ~2 good days / 7
- **Devices:** WHOOP (API connected), Visible (pacing/HR)
- **Key clinical context:**
  - Persistent SARS-CoV-2 Spike protein in gut (supported by Freire 2026 research) likely driving chronic gut immune dysregulation
  - PEM: post-exertional malaise with 12–48h delay — energy envelope management is critical
  - Dysautonomia: autonomic nervous system dysfunction — HRV and orthostatic HR are key biomarkers
  - East Coast (timezone offset from David/development team)

---

## v1 iOS App — Data Model

### Daily Check-in (required, < 60 seconds)

| Field | Type | Options |
|---|---|---|
| How do you feel today? | 3-tap | 😊 Good / 😐 Mixed / 😞 Bad |
| PEM present? | 3-tap | None / Mild / Severe |
| Brain fog? | 3-tap | None / Mild / Severe |
| Notes | Free text | Optional, skip if too tired |

### Diet Log (per meal, optional, ~10 seconds)

**Meal type:** Breakfast / Lunch / Dinner / Snack

**Anti-inflammatory (🟢):**
- Vegetables / Fiber
- Fermented foods (yogurt, kefir, kimchi)
- Omega-3 rich (fish, walnuts, flaxseed)

**Pro-inflammatory / triggers (🔴):**
- Sugar / sweets
- Processed / ultra-processed food
- Alcohol
- Gluten (optional, patient-configurable)

**Neutral / other:**
- Caffeine ☕
- Protein
- Dairy
- Whole grains

*Granularity evolves as we learn what signals matter. Start broad.*

### Activity (optional)
- Stayed within pacing zone today? Yes / No / Mostly
- Free text note (optional)

---

## v1 Data Schema (MongoDB `self_report` collection)

```json
{
  "patient_id": "hannah",
  "timestamp": "2026-04-15T09:15:00-04:00",
  "date": "2026-04-15",
  "check_in_type": "morning",
  "overall_feeling": "bad",
  "pem": "mild",
  "brain_fog": "moderate",
  "notes": "Crashed after short walk yesterday",
  "meals": [
    {
      "meal_type": "breakfast",
      "timestamp": "2026-04-15T08:30:00-04:00",
      "anti_inflammatory": ["vegetables", "fermented"],
      "pro_inflammatory": ["sugar"],
      "other": ["caffeine"]
    }
  ],
  "pacing_zone_observed": true
}
```

---

## Analysis Targets (v1)

The outcome variable is `overall_feeling` (good / mixed / bad). Everything else is a predictor.

**Primary hypotheses to test:**

| Predictor (biometric or self-report) | Outcome | Delay |
|---|---|---|
| Low WHOOP HRV (< threshold) | Bad day next day | 12-24h |
| High WHOOP strain | Severe PEM | 24-48h |
| Poor sleep score | Brain fog next morning | Same/next day |
| Pro-inflammatory diet 🔴 | Symptom flare | Same / next day |
| Pacing zone breach | Severe PEM | 24-48h |
| Consecutive active days | Crash on day 3+ | 48-72h |

---

## v2 Vision — Phenotype-Adaptive App

### Onboarding Classification (~5 min, one time)
Collect enough to classify the patient into a primary LC phenotype:
- Primary symptoms (multi-select)
- Onset timeline and acute COVID severity
- Available devices
- Known triggers

### LC Phenotype Clusters

| Phenotype | Primary Driver | Key Tracking Focus |
|---|---|---|
| **PEM / ME-CFS** | Energy envelope breach | Activity timing, pacing zone compliance, exertion lag |
| **Dysautonomia / POTS** | Autonomic dysfunction | HR on standing, position changes, salt/fluid intake, syncope |
| **Gut / Viral persistence** | Spike protein, microbiome dysbiosis | Dietary inflammation score, GI symptoms, probiotic use |
| **Cognitive / Neurological** | Neuroinflammation | Brain fog severity, cognitive load, sleep architecture |
| **Cardiovascular** | Arrhythmia, HRV dysregulation | Palpitations, chest symptoms, HRV trends, SpO2 |

*Hannah = primarily Gut/Viral persistence + PEM/Dysautonomia hybrid.*

### Adaptive Daily Questions
The daily check-in surface adapts to the patient's phenotype. A POTS patient sees orthostatic symptom questions. A gut-dominant patient sees the dietary inflammation tracker. A cognitive patient sees a brain fog + cognitive load scale. Core questions (overall feeling, PEM, notes) are universal.

### Population-Level Analysis
As more patients onboard, compare within phenotype groups to find what predicts good vs. bad days *per phenotype* — not just globally. This enables personalized insights and eventually clinical recommendations tuned to each patient's underlying biology.

---

## Clinical Evidence Base

Key papers supporting Cadence's design rationale (all indexed in QB):

| Paper | Relevance |
|---|---|
| Freire et al. 2026 | Persistent Spike in gut → immune dysregulation → dietary inflammation hypothesis |
| Ghali et al. 2023 | Pacing adherence OR 40.43 for recovery — strongest predictor found |
| Godfrey et al. 2025 (PACELOC) | Structured pacing reduces PEM episode frequency 15%/week |
| Lindberg et al. 2026 (MIRACLE-S) | Long COVID → 2x cardiovascular risk, arrhythmia HR 3.11 in women |
| Meach et al. 2024 (PaceMe) | Wearable + app pacing = "lifeline" for LC patients; validation data |
| Vink & Vink-Niese 2022/2025 | GET contraindicated for PEM; pacing is evidence-based standard of care |

---

## Open Questions (to resolve with Hannah)

- [ ] Which fields feel useful vs. burdensome to her?
- [ ] Morning check-in, evening, or both?
- [ ] Does she want to track Visible data separately or just WHOOP?
- [ ] Any dietary triggers she's already identified?
- [ ] What would make the insights page actually useful to her?
- [ ] Notification preferences — gentle reminder or none?

---

## Team

| Role | Who |
|---|---|
| Project lead | David Munguia |
| Patient / primary user | Hannah |
| Clinical data & research | Cleo 🦉 |
| iOS development | Hugo 🦊 (when ready) |
