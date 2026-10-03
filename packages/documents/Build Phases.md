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

## Phase 2 — Core calling pipeline 🟢 Live MVP validated
7. Plivo integration — outbound calling and live media flow — ✅ used in live calls
8. Sarvam STT integration — caller speech recognition — ✅ exercised as part of the live call flow
9. Gemini integration — streamed conversational replies with a fallback model — ✅ exercised in live calls
10. Sarvam TTS integration — generated speech — ✅ call quality received positive feedback
11. Conversation orchestration — custom Node.js/TypeScript pipeline — ✅ deployed and exercised (the earlier LiveKit plan was not the implementation used)
12. End-to-end call test — ✅ more than 10 calls with positive feedback, as reported by the project owner

This confirms a working prototype call path, not production-scale reliability. Automated regression, load, interruption/recovery, and failure-path coverage remain follow-up work.

## Phase 3 — Data flowing into the schema 🟡 Not yet validated
13. Wire calls into the database — real records per call — 🔴 pending
14. Recording + transcript storage — 🔴 pending
15. Knowledge base ingestion (RAG) — 🔴 pending

## Phase 4 — Automation layer 🔴 Not started
16. Contact upload (Excel/CSV parser) — 🔴 pending
17. Call queue — reads contacts, respects calling hours, triggers pipeline automatically — 🔴 pending
18. Retry logic — handles no-answer/busy outcomes — 🔴 pending

## Phase 5 — Outcome intelligence 🔴 Not started
19. Outcome tagging — post-call transcript analysis, interest level/tags written back to call record — 🔴 pending

## Phase 6 — Dashboard 🟡 Early web/API work
20. Basic frontend — auth, call log list, call detail view (transcript + recording playback) — 🔴 pending
21. Usage view — calls made vs plan quota — 🔴 pending

---

## Current state assessment

The calling service has progressed from an unverified pipeline to a Railway-deployed live MVP with more than 10 positively reviewed calls, according to the project owner. The next major gap is turning those conversations into a durable product workflow: persistent call/transcript/outcome data, a useful dashboard, and queue/follow-up automation.

The most current status summary is in [Project Status Update.md](./Project%20Status%20Update.md).

*Detailed discussion and decisions for each phase live in separate files, created as we work through them. The repo now includes a live implementation snapshot, alongside the original phase planning docs.*