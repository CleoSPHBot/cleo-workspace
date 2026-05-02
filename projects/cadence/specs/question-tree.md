# Cadence Question Decision Tree

## Goal
Adaptive question flow that asks **less on bad days, more on good days, different on either**.

## Root: Determine entry state

```
START
  │
  ├─ Q0: "How are you right now?"  (single tap)
  │   └─ 🟢 Good   ─→ GOOD branch
  │   └─ 🟡 Mixed  ─→ MIXED branch
  │   └─ 🔴 Bad    ─→ BAD branch
  │   └─ 🚨 Crash  ─→ CRASH branch  (severe — minimal interaction)
  │
  └─ (Pre-fill from device data shown in card above questions)
```

Q0 is the **only required question**. All branches respect: any "Skip" or back-to-home is allowed.

---

## 🔴 BAD branch — Diagnostic mode (max ~30 seconds)

Premise: she has minimal cognitive bandwidth. We capture the **diagnostic** questions a clinician would ask if she walked into urgent care.

```
BAD ─→ Q1: "What's the worst part right now?"
        ├─ Fatigue
        ├─ Pain
        ├─ Brain fog
        ├─ Dizzy / heart racing
        ├─ Gut
        └─ Other (free text, optional)
       │
       └─→ Q2: "When did this start?"
              ├─ This morning
              ├─ Yesterday
              ├─ 2-3 days ago
              ├─ Longer / can't tell
             │
             └─→ Q3 (optional, skippable): "Anything notable?"
                  └─ Voice or short text. ALWAYS skippable.
                  └─ Auto-end after 15 sec of silence.

  END: "Got it. Rest. Talk later." → home
```

**Total questions: 2 required + 1 optional = 30 sec on a bad day.**

---

## 🚨 CRASH branch — Minimal mode (single tap)

Premise: She tapped "🚨 Crash". She might be in bed, can't read.

```
CRASH ─→ "Logged. Anything to say? (optional)"
         └─ Voice button only. No typing required.
         └─ End. No follow-up.

  Background: app pulls WHOOP/Visible to attach context automatically.
  Optional: send notification to David ("Hannah logged a crash at HH:MM")
```

**Total: 1 tap (the Q0 itself was the crash flag). Zero additional asks.**

---

## 🟡 MIXED branch — Standard mode (~60 sec)

Premise: She has some bandwidth. Ask the **most predictive subset**.

```
MIXED ─→ Q1: "What's harder than usual today?"
          ├─ Fatigue
          ├─ Brain fog
          ├─ Pain
          ├─ Dizziness / orthostatic
          ├─ Gut
          ├─ None / can't pinpoint
         │
         └─→ Q2 (compliance — multi-select chips):
              "Today I:
               ☐ took probiotics
               ☐ wore compression
               ☐ hit sodium goal"
            │
            └─→ Q3 (notes — optional):
                "Anything notable?"
                └─ Skippable.

  END: home with summary.
```

**Total: 3 questions, 2 with chips, 1 optional text. ~60 sec.**

---

## 🟢 GOOD branch — Rich mode (~90 sec) — Retrospective + context

Premise: She has the most bandwidth. Use it for the questions that ONLY a human can answer — and revisit prior bad days she didn't fully label.

```
GOOD ─→ Q1: "What worked today?"
         (Multi-select chips:)
         ☐ Slept well
         ☐ Light activity
         ☐ Social
         ☐ Outside
         ☐ Hydration
         ☐ Skipped Adderall
         ☐ Other
        │
        ├─→ Q2 (compliance multi-select):
        │    "Today I: ☐ probiotics ☐ compression ☐ sodium"
        │
        ├─→ Q3 (RETROSPECTIVE — only if a recent bad day is unlabeled):
        │    "You marked [Apr 28] as bad. Looking back, do you know what triggered it?"
        │    └─ Voice or chips: ☐ over-activity ☐ social ☐ sleep ☐ food ☐ stress ☐ unknown
        │    └─ Skippable.
        │
        └─→ Q4 (notes — encourages free expression):
             "Anything else worth remembering?"
             └─ Skippable.

  END: home.
```

**Total: 2-4 questions. ~90 sec. Most cognitive-intensive but matches her state.**

---

## Weekly questions (cadence: every 7 days)

Triggered automatically once per week, attached to the lightest available branch (i.e., on a 🟢/🟡 day if possible; defer if she's on a 🔴/🚨 streak).

```
WEEKLY (max 1 question per day, attached to flow):
  ├─ Cycle: "Where are you in your cycle?"
  │   └─ Period / Follicular / Ovulation / Luteal / Unsure
  │
  ├─ Med changes: "Any new or changed meds this week?"
  │   └─ Yes (with text) / No
  │
  └─ Big events: "Anything big coming up next week?"
      └─ Free text / skip
```

If she has 3+ bad days in a row, weekly questions defer until a better day. They don't compound on bad days.

---

## One-time / On-trigger questions

```
ON FIRST RUN:
  ├─ Date of last period (anchor for cycle calc)
  ├─ Active med list (foundational context)
  ├─ Sodium goal (target value)
  ├─ "What's your worst symptom usually?" (calibrate symptom prompts)

ON-CHANGE TRIGGERS:
  ├─ New supplement / med added → "What did you start? Why?"
  ├─ Crash logged → "Want to add details now or later?"
  ├─ Doctor appointment → "What did they say? What changed?"
  └─ Travel → "Where are you going? When?"
```

---

## Device-pulled context (NEVER asked)

These show as cards above the questions, not as inputs:

```
PULLED FROM DEVICES:
  ├─ Sleep duration / quality            (WHOOP)
  ├─ Resting HR, HRV                     (WHOOP)
  ├─ Recovery score                      (WHOOP)
  ├─ Strain / max HR                     (WHOOP)
  ├─ Steps, standing hours               (Apple Watch / WHOOP)
  ├─ PacePoints, symptoms (severity)     (Visible)
  ├─ Stability Score                     (Visible)
  ├─ Crash flag                          (Visible)
  ├─ Cycle phase (calculated)            (derived from anchor)
  ├─ Weather                             (API)
  └─ Time since last bad day             (calculated)
```

---

## Decision tree summary

```
                          [Q0: How are you?]
                                  │
        ┌──────────┬──────────┬───┴───┬──────────┐
        │          │          │       │          │
       🟢          🟡          🔴      🚨         (skip)
        │          │          │       │
   Q1-Q4 rich  Q1-Q3 standard Q1-Q2 diag  Q1 voice
   ~90 sec    ~60 sec       ~30 sec   ~5 sec
   Retrospective              No followup
   + Weekly if due
```

---

## Open design questions

1. **How do we surface "you marked X as bad — what do you remember?"** Is it just-in-time on good days, or a passive list at the bottom of the home screen?

2. **What does the "Crash" button do beyond logging?** Send a notification? Attach a "what happened?" prompt for next good day? Auto-disable Adderall flag for that day?

3. **How do we handle bad-day streaks?** If she's bad 5 days running, the bad-day flow is the only flow. We stop asking weekly questions, defer retrospective. When does the system "earn back" the right to ask more?

4. **Do we ever ask the structured 11-question version?** Maybe as an opt-in deep dive on really good days? Or never — and devices fill those gaps.

5. **Voice vs text on bad days.** Whisper API costs are minimal. Should bad-day notes default to voice, with text as fallback?
