# Build Phases — Overview

Each phase below will get its own detailed `.md` file as we work through it. This file is just the index/sequence.

Status legend: 🟢 Locked in · 🟡 Yet to be decided

## Phase 0 — Project setup 🟢 Locked in
1. Repo init — backend + (later) frontend, folder structure, README
2. Environment config — `.env` handling for API keys (Plivo, Sarvam, Claude), dev/prod separation
3. Package/dependency setup — Node.js + TypeScript, pnpm, Turborepo

See `phase-0-project-setup.md` for full detail.

## Phase 1 — Database & schema 🟡 Yet to be decided
4. Design schema — clients, knowledge base, contacts, queue, calls, follow-ups — with `client_id` on every relevant table from day one
5. Set up Postgres (local dev, hosted later — provider TBD, see Phase 0 open items)
6. Migrations tooling

## Phase 2 — Core calling pipeline 🟡 Yet to be decided
7. Plivo integration — test call connects and streams audio, no AI yet
8. Sarvam STT integration — transcription quality check
9. Claude integration — basic call-and-response, no knowledge base yet
10. Sarvam TTS integration — generated speech quality check
11. Orchestration layer — **LiveKit Agents** (Node/TS, replaces Pipecat — kept the whole repo in one language) — wire 7–10 into one live, turn-taking conversation loop
12. Test end-to-end on own phone — checkpoint before building anything else

## Phase 3 — Data flowing into the schema 🟡 Yet to be decided
13. Wire calls into the database — real records per call
14. Recording + transcript storage
15. Knowledge base ingestion (RAG) — connect into step 9 so responses are grounded

## Phase 4 — Automation layer 🟡 Yet to be decided
16. Contact upload (Excel/CSV parser) — writes into `contacts` table
17. Call queue — reads contacts, respects calling hours, triggers pipeline automatically
18. Retry logic — handles no-answer/busy outcomes

## Phase 5 — Outcome intelligence 🟡 Yet to be decided
19. Outcome tagging — post-call transcript analysis, interest level/tags written back to call record

## Phase 6 — Dashboard 🟡 Yet to be decided
20. Basic frontend — auth, call log list, call detail view (transcript + recording playback)
21. Usage view — calls made vs plan quota

---

*Detailed discussion and decisions for each phase live in separate files, created as we work through them. Only Phase 0 has a detail doc so far — `phase-0-project-setup.md`.*