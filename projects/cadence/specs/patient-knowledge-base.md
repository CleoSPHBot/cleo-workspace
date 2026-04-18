# Spec: Patient's Own Knowledge Base
_Cleo — April 2026_

---

## What This Is

A personal, living knowledge base that belongs to the patient — not to a clinic, not to a research platform.

Think of it as a patient's **second brain** for their chronic condition. It grows with them: their own data, their own research, their own patterns, cross-referenced with a curated scientific foundation.

For a patient like Hannah, this is the difference between a drawer full of appointment notes and a system that actually helps her manage her life.

---

## Problem It Solves

Patients with complex chronic conditions — Long COVID, ME/CFS, dysautonomia — accumulate enormous amounts of information:
- Lab results, appointment notes, test reports
- Research papers they've found
- Things that have helped vs. worsened their condition
- Forum posts, community wisdom
- Triggers, patterns, observations

Right now, all of this lives in disconnected places: PDFs in a Google Drive folder, screenshots on a phone, a note somewhere, a doctor's portal no one checks. It's fragmented, non-searchable, and nearly impossible to hand to a new doctor.

The patient is the only person who holds the full picture. But they have no good way to hold it.

---

## Core Concept: Three Layers

### Layer 1: Personal Data
*What's happening to me*

Automatically ingested from connected sources:
- WHOOP (recovery, HRV, sleep, strain)
- Visible (pacing budget, PacePoints, HRV trend)
- Check-in app responses (symptoms, mood, activity)
- Future: Oura (skin temp, resilience), continuous glucose monitor, Apple Health

Each day is a structured object: biometrics + symptom report + free observations.

### Layer 2: Personal Journal
*What I've noticed, what I've tried*

Patient-written notes, voice memos transcribed, photos of rashes or pill bottles, appointment summaries. Free-form but tagged and indexed.

- "Tried splitting my walk into 3×5 min chunks — felt better than 1×15"
- "New cardiologist thinks it's POTS — notes attached"
- "Started G-NiiB probiotics today"

### Layer 3: Curated Research
*What the science says about conditions like mine*

A foundation knowledge base — like the Long COVID wiki we built — but personalized to their phenotype and concerns.

- Papers and summaries relevant to their cluster of symptoms
- Drug/supplement fact sheets (FDB-backed: interactions, side effects, dosing)
- Condition explainers (PEM, dysautonomia, mast cell, etc.)
- Linked to: what the patient has personally tried, what their data shows

---

## Key Features

### 1. Search Across Everything
One search box that spans:
- Their own data ("when was my last crash?")
- Their journal ("what did I write about metformin?")
- Research ("what does the science say about naltrexone?")
- Combined ("my data + what the literature says about HRV and PEM")

Natural language queries, not just keyword search. AI-powered.

### 2. Timeline View
A scrollable timeline that integrates:
- Daily biometric summaries
- Symptom check-ins (color-coded 🟢🟡🔴)
- Journal entries
- Medical appointments / events
- Intervention starts/stops (new medication, supplement, pacing strategy)

The timeline makes patterns visible. "Every time I had a 🔴 week, there was a stressful event 48 hours before."

### 3. Phenotype Profile
Based on their data and symptom patterns, a living profile that characterizes their condition:
- Phenotype tags: PEM-dominant, dysautonomia, gut/viral persistence, cognitive
- Key biomarker baselines (HRV at baseline, recovery % average, etc.)
- Known triggers (pattern-detected + manually confirmed)
- Known helpers (same)

This profile shapes what research is surfaced and what the AI highlights.

### 4. Doctor Brief
One-tap generation of a structured visit summary:
- Current symptom load (last 2 weeks)
- Trends vs. prior period
- Active medications and supplements
- Key questions the patient wants to ask
- Relevant research to share with provider

Output: clean PDF or shareable link. Not a wall of data — a clinical narrative.

### 5. Research Feed
A personalized feed of new research, filtered to their phenotype:
- New LC papers mentioning dysautonomia + HRV
- Clinical trial alerts matching their profile
- Community reports about treatments they're tracking

