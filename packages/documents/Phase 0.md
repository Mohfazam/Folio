# Phase 0 — Project Setup 🟢 Locked in

## Decisions locked in

| Area | Choice | Notes |
|---|---|---|
| Language | Node.js + TypeScript, across all apps | Chosen for consistency across the repo — one language, one person/small team |
| Backend framework | Express or Fastify (pick one when scaffolding `/backend`) | The repo currently uses Express in the calling service; a dedicated backend app is still not fully scaffolded |
| Package manager | **pnpm** | Confirmed and in use |
| Monorepo tool | **Turborepo** | Confirmed and in use |
| Orchestration layer (calling pipeline) | **LiveKit Agents** (confirmed, replaces Pipecat) | Still the intended direction; currently the project has a early custom orchestration skeleton rather than full LiveKit integration |
| Hosting | **Vercel** (frontend) + **Render** (calling service) | Still the intended deployment model; not yet fully implemented |
| Database | Postgres | Schema is designed and tracked via Drizzle migrations |

## Repo structure

```text
/apps
  /web           → frontend dashboard app
  /docs          → documentation app
  /calling       → calling pipeline service (Plivo + Sarvam + Claude/Gemini), Node/TS
/packages
  /db            → database schema and migration setup
  /ui            → shared UI primitives
  /documents     → project planning and progress docs
```

This structure matches the original Phase 0 idea, though the repo currently has a `web` app and `docs` app rather than a separate `frontend` app due to the template scaffold.

## Current implementation status

This project has already moved beyond raw planning. The repo has:

- the Turborepo scaffold
- TypeScript app configuration
- a calling service with Express and route setup
- environment variables for the key API providers
- database schema definitions and migration files
- initial STT/TTS/LLM integration hooks

What remains incomplete is the actual production workflow: the full call loop, database-backed call lifecycle, queue automation, and production dashboard.

## Open items still relevant

- Express vs Fastify for `/backend` remains a design decision to settle when the backend app is added
- Postgres hosting provider is still not finalized
- Whether `/calling` should directly access the database or only report to a backend API remains a product decision
- Real payload validation against live Sarvam and Plivo APIs is still pending

## Current next steps

1. Verify live Plivo streaming contract and media WebSocket bridge
2. Test real Sarvam STT/TTS payload formats against live responses
3. Connect the calling loop to a stable call state + transcript persistence flow
4. Build the first real backend API and dashboard screens
5. Add queue automation and follow-up logic after the conversation loop is fixed

## Updated project assessment

The repo is a real technical foundation, not just a plan. It is now in the prototype stage rather than pure setup. The project plan remains valid, but the implementation reality is: setup and schema are mostly done, while call orchestration and automation are still the main engineering gap.

See [Build Phases.md](./Build%20Phases.md) and [Project Status Update.md](./Project%20Status%20Update.md) for the up-to-date phase and implementation status.
