# Folio

Folio is a TypeScript monorepo for an AI-powered outbound calling product. The calling service is deployed on Railway and has been used for more than 10 live calls, with positive user feedback on call quality (as reported by the project owner).

## Repository

| Path | Purpose |
|---|---|
| `apps/calling` | Express calling service: Plivo call control and media streaming, Sarvam speech, Gemini replies, and call lifecycle handling |
| `apps/web` | Next.js web app and API routes; product dashboard functionality is still in progress |
| `apps/docs` | Next.js documentation-site scaffold |
| `packages/db` | Drizzle schema and Postgres migrations |
| `packages/ui` | Shared UI components |
| `packages/documents` | Project plan and progress documents |

## Requirements

- Node.js 22 for the calling service (the backend database driver supports Node.js 18+)
- pnpm 9
- Provider credentials for local calling-service development

Install workspace dependencies from the repository root:

```sh
pnpm install
```

## Local development

Create `apps/calling/.env` for local calling-service development. Do not commit this file. The service requires:

```text
PLIVO_AUTH_ID=
PLIVO_AUTH_TOKEN=
PLIVO_PHONE_NUMBER=
MY_TEST_PHONE_NUMBER=
SARVAM_API_KEY=
GEMINI_API_KEY=
PUBLIC_URL=
```

`ANTHROPIC_API_KEY` is optional for the currently wired Gemini reply path. `PUBLIC_URL` must be a publicly reachable HTTP(S) base URL for Plivo webhooks; the service derives the secure WebSocket stream URL from it.

Run the calling service in watch mode:

```sh
pnpm --filter @repo/calling dev
```

Build it:

```sh
pnpm --filter @repo/calling build
```

The HTTP service exposes `/health`, `/dial`, `/active-calls`, and `/metrics`; Plivo uses `/plivo-voice`, `/plivo-hangup`, and `/media-stream`. `/dial`, `/active-calls`, and `/metrics` require `CALLING_SERVICE_SECRET`.

### Backend development

Create `apps/backend/.env` locally; never commit it:

```text
DATABASE_URL=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
CALLING_SERVICE_URL=http://localhost:3000
CALLING_SERVICE_SECRET=
WEBHOOK_SECRET=
BACKEND_WORKER_SECRET=
```

`CALLING_SERVICE_SECRET` must match the calling service's value. `WEBHOOK_SECRET` must match the calling service's value and protects `POST /api/calls/complete`. `BACKEND_WORKER_SECRET` protects `POST /api/queue/process` and should be configured only for the trusted scheduler. Authentication-dependent backend APIs fail closed until Firebase Admin credentials are configured.

Run the backend:

```sh
pnpm --filter @repo/backend dev
```

Run focused import tests and build the backend:

```sh
pnpm --filter @repo/backend test
pnpm --filter @repo/backend build
```

The calling service also requires `CALLING_SERVICE_SECRET`, `WEBHOOK_SECRET`, and `CALLBACK_URL`. Set `CALLBACK_URL` to the publicly reachable backend completion endpoint, for example `https://<backend-host>/api/calls/complete`; production callback URLs must use HTTPS. The shared secrets must be provisioned in both services through their deployment secret stores.

The backend uses Neon’s WebSocket pool driver because worker, provisioning, queue, phone-verification, and call-completion operations require database transactions. Apply reviewed Drizzle migrations to a non-production database first; do not use schema push or destructive resets as a production migration strategy.

## Deployment and validation

The repository includes a Railway configuration at `railway.toml` that builds `apps/calling/Dockerfile` and checks `/health`. Configure provider credentials and the public service URL as Railway environment variables; local `.env` values are not deployed automatically.

The live calling flow has been exercised in more than 10 calls with positive feedback, according to the project owner. This is useful real-world prototype validation, not a substitute for automated regression, load, security, or recovery testing. The web dashboard, database-backed call persistence, queue automation, and production operations still need work.

For the current phase-by-phase status and next milestones, see [Project Status Update](./packages/documents/Project%20Status%20Update.md) and [Build Phases](./packages/documents/Build%20Phases.md).
