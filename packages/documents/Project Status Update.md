# Project Status Update

Last updated: 2026-10-08

## Summary

The project has moved beyond starter scaffolding: the calling service is deployed on Railway, and the project owner reports more than 10 live calls with positive feedback on call quality and the overall experience. A separate TypeScript/Express backend now contains database-backed APIs and a call queue worker, but its authenticated, end-to-end production behavior has not yet been verified.

**Backend estimate:** roughly 85% of the planned core backend feature scope is implemented in code. This is a repository-based estimate, not a production-readiness score: backend and calling TypeScript builds pass, and focused CSV/XLSX parser tests pass. Database migrations, Firebase identity flows, tenant isolation, queue/call transactions, and the deployed backend-to-calling workflow still need staging integration validation.

This is meaningful user validation of a live calling prototype. It does not by itself establish load capacity, failure recovery, security posture, automated regression coverage, or a complete business workflow. The backend now contains call persistence and queue automation paths, but production-safe access control, end-to-end verification, and a complete business-facing dashboard remain key gaps.

## Current implementation status

### Foundation and repo structure
Status: Completed / largely complete

Done:
- Turbo monorepo initialized and working as a multi-app workspace
- Root package, workspace, and TypeScript configuration are in place
- App split exists for `web`, `docs`, `calling`, and `backend`
- Shared config packages and environment setup are present
- Core provider env variables are defined for calling features

Remaining:
- real deployment split between frontend and voice backend
- project-specific documentation cleanup and environment examples
- production-level repo hygiene and service ownership boundaries

### Database and schema
Status: Schema, migrations, and backend query layer implemented; live database verification remains

Done:
- Postgres schema covers clients, users, contacts, upload batches, call queue, calls, follow-ups, audit logs, and knowledge-base entries
- Core enums and table definitions are present in [packages/db/src/schema.ts](../db/src/schema.ts)
- Migration history exists and tracks schema evolution in the database package
- The schema appears designed to support a real admissions/outreach workflow rather than a generic demo
- Backend database access uses Drizzle with Neon’s WebSocket pool driver so multi-statement transactions used by provisioning, queue claims, and call completion are supported
- Migrations `0010` and `0011` contain the Firebase/call-delivery/follow-up changes and queue/client credit-reservation columns

Remaining:
- Verify migrations and representative CRUD/workflow queries against the intended Postgres environment
- Add automated data-flow, integrity, and migration checks; seed scripts exist but do not replace these checks

### Backend API and workflow
Status: Core feature paths and access-control hardening implemented in code; staging and production behavior remain unverified

Done:
- TypeScript/Express backend with a Docker build, `/health`, environment configuration, and Neon/Drizzle database access
- Firebase Admin initialization and user synchronization/profile endpoints, including initial client workspace provisioning
- API handlers for clients, business profiles, campaigns, contacts, knowledge-base entries, calls, queue items, and follow-ups; analytics is registered
- Firebase ID-token verification fails closed when unconfigured; workspace ownership and admin-write checks are applied to user-facing routes
- Webhook, worker, and calling-service endpoints require separate shared secrets, compared in constant time
- JSON bulk import and CSV/XLSX upload accept capped input, reject formula cells and malformed opt-out data, normalize headers, detect duplicates within a batch/workspace query, and preserve opt-outs
- Queueing checks active campaigns and contact eligibility; queue claims and credit reservations are transactional; the worker honors client timezones and quotas
- Call completion validates payload shape, uses a unique delivery ID for idempotency, and transactionally writes call/follow-up/queue/billing updates
- Campaign lifecycle and workspace-scoped resource operations are validated in handlers and route middleware
- Focused CSV/XLSX tests cover normalization, malformed data, file types, formulas, and contact-count caps

Remaining / not yet verified:
- **Identity/authorization tests:** middleware and per-route tenant protections are implemented but do not yet have a dedicated automated API test suite; browser/dashboard auth integration is incomplete.
- **Database and integration validation:** migrations have not been applied or verified against a staging database here; the backend → calling service → completion webhook → persisted record flow has not been demonstrated in this environment.
- **Queue delivery ambiguity:** an uncertain calling-service response retains a claim to avoid an immediate duplicate; stale claims are failed and released for operator review rather than automatically redialed. Durable reconciliation/replay is still needed.
- **Import scale and archive safety:** CSV/XLSX uploads are capped at 5 MB and 500 contacts; high-volume background processing and XLSX decompression/resource limits need additional hardening.
- **Media and operations:** durable recording storage/playback, result-delivery replay, multi-instance coordination, monitoring, rate limits, and operational alerting remain.
- **Production deployment:** backend deployment, secret provisioning, database migrations, and runtime behavior were not independently checked.

### Calling service
Status: Railway-deployed live MVP; call quality validated by user feedback

Done:
- Calling service is deployed on Railway and exposes health, dial, Plivo webhook, media-stream, active-call, and metrics routes
- Plivo call initiation and bidirectional media-stream setup are wired into the service
- Sarvam STT/TTS and Gemini streamed reply generation are integrated into the conversation flow
- Gemini has a fallback model configured; Anthropic is optional and is not the active reply path described by the current implementation
- Custom Node.js/TypeScript conversation orchestration is the deployed approach; the earlier LiveKit plan is not the current implementation
- Project owner reports more than 10 live calls with positive feedback

Still to validate and improve:
- Automated tests for live call, provider failure, interruption, and recovery paths
- Load/concurrency limits, reliability targets, and operational monitoring
- Verify that call lifecycle, transcripts, and outcomes persist end-to-end through the backend database
- Quality and reliability across a broader set of callers, network conditions, and call scenarios

