# Build Phases — Overview

This repo includes both the original phase roadmap and the current implementation snapshot. The project is no longer only a planning document: the repo structure, schema, and initial calling service are already implemented.

Status legend: 🟢 Locked in · 🟡 In progress · 🔴 Not started

## Phase 0 — Project setup 🟢 Locked in
1. Repo init — backend + (later) frontend, folder structure, README — ✅ implemented
2. Environment config — `.env` handling for API keys (Plivo, Sarvam, Claude), dev/prod separation — ✅ implemented in the calling app
3. Package/dependency setup — Node.js + TypeScript, pnpm, Turborepo — ✅ implemented

See [Phase 0.md](./Phase%200.md) for the original decisions and [Project Status Update.md](./Project%20Status%20Update.md) for the current progress snapshot.

## Phase 1 — Database & schema 🟡 In progress
4. Design schema — clients, knowledge base, contacts, queue, calls, follow-ups — with `client_id` on every relevant table from day one — ✅ designed and implemented in [packages/db/src/schema.ts](../db/src/schema.ts)
5. Set up Postgres (local dev, hosted later — provider TBD) — 🟡 partly configured in repo, not yet running against a real production/dev database
6. Migrations tooling — ✅ present in the Drizzle setup

## Phase 2 — Core calling pipeline 🟡 In progress
7. Plivo integration — test call connects and streams audio, no AI yet — 🟡 route and XML scaffolding exist, but live flow is not fully validated
8. Sarvam STT integration — transcription quality check — 🟡 provider socket exists, payload validation still needed
9. Claude integration — basic call-and-response, no knowledge base yet — 🟡 ready in skeleton form, not fully production tested
10. Sarvam TTS integration — generated speech quality check — 🟡 provider socket exists, output contract still needs validation
11. Orchestration layer — **LiveKit Agents** (Node/TS, replaces Pipecat) — 🟡 skeleton conversation orchestration exists
12. Test end-to-end on own phone — 🔴 pending

## Phase 3 — Data flowing into the schema 🟡 Planned
13. Wire calls into the database — real records per call — 🔴 pending
14. Recording + transcript storage — 🔴 pending
15. Knowledge base ingestion (RAG) — 🔴 pending

## Phase 4 — Automation layer 🔴 Not started
16. Contact upload (Excel/CSV parser) — 🔴 pending
17. Call queue — reads contacts, respects calling hours, triggers pipeline automatically — 🔴 pending
18. Retry logic — handles no-answer/busy outcomes — 🔴 pending

## Phase 5 — Outcome intelligence 🔴 Not started
19. Outcome tagging — post-call transcript analysis, interest level/tags written back to call record — 🔴 pending

## Phase 6 — Dashboard 🔴 Not started
20. Basic frontend — auth, call log list, call detail view (transcript + recording playback) — 🔴 pending
21. Usage view — calls made vs plan quota — 🔴 pending

---

## Current state assessment

This project is currently at a strong prototype/foundation stage. The phase plan is valid, but the actual implementation is ahead of plan in setup and schema, while the live voice pipeline and business automation layers are still in progress or pending.

The most current status summary is in [Project Status Update.md](./Project%20Status%20Update.md).

*Detailed discussion and decisions for each phase live in separate files, created as we work through them. The repo now includes a live implementation snapshot, alongside the original phase planning docs.*