# Project Status Update

Last updated: 2026-10-08

## Summary

The project has moved beyond starter scaffolding: the calling service is deployed on Railway, and the project owner reports more than 10 live calls with positive feedback on call quality and the overall experience. A separate TypeScript/Express backend now contains database-backed APIs and a call queue worker, but its authenticated, end-to-end production behavior has not yet been verified.

**Backend estimate:** roughly 65% of the planned backend feature scope is implemented in code. This is a repository-based estimate, not a production-readiness score: the backend TypeScript build passes, while authentication/tenant authorization, automated tests, and a verified live database-to-calling workflow remain incomplete.

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
- Backend database access is configured through Neon and Drizzle

Remaining:
- Verify migrations and representative CRUD/workflow queries against the intended Postgres environment
- Add automated data-flow, integrity, and migration checks; seed scripts exist but do not replace these checks

### Backend API and workflow
Status: Core feature paths implemented in code; not yet verified as a secure, production-ready service

Done:
- TypeScript/Express backend with a Docker build, `/health`, environment configuration, and Neon/Drizzle database access
- Firebase Admin initialization and user synchronization/profile endpoints, including initial client workspace provisioning
- API handlers for clients, business profiles, campaigns, contacts, knowledge-base entries, calls, queue items, and follow-ups
- JSON bulk contact import with per-row results; queue enqueueing and scheduled processing are implemented
- Queue worker checks calling hours, per-client daily limits and monthly credits, supplies campaign/business/contact/knowledge-base context to the calling service, and retries eligible failures
- Call completion handler stores call summaries, transcripts, cost estimates, and outcomes; updates queue/contact status and credit usage; and creates requested follow-ups
- Analytics overview handler exists in source

Remaining / not yet verified:
- **Authentication and tenant authorization:** `requireAuth` exists but is not attached to registered API routes; client/workspace ownership is therefore not enforced by the backend route layer. Do not treat these APIs as production-safe until this is fixed and tested.
- **Analytics routing:** the analytics handler is not registered in the route table, so `/api/analytics/overview` is not currently exposed by this service.
- **Automated coverage:** no backend test files were found; only the TypeScript build was verified for this update.
- **Database and integration validation:** migrations have not been verified against a live database here, and the complete backend → calling service → completion webhook → persisted record flow has not been demonstrated.
- **Contact ingestion:** the backend accepts JSON rows; file upload plus CSV/XLSX parsing, duplicate handling, and robust batch/large-import processing remain.
- **Media and operations:** recording storage/playback, webhook delivery/replay, queue recovery, multi-instance coordination, monitoring, rate limits, and operational alerting need validation or implementation.
- **Production deployment:** a Dockerfile exists, but the backend deployment and runtime configuration were not independently checked.

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
Status: Core queue and retry paths implemented; broader automation and production hardening remain

Implemented in backend code:
- JSON bulk contact import and queue scheduling/processing
- Retry scheduling for eligible unsuccessful calls
- Follow-up creation from call analysis payloads and manual follow-up APIs
- CRUD APIs for business profiles, campaigns, and knowledge-base entries; active knowledge entries are passed into the calling flow

Pending:
- CSV/XLSX file parsing, duplicate detection, and stronger batch validation
- Verify calling-hours, quota, retry, and follow-up behavior with automated and end-to-end tests
- Add durable queue locking/recovery and webhook idempotency/replay for restart and multi-instance safety
- Knowledge-base document ingestion/search beyond manually managed entries
- Complete outcome analysis generation and business-specific workflow rules

## Phase status