Pull-based (they choose what to follow), not push-spam.

---

## Data Model

```
Patient
├── profile
│   ├── phenotype_tags[]
│   ├── baseline_biometrics{}
│   ├── condition_onset_date
│   └── tracking_sources[]
│
├── days[]           ← one per calendar date
│   ├── date
│   ├── biometrics{} ← WHOOP, Visible, Oura, etc.
│   ├── check_in{}   ← symptoms, self-report
│   ├── notes[]      ← journal entries for that day
│   └── events[]     ← appointments, interventions
│
├── interventions[]  ← what they've tried
│   ├── name
│   ├── start_date / end_date
│   ├── type (medication | supplement | behavior | therapy)
│   └── outcome_notes
│
├── documents[]      ← lab results, reports, records
│   ├── title
│   ├── date
│   ├── source (provider, hospital, self)
│   ├── file_ref
│   └── extracted_text  ← OCR/parsed
│
└── knowledge_base[] ← curated research + references
    ├── source_type (paper | guideline | personal_note)
    ├── title
    ├── phenotype_tags[]
    ├── summary
    └── linked_interventions[]
```

---

## What Makes It Theirs

1. **Export everything, always.** JSON, PDF, CSV — no lock-in. It's their data.
2. **They control sharing.** Nothing goes to a provider or researcher without explicit consent.
3. **They curate the knowledge base.** Pre-loaded with relevant science, but they can add, remove, annotate.
4. **The AI serves them, not the system.** Insights are framed for patient decisions, not clinical efficiency metrics.
5. **Works offline.** The core timeline and data should be available without internet.

---

## AI Layer (Cleo)

Cleo is the intelligence layer embedded in this system:

- **Lookup:** Drug info, interactions, side effects from FDB when they read about or start a medication
- **Research Q&A:** "What does the research say about beta-blockers for POTS?" — answer grounded in their personal KB + the scientific foundation
- **Pattern detection:** "Your HRV drops 2 days before your worst symptom days — want me to surface that pattern?"
- **Appointment prep:** Auto-draft doctor briefs from recent data
- **Trial matching:** "There's a trial at Brigham's matching your phenotype" (connected to ClinicalTrials.gov)

Cleo does not diagnose. Cleo informs and connects.

---

## MVP Scope (v1)

**In scope:**
- [ ] Connect: WHOOP + Visible + existing check-in app
- [ ] Timeline view: days with biometrics + check-in color
- [ ] Journal: text entries, tagged by date
- [ ] Interventions log: start/stop/notes
- [ ] Search: full-text across journal + research
- [ ] Doctor brief: generate PDF summary for last N days
- [ ] Research section: pre-loaded Long COVID KB (the wiki we built)

**Out of scope for v1:**
- AI Q&A over personal data (v2)
- Document upload/OCR (v2)
- Research feed / trial matching (v2)
- Sharing/collaboration (v3)
- Phenotype inference (v2)

---

## Connection to Cadence

This is Cadence's natural evolution. Cadence is already:
- Collecting daily biometrics (WHOOP + Visible)
- Running the check-in app
- Storing data in MongoDB

The KB layer wraps around that foundation and makes it meaningful to Hannah — not just data she's providing to researchers, but a system that serves *her*.

The check-in app becomes one input among many. The data she's been generating since December 2022 becomes her archive. The Long COVID wiki we built becomes her research library.

---

## Open Questions

1. **Who owns the infrastructure?** Patient-hosted (privacy-first) vs. Spectator Health-hosted (managed)?
2. **How does it relate to Rounds?** Does the doctor brief become a bridge to the clinical workflow?
3. **Multipatient?** Hannah is v1. Generalizing to other LC patients is the product play.
4. **Monetization?** Patient-facing subscription? Or bundled with Rounds for providers?
5. **Privacy/HIPAA posture?** If Spectator Health hosts, this is a covered entity question.

---

*Spec drafted by Cleo 🦉 — April 18, 2026*
