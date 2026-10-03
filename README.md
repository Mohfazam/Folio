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

- Node.js 22 for the calling service
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

The HTTP service exposes `/health`, `/dial`, `/active-calls`, and `/metrics`; Plivo uses `/plivo-voice`, `/plivo-hangup`, and `/media-stream`.

## Deployment and validation

The repository includes a Railway configuration at `railway.toml` that builds `apps/calling/Dockerfile` and checks `/health`. Configure provider credentials and the public service URL as Railway environment variables; local `.env` values are not deployed automatically.

The live calling flow has been exercised in more than 10 calls with positive feedback, according to the project owner. This is useful real-world prototype validation, not a substitute for automated regression, load, security, or recovery testing. The web dashboard, database-backed call persistence, queue automation, and production operations still need work.

For the current phase-by-phase status and next milestones, see [Project Status Update](./packages/documents/Project%20Status%20Update.md) and [Build Phases](./packages/documents/Build%20Phases.md).
