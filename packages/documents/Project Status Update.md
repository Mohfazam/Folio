# Project Status Update

Last updated: 2026-10-04

## Summary

The project has moved beyond starter scaffolding: the calling service is deployed on Railway, and the project owner reports more than 10 live calls with positive feedback on call quality and the overall experience. The workspace contains a Turborepo monorepo with a `calling` service, `web` app, `docs` app, and a shared database package.

This is meaningful user validation of a live calling prototype. It does not by itself establish load capacity, failure recovery, security posture, automated regression coverage, or a complete business workflow. Durable call data, queue automation, and a business-facing dashboard remain key gaps.

## Current implementation status

### Foundation and repo structure
Status: Completed / largely complete

Done:
- Turbo monorepo initialized and working as a multi-app workspace
- Root package, workspace, and TypeScript configuration are in place
- App split exists for `web`, `docs`, and `calling`
- Shared config packages and environment setup are present
- Core provider env variables are defined for calling features

Remaining:
- real deployment split between frontend and voice backend
- project-specific documentation cleanup and environment examples
- production-level repo hygiene and service ownership boundaries

### Database and schema
Status: Mostly complete in design and implementation

Done:
- Postgres schema covers clients, users, contacts, upload batches, call queue, calls, follow-ups, audit logs, and knowledge-base entries
- Core enums and table definitions are present in [packages/db/src/schema.ts](../db/src/schema.ts)
- Migration history exists and tracks schema evolution in the database package
- The schema appears designed to support a real admissions/outreach workflow rather than a generic demo

Remaining:
- real database migration execution against a live Postgres instance
- runtime access layer and query patterns for app usage
- seed scripts, validation, and integrity checks for production-style data flows

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
- Durable persistence of calls, transcripts, and outcomes through the database
- Quality and reliability across a broader set of callers, network conditions, and call scenarios

### Frontend / dashboard
Status: Early application/API work; not yet a complete business dashboard

Done:
- Next.js apps exist for `web` and `docs`; the docs page remains a starter scaffold
- The web app contains API routes and a call store, but is not yet a complete customer-facing control center

Remaining:
- auth, session, and protected route flow
- call detail pages and transcript views
- recording playback and analytics surfaces
- quota, usage, and lead pipeline management UI

### Automation and business logic
Status: Not started / design-only

Pending:
- contact upload parser and validation workflows
- call queue automation and scheduling rules
- retry, escalation, and no-answer handling
- follow-up and outcome-analysis logic
- knowledge-base ingestion and retrieval pipeline
- business rules for admissions or outreach logic beyond generic call flow

## Phase status

| Phase | Status |
|---|---|
| Phase 0 — Project setup | Complete |
| Phase 1 — Database & schema | Schema and migrations implemented; live runtime integration remains to verify |
| Phase 2 — Core calling pipeline | Live MVP deployed; more than 10 positively reviewed calls reported by the project owner |
| Phase 3 — Data flow into the schema | Not yet validated as a durable end-to-end workflow |
| Phase 4 — Automation layer | Not started |
| Phase 5 — Outcome intelligence | Not started |
| Phase 6 — Dashboard | Early web/API implementation; product dashboard incomplete |

## Recommended next milestones

1. Restrict `/dial` to authenticated, authorized callers and apply destination/rate limits.
2. Remove user-controlled server-side request destinations or enforce strict trusted-host allowlists; authenticate webhooks and protect call history APIs.
3. Add a durable, replayable webhook delivery queue instead of relying on local spool files.
4. Add STT mid-call reconnect/recovery and make model fallback safe after partial streamed output.
5. Add automated regression coverage for successful calls, provider errors, interruption, and recovery.
6. Persist call lifecycle, transcripts, and outcomes to the database and verify the deployed data flow.
7. Complete a minimal dashboard for call status, summaries, and transcripts; then add queueing, contact import, retry policy, and follow-up automation.
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
