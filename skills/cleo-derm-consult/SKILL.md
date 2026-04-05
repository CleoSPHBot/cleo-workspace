---
name: cleo-derm-consult
description: Conduct a structured dermatology consult from a skin/rash image. Triggered by messages like "what is this rash?", "can you look at this skin condition?", "I have a rash photo", "skin consult", "dermatology question", or any time a user shares an image of a skin finding and asks for clinical assessment. Follows an iterative history-gathering workflow, builds a differential diagnosis, suggests workup, and optionally links to ICD-10 codes or drug treatments. Always caveats as non-diagnostic and recommends clinician evaluation.
---

# Cleo Derm Consult

Structured dermatology consult for skin/rash images. Designed for LTC nurses and clinical staff — not a substitute for physician evaluation.

## Core Principles

- **Non-diagnostic**: Always state clearly you are not making a diagnosis. Frame output as "clinical observations" and "differential to consider."
- **Always escalate**: End every consult with a recommendation to see a clinician or dermatologist.
- **Iterative**: Ask follow-up questions to narrow the differential. Don't dump everything at once.
- **Actionable**: Suggest next steps (OTC options, test type, urgency level).

## Workflow

### Step 1: Initial Image Assessment

When a skin image is provided, observe and document:

- **Location** (body region, laterality, dermatomal vs. non-dermatomal)
- **Morphology**: macules, papules, vesicles, pustules, plaques, scale, crust
- **Distribution**: localized, clustered, scattered, linear, annular
- **Secondary changes**: excoriation, hyperpigmentation, peeling/desquamation, lichenification
- **Color**: erythematous, violaceous, hypopigmented, etc.

Present findings clearly, then offer a **broad initial differential** (3–5 conditions).

### Step 2: Gather Clinical History

After initial assessment, ask targeted follow-up questions to narrow the differential. Prioritize:

1. **Duration** — how long has it been present?
2. **Symptoms** — itchy, painful, burning, asymptomatic?
3. **Progression** — spreading, stable, resolving?
4. **Associated findings** — fever, systemic symptoms, similar rash elsewhere?
5. **Triggers** — new products (soap, detergent, lotion), clothing/material, plants, medications, occupational/activity exposure (e.g., cycling, swimming, gardening)
6. **Patient context** — age, comorbidities (diabetes, immunosuppression), relevant history

Ask 2–3 questions at a time. Don't overwhelm. Wait for responses before narrowing.

### Step 3: Refine the Differential

As history accumulates, revise the differential. Rank by likelihood. Explain the clinical reasoning briefly for each candidate:

- What fits
- What doesn't fit
- What would confirm or rule out

Use format:
```
🥇 Most likely: [Condition] — [2-sentence rationale]
🥈 Also consider: [Condition] — [rationale]
🥉 Lower on list: [Condition] — [why it's less likely now]
```

### Step 4: Suggest Workup & Next Steps

Based on the narrowed differential, recommend:

- **Immediate action** (e.g., OTC hydrocortisone, antifungal cream, antihistamine)
- **Diagnostic test** (e.g., KOH scraping for tinea, Tzanck smear/PCR for HSV, patch testing for contact dermatitis)
- **Urgency** — routine derm visit vs. urgent care vs. ED
- **Red flags to watch for** (spreading rapidly, blistering, fever, systemic symptoms → escalate)

### Step 5: ICD-10 & Drug Linkage (optional)

If the user wants codes or treatment options, use:
- `cleo-icd-lookup` skill for ICD-10 codes on top differential diagnoses
- `cleo-reverse-indication` skill to find drugs indicated for the leading diagnosis
- `cleo-drug-search` or `cleo-medid-lookup` for specific medication details

## Common Dermatology Differentials Quick Reference

See `references/derm-differentials.md` for a reference table of common conditions, key distinguishing features, typical workup, and first-line treatments.

## Closing Every Consult

Always end with:
> ⚕️ **This is a clinical observation, not a diagnosis.** Please have this evaluated by a licensed clinician or dermatologist for definitive assessment and treatment.

Include urgency guidance:
- **Routine**: Stable, non-spreading, no systemic symptoms → derm appointment within days to weeks
- **Semi-urgent**: Present >4 weeks, worsening, or affecting quality of life → within a few days
- **Urgent**: Spreading rapidly, blistering, facial involvement, fever → urgent care or ED same day
