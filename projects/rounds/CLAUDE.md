# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

Rounds is a doctor/nurse-facing clinical companion app for the Spectator Health EHR, targeting long-term care settings. See `README.md` for the full product brief, workflow state machine, and team/phase structure.

**Current phase:** Phase 1 — static HTML/JS prototypes for UX iteration. Backend APIs (Phase 2) and Expo React Native (Phase 3) do not live in this repo yet. All code here should be treated as throwaway prototype work whose purpose is validating flows with clinicians, not production.

## Commands

- `npm start` — serves `prototype/` on http://0.0.0.0:8766 via Express with `Cache-Control: no-store` (no rebuild step; edit HTML and refresh).

There is no lint, no test suite, and no build system. Do not add one unless asked — it fights the "fast UX iteration" goal.

## Architecture

- **`server.js`** — 16-line Express static server. Its only job is serving `prototype/` with no-cache headers so edits show up on refresh.
- **`prototype/*.html`** — each file is a self-contained page (inline `<style>` and `<script>`, no shared CSS/JS files, no framework, no build). Pages link to each other via plain `<a href>`. Navigation state is passed via querystring (e.g. `patient.html?id=3`).
- **Mobile-first viewport** — pages are constrained to `max-width: 390–430px` and styled to look like an iOS app. They are meant to be demoed on a phone or in a phone-sized browser window, not responsive desktop layouts.
- **Design tokens** — each page re-declares a `:root` CSS variable block with the Spectator blue (`--sph-blue: #1a5f8a`) plus semantic red/yellow/green for clinical urgency. Keep these consistent across pages when adding new ones.

## Prototype Conventions

- **Duplication over abstraction.** Because there's no bundler and each page is self-contained, the same CSS block is repeated in every HTML file. Don't refactor into shared files — it breaks the "open one file, see the whole screen" workflow and isn't worth the complexity at this stage.
- **Data is hardcoded in the HTML.** No fetch calls, no mock API — resident names, vitals, alerts, drug search results are all inline. When adding a flow, hardcode plausible sample data rather than wiring a backend.
- **Clinical accuracy matters.** Sample data (drug names, doses, sigs, DDIs, vital ranges) is shown to clinicians as part of validating the workflow. Don't invent implausible values — check with Cleo (FDB/Surescripts owner) if unsure.
- **Workflow states are the core abstraction.** The draft-order lifecycle (`DRAFT → STAGED → SIGNED → TRANSMITTED → CONFIRMED → ADMINISTERED`) and role-based visibility (nurse stages, doctor signs, med tech administers) drive every screen. New screens should make it obvious which state and role they serve.
