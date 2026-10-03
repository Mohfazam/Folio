# Phase 0 — Project Setup 🟢 Locked in

## Decisions locked in

| Area | Choice | Notes |
|---|---|---|
| Language | Node.js + TypeScript, across all apps | Chosen for consistency across the repo — one language, one person/small team |
| Backend framework | Express or Fastify (pick one when scaffolding `/backend`) | The repo currently uses Express in the calling service; a dedicated backend app is still not fully scaffolded |
| Package manager | **pnpm** | Confirmed and in use |
| Monorepo tool | **Turborepo** | Confirmed and in use |
| Orchestration layer (calling pipeline) | Custom Node.js/TypeScript conversation pipeline | The current calling service uses custom orchestration; LiveKit was an earlier plan and is not the deployed implementation |
| Hosting | Railway for the calling service | The calling service is deployed on Railway; hosting for the web app remains to be decided |
| Database | Postgres | Schema is designed and tracked via Drizzle migrations |

## Repo structure

```text
/apps
  /web           → frontend dashboard app
  /docs          → documentation app
  /calling       → calling pipeline service (Plivo + Sarvam + Gemini), Node/TS
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

The calling service has now been exercised in more than 10 live calls with positive feedback, as reported by the project owner. This validates the prototype's user-facing call quality, but not load, recovery, or production operations. Database-backed call persistence, queue automation, and the business dashboard remain incomplete.

## Open items still relevant

- Whether to add a dedicated backend beyond the current calling and web APIs remains open
- Postgres hosting provider is still not finalized
- Whether `/calling` should directly access the database or only report to a backend API remains a product decision
- Automated regression, load, and failure-recovery coverage for live calling remains to be added

## Current next steps

1. Add automated tests and operational monitoring around the deployed call flow
2. Connect calls, transcripts, and outcomes to persistent database records
3. Build business-facing dashboard screens on top of the call and contact data
4. Add queue automation, retry policies, and follow-up logic

## Updated project assessment

The repo is a real technical foundation, not just a plan. It is now in the live calling prototype stage rather than pure setup. The main engineering gaps are persistence, product workflows, automation, and reliability hardening around the working call experience.

See [Build Phases.md](./Build%20Phases.md) and [Project Status Update.md](./Project%20Status%20Update.md) for the up-to-date phase and implementation status.
