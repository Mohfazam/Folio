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

- Node.js 24.22.1 (latest LTS release)
- pnpm 10.17.1
- Provider credentials for local calling-service development

Install pnpm directly with npm:

```sh
npm install --global pnpm@10.17.1
```

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

Run the calling-service tests:

```sh
pnpm --filter @repo/calling test
```

The HTTP service exposes `/health`, `/dial`, `/active-calls`, and `/metrics`; Plivo uses `/plivo-voice`, `/plivo-hangup`, and `/media-stream`. `/dial`, `/active-calls`, and `/metrics` require `CALLING_SERVICE_SECRET`.

### Backend development

Create `apps/backend/.env` locally; never commit it:

```text
DATABASE_URL=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
CALLING_SERVICE_URL=http://localhost:3000
CALLING_SERVICE_SECRET=
WEBHOOK_SECRET=
BACKEND_WORKER_SECRET=
```

`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are the same Supabase project URL and publishable key used by the frontend. The backend also accepts `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. It uses these values to verify Supabase access tokens; the Neon database remains the source of application and workspace data. `CALLING_SERVICE_SECRET` must match the calling service's value. `WEBHOOK_SECRET` must match the calling service's value and protects `POST /api/calls/complete`. `BACKEND_WORKER_SECRET` protects `POST /api/queue/process` and should be configured only for the trusted scheduler. Authentication-dependent backend APIs fail closed until Supabase Auth is configured.

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

The Supabase Auth migration renames the stored identity column without dropping existing user data. Apply pending migrations with `pnpm --filter @repo/db db:migrate` before deploying the updated backend. Existing Firebase-linked user records are reused at first Supabase sign-in only when Supabase confirms the same email address.

## Deployment and validation

The repository-root `railway.toml` builds `apps/backend/Dockerfile` and checks `/health`. From the repository root, link the CLI to the Railway project and backend service, then deploy with:

```sh
railway link
railway up --service <backend-service-name>
```

Configure the backend service's environment variables in Railway; local `.env` values are not deployed automatically. Set `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CALLING_SERVICE_URL`, `WEBHOOK_SECRET`, and `BACKEND_WORKER_SECRET`. Set `ALLOWED_ORIGINS` to the deployed frontend origin(s), and make sure the calling service's `CALLBACK_URL` points to `https://<backend-host>/api/calls/complete`.

The calling service has a separate config at `apps/calling/railway.json`. To keep its GitHub Actions deployment building the calling Dockerfile, set the calling Railway service's Config as Code path to `/apps/calling/railway.json` in Railway service settings. The backend service should use the root `railway.toml`.

The live calling flow has been exercised in more than 10 calls with positive feedback, according to the project owner. This is useful real-world prototype validation, not a substitute for automated regression, load, security, or recovery testing. The web dashboard, database-backed call persistence, queue automation, and production operations still need work.

For the current phase-by-phase status and next milestones, see [Project Status Update](./packages/documents/Project%20Status%20Update.md) and [Build Phases](./packages/documents/Build%20Phases.md).
