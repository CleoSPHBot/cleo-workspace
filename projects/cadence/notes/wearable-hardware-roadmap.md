# Wearable Hardware Roadmap — Future Exploration Notes

_Created: 2026-05-11 | Source: PatSnap Multimodal Biosensor Landscape 2026 + Cleo analysis_

This file captures hardware directions worth watching for Cadence's long-term data stack. The current WHOOP + Visible + check-in stack is the right call for now — but the field is moving fast and several developments could materially expand what we can track for Hannah (and future Cadence users).

---

## 🔴 The Biochemical Gap — Top Priority to Watch

Our current stack is entirely **optical + self-report**. We track:
- Heart rate, HRV, SpO₂, skin temp (WHOOP)
- Activity stability, pacing (Visible)
- Subjective: fatigue, PEM, brain fog, pain (check-ins)

What we **cannot** track continuously today — but that the literature says matters most for LC:

| Biomarker | Why It Matters for LC | Current State |
|-----------|----------------------|---------------|
| **Cortisol** | HPA axis dysregulation; stress + immune interplay; morning cortisol awakening response tied to autonomic function | Sweat patches in research phase; no consumer product yet |
| **Lactate** | Metabolic impairment; anaerobic threshold detection = direct PEM trigger predictor; more precise than HR-based thresholds | German Sport University Cologne 2020 dual-analyte patch; close to clinical grade |
| **IL-6 / inflammatory cytokines** | Faghy 2025: dysregulated 7–14 months; Guardo 2026: candidate ML feature | Not wearable-accessible; currently lab-only |
| **Glucose / ketones** | Metabolic context; energy availability; some LC patients show dysglycemia | CGMs (Dexcom, Abbott Libre) consumer-available now; not LC-specific |

**Timeline:** Cortisol + lactate sweat patches likely consumer-grade in 3–5 years. IL-6/cytokines: longer, possibly 5–10 years or microneedle-based.

---

## 🟡 Devices Worth Watching

### Sweat Patch Platforms (Cluster 1 - Electrochemical)
- **Epicore Biosystems** — continuous sweat analytics platform; glucose, lactate, electrolytes; partnered with sports/military
- **Halo Wearables** — early-stage sweat cortisol
- **Gatorade GX Sweat Patch** — consumer sweat electrolytes (Na⁺, K⁺); narrow but real
- Watch for: dual-analyte (glucose + lactate) patch going consumer — German Sport University Cologne work is the leading edge

### Oura Ring
- Adds skin temp deviation + resilience score over WHOOP
- Skin temp as immune/autonomic activity proxy is genuinely useful for dysautonomia tracking
- **Verdict:** Marginal upgrade for Hannah specifically. Monitor for Gen 4+ with additional sensing.

### Continuous Glucose Monitors (already available)
- Abbott FreeStyle Libre / Dexcom G7 — CGM without prescription in some markets
- Some LC patients show dysglycemia patterns; could be a useful metabolic context signal
- **Worth trying** if Hannah is open to it. No hardware integration yet; API available.

### Future: CRISPR-Based Wearable Assays (Cluster 4)
- University of Calgary 2022: aptamer + CRISPR-Cas wearables could detect cytokines, pathogens, epigenetic markers
- This is the path to wearable IL-6 detection
- **Timeline:** 5–10 years. Watch research out of Calgary, MIT, Caltech.

---

## 🟢 AI-Adaptive Sensing Architecture — Software-First Opportunity

IBM's 2022 JP patent covers **context-aware, user-state-aware adaptive sampling** — the wearable hardware equivalent of what Cadence's analysis layer already does in software. Key insight:

> The hardware field is converging on the same architectural logic Cadence uses analytically: weight signals differently based on inferred user state.

When AI-adaptive biochemical wearables mature, Cadence's infrastructure is positioned to integrate them with minimal refactoring. The analytical layer (correlate.js, proxy_score.js, patterns API) already handles multi-signal fusion — adding a new data stream is an ingestion problem, not an architecture problem.

**Strategic implication:** Don't rebuild the analytics stack when new sensors arrive. Design ingestion to be modular (new `collection_type` in MongoDB is sufficient). ✅ Already done for `whoop_daily`, `visible_daily`, `self_report`.

---

## 🔵 Mental Health / Cognitive Monitoring — The Underserved Domain

The PatSnap report specifically flags this as **underserved relative to clinical need**. For Long COVID / Cadence:

- **Brain fog** (cognitive impairment) is Hannah's #1 constraint — under 60s to complete check-in on worst days
- Current proxy: check-in Q "brain fog" (self-report)
- Emerging hardware approaches:
  - **EEG wristband / headband** — cognitive load estimation (Muse, Neurosity Crown)
  - **EOG** — eye tracking for cognitive fatigue (experimental)
  - **Cortisol sweat** — objective HPA axis proxy for cognitive stress

**Near-term actionable:** Consider adding a **reaction time** or **typing speed** micro-test to the Cadence check-in as a passive cognitive proxy. Takes 5–10 seconds, no hardware required, and correlates with cognitive impairment in ME/CFS literature. Low-hanging fruit.

---

## 📋 Exploration Backlog

- [ ] Evaluate Epicore Biosystems sweat patch for pilot with Hannah (lactate + electrolytes)
- [ ] Research CGM API integration (Abbott Libre Link / Dexcom Clarity) — add `cgm_daily` collection
- [ ] Investigate Oura Gen 4 sensing capabilities when released
- [ ] Monitor CRISPR wearable research (Calgary, MIT, Caltech) — annual check
- [ ] Prototype reaction-time micro-test as passive cognitive proxy in check-in
- [ ] Review IBM JP patent (2022) for AI-adaptive sampling — relevant if Cadence ever ships hardware
- [ ] FTO analysis consideration: if any Cadence feature touches wearable biosensor signal processing, flag Chinese institutional IP landscape

---

## Sources
- PatSnap Multimodal Biosensor Wearable Landscape 2026: https://www.patsnap.com/resources/blog/articles/multimodal-biosensor-wearable-tech-landscape-2026/
- Faghy et al. 2025 (CommsMed) — biochemical marker landscape for LC
- Guardo et al. 2026 (CommsMed) — multi-scale data for LC identification
- Gil 2024 — CD8 T-cell dysfunction, metabolic implications
