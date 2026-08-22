# Phase 0 — Project Setup 🟢 Locked in

## Decisions locked in
 
| Area | Choice | Notes |
|---|---|---|
| Language | Node.js + TypeScript, across all apps | Chosen for consistency across the repo — one language, one person/small team |
| Backend framework | Express or Fastify (pick one when scaffolding `/backend`) | Not yet finalized which of the two — both are fine choices |
| Package manager | **pnpm** | Chosen over Bun for maturity/compatibility with Turborepo tooling and documentation; boring-but-safe choice given the real engineering risk sits in the calling pipeline, not package management |
| Monorepo tool | **Turborepo** | Task caching + orchestration across apps |
| Orchestration layer (calling pipeline) | **LiveKit Agents** (confirmed, replaces Pipecat) | Pipecat is Python-native; LiveKit Agents has a genuine Node/TS SDK, keeping the whole repo in one language. Does the same job: real-time STT→LLM→TTS orchestration, turn-taking, interruption handling. This decision belongs to Phase 2 but is confirmed here since it directly shaped the "all Node/TS" call in Phase 0 |
| Hosting | **Vercel** (frontend) + **Render** (calling service) | Vercel is serverless/short-execution — incompatible with the calling pipeline's need for long-lived, persistent connections during a call. Render (or AWS) hosts `/calling`. Backend API (`/backend`) can likely stay on Vercel if it's simple request/response, or move to Render alongside `/calling` — decide once `/backend`'s responsibilities are clearer |
| Database | Postgres | Hosting provider TBD (Render/AWS both offer managed Postgres) |

## Repo structure

```
/apps
  /frontend      → dashboard (Next.js or similar), deployed on Vercel
  /backend       → core API (auth, clients, contacts, calls, dashboard data), Node/TS
  /calling       → calling pipeline service (LiveKit Agents + Plivo + Sarvam + Claude), Node/TS, deployed on Render
/packages
  (shared types, DB client/schema, utils — to be defined once schema exists)
```

Each app is a separate deployable unit; Turborepo ties them together for shared tooling, caching, and any shared packages (e.g. database types, shared validation logic).

## Open items to resolve before/while scaffolding

- Express vs Fastify for `/backend`
- Whether `/backend` and `/calling` end up on the same host (Render) or split (Vercel + Render) — revisit once `/backend`'s actual responsibilities are clearer
- Postgres hosting provider — Render's managed Postgres vs AWS RDS vs another option
- Whether `/calling` needs its own separate repo access to the database, or only talks to `/backend` via internal API (recommended: keep `/calling` focused on the call itself, have it report results back to `/backend`, rather than both touching the DB directly — avoids duplicated data-access logic)

## Immediate next steps

1. `pnpm dlx create-turbo@latest` — scaffold the Turborepo
2. Set up `pnpm-workspace.yaml` and top-level `turbo.json`
3. Scaffold `/apps/backend`, `/apps/frontend`, `/apps/calling` as empty apps
4. Set up `.env` handling per app (Plivo, Sarvam, Claude keys — never committed, `.env.example` checked in instead)
5. Confirm Express vs Fastify, scaffold `/backend`'s basic server
6. Move to Phase 1 (schema design) once repo skeleton is in place