### Frontend / dashboard
Status: Early application/API work; backend endpoints exist, but this is not yet a complete business dashboard

Done:
- Next.js apps exist for `web` and `docs`; the docs page remains a starter scaffold
- The web app contains API routes and a call store, and the backend now provides much of the corresponding data API; this is not yet a complete customer-facing control center

Remaining:
- auth, session, and protected route flow
- call detail pages and transcript views
- recording playback and analytics surfaces
- quota, usage, and lead pipeline management UI
- Wire and verify the dashboard against authenticated backend endpoints

### Automation and business logic
Status: Core queue, retry, reservation, and file-import paths implemented; reconciliation and production hardening remain

Implemented in backend code:
- JSON bulk contact import and queue scheduling/processing
- Retry scheduling for eligible unsuccessful calls
- Follow-up creation from call analysis payloads and manual follow-up APIs
- CRUD APIs for business profiles, campaigns, and knowledge-base entries; active knowledge entries are passed into the calling flow

Pending:
- Expand automated tests from the import parser to auth, tenant isolation, queue limits/retries, and webhook idempotency
- Verify calling-hours, quota, retry, and follow-up behavior against a staging database and live test services
- Add durable dispatch reconciliation and webhook delivery replay for restart and multi-instance safety
- Knowledge-base document ingestion/search beyond manually managed entries
- Complete outcome analysis generation and business-specific workflow rules

## Phase status

| Phase | Status |
|---|---|
| Phase 0 — Project setup | Complete |
| Phase 1 — Database & schema | Schema, reviewed migration files, and transaction-capable runtime access implemented; staging DB verification remains |
| Phase 2 — Core calling pipeline | Live MVP deployed; more than 10 positively reviewed calls reported by the project owner |
| Phase 3 — Data flow into the schema | Authenticated APIs and transactional, idempotent persistence implemented; deployed flow not yet verified |
| Phase 4 — Automation layer | Queue, scheduling, retries, and capped CSV/XLSX import implemented; automated workflow coverage and reconciliation remain |
| Phase 5 — Outcome intelligence | Call-analysis ingestion and follow-up creation implemented; analysis generation and validation remain |
| Phase 6 — Dashboard | Authenticated analytics/API surfaces exist; frontend session wiring and customer UI remain |

## Recommended next milestones

1. Apply migrations `0010`/`0011` and verify the schema plus representative transactional flows against a non-production database.
2. Configure Firebase Admin and matching `CALLING_SERVICE_SECRET`, `WEBHOOK_SECRET`, `BACKEND_WORKER_SECRET`, and `CALLBACK_URL` values in the respective deployment secret stores.
3. Run staging checks for signup/provisioning, tenant isolation, contact import/opt-out, queue limits/retries, authenticated service dispatch, webhook idempotency, and persisted call records.
4. Add automated backend tests for auth/tenant middleware, queue lifecycle and quota accounting, webhook validation/idempotency, and API-level import behavior.
5. Wire Firebase sessions and authenticated API calls through the web dashboard; address the remaining unauthenticated web proxy/data routes.
6. Add durable dispatch reconciliation/result replay and verify recording storage/playback.
7. Continue calling-service failure-path work, including STT recovery and partial-stream fallback.
8. Measure production reliability and concurrency before making capacity or readiness claims.

## Remaining repository review findings (2026-10-08)

A follow-up static review found the following unresolved issues in tracked code. These are code-level findings; whether an endpoint is reachable publicly depends on deployment configuration.

### High priority

- **The web dial proxy is not integrated with the new service boundary:** it accepts a caller-supplied calling-service URL and does not attach `CALLING_SERVICE_SECRET`; the calling service now rejects unauthenticated `/dial` requests. The proxy also has no user authentication/rate limit, so merely attaching the secret would not make it safe. See `apps/web/app/api/dial/route.ts`.
- **Web API routes still need authorization and trusted targets:** `engine-status` accepts a client-controlled target URL, and web call-data routes need auth/tenant checks before exposure. See `apps/web/app/api/engine-status/route.ts` and `apps/web/app/api/calls/route.ts`.
- **The web call webhook lacks backend-grade authentication:** verify its signature/secret and payload before persisting results. See `apps/web/app/api/webhooks/calls/route.ts`.
- **Failed result delivery has no replay path:** after retries, results are spooled to local JSON files, but tracked code does not replay them. Without a separately configured persistent Railway volume, restart or redeployment may also remove these files. See `apps/calling/src/delivery/callDelivery.ts` and `railway.toml`.

### Medium priority

- **STT disconnect recovery is incomplete:** after a session has opened, socket errors do not reconnect; audio sending can stop while the call remains active. See `apps/calling/src/providers/sarvam/stt.ts` and `apps/calling/src/pipeline/conversationSession.ts`.
- **Streaming fallback can duplicate speech:** if Gemini emits part of a reply before failing, the fallback shares the existing buffer and callback, potentially speaking partial primary output followed by fallback output. See `apps/calling/src/providers/claude/generateReply.ts`.

This review was static. Backend source protections are implemented, but frontend routes and deployment configuration still need validation. No provider credentials, Railway environment settings, live endpoints, or external provider APIs were tested. Fixing the web proxy/data-route authorization and confirming secrets/migrations should precede broader production rollout.

## Final assessment

The project has crossed an important milestone: a Railway-deployed calling MVP has handled more than 10 real calls with positive feedback, as reported by the project owner. The next stage is hardening and completing the product around that working call experience: automated reliability checks, durable data, dashboard workflows, and automation.

The live calls demonstrate real end-to-end voice interaction, but do not alone establish production readiness. This status is based on repository inspection and owner-reported call results; Railway settings, provider credentials, production data persistence, and service telemetry were not independently inspected here.