| Phase | Status |
|---|---|
| Phase 0 — Project setup | Complete |
| Phase 1 — Database & schema | Schema, migrations, and runtime access layer implemented; live DB verification remains |
| Phase 2 — Core calling pipeline | Live MVP deployed; more than 10 positively reviewed calls reported by the project owner |
| Phase 3 — Data flow into the schema | Persistence and webhook handler implemented in code; complete deployed flow not yet verified |
| Phase 4 — Automation layer | Queue, scheduling, and retries implemented in code; CSV/XLSX import and reliability hardening remain |
| Phase 5 — Outcome intelligence | Call-analysis ingestion and follow-up creation implemented; analysis generation and validation remain |
| Phase 6 — Dashboard | Backend APIs and early web work exist; authentication, analytics route wiring, and product UI remain |

## Recommended next milestones

1. Apply Firebase authentication and per-client authorization to all user-facing backend routes; make webhook authentication mandatory in deployment and limit/authorize queue processing triggers.
2. Verify database migrations and the full backend → calling → webhook → database path in a non-production environment.
3. Add automated backend tests for authorization/tenant isolation, CRUD, bulk-import failures, queue limits/scheduling/retries, webhook validation, and duplicate delivery.
4. Register the analytics endpoint and wire it into the authenticated dashboard.
5. Add CSV/XLSX import, duplicate handling, and resilient batch processing.
6. Add durable queue coordination/recovery and webhook idempotency/replay; verify recording storage and playback.
7. Address calling-service risks already documented below, including dial authorization, trusted request targets, webhook protection, delivery replay, STT recovery, and partial-stream fallback.
8. Measure production reliability and concurrency before making capacity or readiness claims.

## Repository review findings (2026-10-04)

A read-only static review identified the following issues in tracked code. These are code-level findings; whether an endpoint is reachable publicly depends on the corresponding deployment configuration.

### High priority

- **Outbound calls are not authenticated:** `/dial` forwards requests to Plivo without an authentication check; the short duplicate debounce is not an access-control or cost-control boundary. See `apps/calling/src/routes/index.ts` and `apps/calling/src/routes/dial.ts`.
- **User-controlled URLs can trigger server-side requests:** web API routes accept `callingServiceUrl` and `engineUrl`, and call-result delivery accepts a caller-provided `callbackUrl`. These can target internal or attacker-controlled destinations; callback delivery includes call results and transcripts. See `apps/web/app/api/dial/route.ts`, `apps/web/app/api/engine-status/route.ts`, and `apps/calling/src/delivery/callDelivery.ts`.
- **Call records lack access controls and webhook authentication:** the calls API allows listing and deleting stored records, while the call webhook accepts payloads without validating a signature or equivalent authentication. Public exposure would allow transcript disclosure, deletion, or forged records. See `apps/web/app/api/calls/route.ts` and `apps/web/app/api/webhooks/calls/route.ts`.
- **Failed result delivery has no replay path:** after retries, results are spooled to local JSON files, but tracked code does not replay them. Without a separately configured persistent Railway volume, restart or redeployment may also remove these files. See `apps/calling/src/delivery/callDelivery.ts` and `railway.toml`.

### Medium priority

- **STT disconnect recovery is incomplete:** after a session has opened, socket errors do not reconnect; audio sending can stop while the call remains active. See `apps/calling/src/providers/sarvam/stt.ts` and `apps/calling/src/pipeline/conversationSession.ts`.
- **Streaming fallback can duplicate speech:** if Gemini emits part of a reply before failing, the fallback shares the existing buffer and callback, potentially speaking partial primary output followed by fallback output. See `apps/calling/src/providers/claude/generateReply.ts`.

This review was static and read-only. No provider credentials, Railway environment settings, live endpoints, or external provider APIs were tested. Fixing access control, request-target restrictions, and webhook authentication should precede broader production rollout.

## Final assessment

The project has crossed an important milestone: a Railway-deployed calling MVP has handled more than 10 real calls with positive feedback, as reported by the project owner. The next stage is hardening and completing the product around that working call experience: automated reliability checks, durable data, dashboard workflows, and automation.

The live calls demonstrate real end-to-end voice interaction, but do not alone establish production readiness. This status is based on repository inspection and owner-reported call results; Railway settings, provider credentials, production data persistence, and service telemetry were not independently inspected here.
