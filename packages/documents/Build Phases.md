# Build Phases — Overview

This repo includes both the original phase roadmap and the current implementation snapshot. The project is no longer only a planning document: the repo structure, schema, calling service, and a separate backend API/queue worker are implemented. Backend access controls and core workflows are present in source, but staging validation and broader regression coverage remain.

Status legend: 🟢 Locked in · 🟡 In progress · 🔴 Not started

## Phase 0 — Project setup 🟢 Locked in
1. Repo init — backend + (later) frontend, folder structure, README — ✅ implemented
2. Environment config — `.env` handling for API keys (Plivo, Sarvam, Claude), dev/prod separation — ✅ implemented in the calling app
3. Package/dependency setup — Node.js + TypeScript, pnpm, Turborepo — ✅ implemented

See [Phase 0.md](./Phase%200.md) for the original decisions and [Project Status Update.md](./Project%20Status%20Update.md) for the current progress snapshot.

## Phase 1 — Database & schema 🟡 In progress
4. Design schema — clients, knowledge base, contacts, queue, calls, follow-ups — with `client_id` on every relevant table from day one — ✅ designed and implemented in [packages/db/src/schema.ts](../db/src/schema.ts)
5. Set up Postgres (local dev, hosted later — provider TBD) — 🟡 Neon connection code is configured; no staging/production database validation was run for this update
6. Migrations tooling — ✅ Drizzle migrations `0010` and `0011` generated; review/apply them in staging before release

## Phase 2 — Core calling pipeline 🟢 Live MVP validated
7. Plivo integration — outbound calling and live media flow — ✅ used in live calls
8. Sarvam STT integration — caller speech recognition — ✅ exercised as part of the live call flow
9. Gemini integration — streamed conversational replies with a fallback model — ✅ exercised in live calls
10. Sarvam TTS integration — generated speech — ✅ call quality received positive feedback
11. Conversation orchestration — custom Node.js/TypeScript pipeline — ✅ deployed and exercised (the earlier LiveKit plan was not the implementation used)
12. End-to-end call test — ✅ more than 10 calls with positive feedback, as reported by the project owner

This confirms a working prototype call path, not production-scale reliability. Automated regression, load, interruption/recovery, and failure-path coverage remain follow-up work.

## Phase 3 — Data flowing into the schema 🟡 Implemented in code; end-to-end validation pending
13. Wire calls into the database — call-completion handler stores outcomes, summaries, transcripts, and cost estimates — 🟡 implemented; deployed flow not yet verified
14. Recording + transcript storage — transcript and recording storage reference are persisted by the handler — 🟡 wired; durable recording storage and playback remain unverified
15. Knowledge base ingestion (RAG) — CRUD APIs and passing active entries into call context are implemented — 🟡 manual-entry retrieval only; document ingestion/vector search remain pending

## Phase 4 — Automation layer 🟡 Core queue paths implemented; hardening pending
16. Contact upload (Excel/CSV parser) — ✅ capped CSV/XLSX upload with header normalization, duplicate checks, opt-out handling, formula rejection, and parser tests
17. Call queue — enqueue APIs and worker dispatch calls within configured calling hours and client limits — 🟡 queue claims and credit reservations are transactional; staging and multi-instance reconciliation need validation
18. Retry logic — retryable unsuccessful calls are rescheduled within calling windows — 🟡 implemented in code; queue lifecycle and ambiguous delivery need broader tests

## Phase 5 — Outcome intelligence 🟡 In progress
19. Outcome tagging — handler stores call analysis fields from the completion payload and creates requested follow-ups — 🟡 ingestion implemented; analysis generation and end-to-end validation remain

## Phase 6 — Dashboard 🟡 Early web/API work
20. Basic frontend — backend has Firebase user sync and tenant-scoped call-list/detail APIs; frontend sessions, authenticated customer screens, transcript/recording playback, and web-route authorization remain — 🟡 partial
21. Usage view — backend exposes quota and registered analytics data; frontend wiring and UI remain — 🟡 backend implemented, dashboard pending

---

## Current state assessment

The calling service has progressed from an unverified pipeline to a Railway-deployed live MVP with more than 10 positively reviewed calls, according to the project owner. Backend code now includes Firebase authentication, workspace scoping, service secrets, transactional persistence/queue reservations, analytics, and capped CSV/XLSX import. The next major gap is verifying these paths end-to-end in staging, expanding automated workflow tests, and completing dashboard authentication/UI.

The most current status summary is in [Project Status Update.md](./Project%20Status%20Update.md).

*Detailed discussion and decisions for each phase live in separate files, created as we work through them. The repo now includes a live implementation snapshot, alongside the original phase planning docs.*