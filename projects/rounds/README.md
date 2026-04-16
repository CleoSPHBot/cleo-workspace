# Project Rounds

## Mission
Build a doctor and nurse-facing clinical companion app for the Spectator Health EHR — optimized for patient status visibility and collaborative e-prescribing in long-term care settings.

## Users
- **Physicians** — write verbal orders, review staged prescriptions, sign and transmit
- **Nurses** — receive verbal orders, stage prescriptions, document administration
- **Med Techs** — execute med passes, document, escalate

## Core Workflows

### 1. Patient Status
- Census view — all patients on a unit/floor
- Per-patient status: vitals, med administration status, care plan flags, recent changes
- Role-filtered — each user sees what's relevant to their next action
- Real-time updates (WebSocket/SSE) when another user makes a change

### 2. Collaborative E-Prescribing (Verbal Order Flow)
```
Doctor (verbal order)
    ↓
Nurse → drug search (FDB) → select dose/sig → DDI check → stage (DRAFT)
    ↓
Doctor notified → reviews → approves → SIGNS → transmits to Surescripts
    ↓
Pharmacy → fills → administers → documented
```

**Draft Order States:**
- `DRAFT` — nurse actively building
- `STAGED` — nurse complete, awaiting MD review/signature
- `SIGNED` — physician approved, ready to transmit
- `TRANSMITTED` — sent to Surescripts
- `CONFIRMED` — pharmacy acknowledged
- `ADMINISTERED` — med tech documented administration

### 3. EPCS (Electronic Prescribing of Controlled Substances)
- Separate flow from standard e-prescribing
- Physician 2FA required to sign
- DEA compliance logging

## Architecture (4 Layers of Complexity)

### A. Workflow Coordination (Role-Based State Machine)
- Each order has a lifecycle state
- Each role sees only their current action queue
- No role can skip a step in the chain

### B. Real-Time Sync
- WebSockets or Server-Sent Events
- Optimistic UI with conflict resolution
- Multiple nurses/doctors on same floor see live updates

### C. Backend Integration (Clinical Data Service)
App never calls FDB/Surescripts/FHIR directly — one unified clinical API orchestrates:
- **FDB** — drug lookup, DDI checking, dosing guidance, formulary verification
- **Surescripts** — e-prescribing transmission, RTPB, medication history
- **FHIR R4** — patient demographics, conditions, allergies, MedicationRequest

### D. Event-Driven Pipeline
One clinical event (new prescription) touches 5 systems:
1. FDB validates + DDI check
2. FHIR MedicationRequest created (draft)
3. Surescripts transmission on sign
4. Nurse order queue updates (real-time)
5. Administration documented back to FHIR

## Key Design Principles
- **Role-optimized views** — doctors see signing queues, nurses see staging queues, med techs see administration queues
- **FDB inline** — drug search, DDI, and allergy checks happen at staging time, not at signing
- **Nurse can't transmit** — only physician NPI on Surescripts; nurse builds, doctor owns
- **Verbal order traceability** — audit trail from verbal order to administration
- **Mobile-friendly** — nurses and med techs need this on the floor, not just at a workstation

## Open Questions
- [ ] What does the existing EHR backend expose? (REST APIs, FHIR endpoints, direct DB?)
- [ ] Is Surescripts integration already built?
- [ ] What's the patient data model — FHIR-native or proprietary?
- [ ] Web only or mobile too?
- [ ] Single facility or multi-facility?
- [ ] EPCS in scope for v1?

## Status
- [x] Project named: Rounds
- [x] Core workflows defined
- [x] Architecture mapped
- [ ] Backend API audit
- [ ] Data model design
- [ ] UI wireframes
- [ ] Prototype

## Development Strategy
- **Phase 1:** HTML/JS prototypes (Cleo) — fast UX iteration, validate flows with real users
- **Phase 2:** Backend API development (David) — improve calls while UX is validated
- **Phase 3:** Expo React Native app — one codebase, iOS + Android, from battle-tested spec

**Target platform:** Expo React Native
**Notes:** HIPAA-compliant data handling required; biometric auth (Face ID) for EPCS signing; push notifications for prescription signing queue.

## Started
2026-04-16

## Team
- **David** — project lead + backend
- **Cleo** — clinical data, FDB/Surescripts integration, UI prototypes
- **Hugo/RN dev** — Expo React Native build (Phase 3)
