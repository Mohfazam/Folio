# Foolioo public live demo integration

The public demo is a separate anonymous call flow. It does not reuse or weaken the authenticated `POST /api/test-calls` endpoint. The backend creates a synthetic contact and queue entry under a dedicated showcase workspace. The existing calling worker and Plivo/Sarvam calling pipeline place the call using the showcase workspace's server-owned agent settings.

## Frontend environment

Set these values in the frontend deployment:

- `NEXT_PUBLIC_PUBLIC_DEMO_ENABLED=true` only after backend setup and an end-to-end call test.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` with the Cloudflare Turnstile site key configured for the public website hostname.
- `PUBLIC_DEMO_API_URL` with the backend URL ending in `/api/public-demo`. Use HTTPS in production.
- `PUBLIC_DEMO_PROXY_SECRET` with a long random secret shared with the backend. Keep it server-only.

## Backend environment

Set these values in the backend deployment:

- `PUBLIC_DEMO_ENABLED=true` to enable the endpoint.
- `PUBLIC_DEMO_CLIENT_ID` with the stable UUID reserved for the showcase workspace.
- `PUBLIC_DEMO_PROXY_SECRET` with the exact same secret configured in the frontend.
- `TURNSTILE_SECRET_KEY` with the matching Cloudflare secret key.
- `PUBLIC_DEMO_ALLOWED_HOSTNAMES` with the exact public website hostnames allowed by the Turnstile site key, comma-separated. Required in production.
- `PUBLIC_DEMO_AGENT_VOICE_ID` optional Sarvam Bulbul v3 speaker ID. Defaults to `priya`. Supported IDs are validated by the calling service.
- `PUBLIC_DEMO_AGENT_NAME` optional showcase persona name. Defaults to `Aarohi`.

Set `PUBLIC_DEMO_CLIENT_ID` on the calling service too. The calling service uses it to mask public-demo destination numbers in operational logs. Set `PUBLIC_DEMO_GEMINI_MODEL=gemini-2.5-flash` there to use the higher-capability showcase model. If it is unavailable for your API key, the runtime falls back to the existing primary model. The public showcase uses the existing Sarvam `saaras:v3-realtime` STT and `bulbul:v3` TTS pipeline with a server-owned voice speaker; no visitor can change these settings.

Generate the shared secret with a password manager or `openssl rand -hex 32`. Do not commit it. Do not expose it through a `NEXT_PUBLIC_` variable.

## Create the dedicated showcase workspace

1. Generate a stable UUID for `PUBLIC_DEMO_CLIENT_ID`.
2. Configure the backend environment variables above.
3. Run `pnpm --filter @repo/backend setup:public-demo` from the monorepo root.
4. Ensure the calling service has its existing Plivo, Sarvam, LLM, callback URL and webhook secret configuration. The public demo uses the current calling service pipeline, including Sarvam Bulbul v3 TTS and the configured speech/model providers.
5. Configure the backend's existing `CALLING_SERVICE_URL`, `CALLING_SERVICE_SECRET`, `WEBHOOK_SECRET`, and `BACKEND_PUBLIC_URL` exactly as required by the existing deployment.
6. Configure the frontend variables and deploy both services.
7. Test one call to a number you own before enabling the public CTA.

The setup script creates or updates a dedicated `scale` showcase client and a fictional education showcase profile. It does not create a real institute or real course catalogue. Do not add real student data or real institutional claims to this profile.

## Backend-enforced controls

- The anonymous endpoint is mounted before authenticated workspace middleware, but requires a timing-safe shared secret sent only by the same-origin frontend server proxy.
- Cloudflare Turnstile is verified by the backend. The token is single-use and must carry the `public_demo` action.
- Requests are limited to Indian mobile numbers (`+91`) for the initial launch.
- IP rate limit: 5 requests per hour per visitor IP. The frontend proxy forwards the edge-observed visitor IP; keep the proxy secret private.
- Per-number cooldown: one public demo per number every 24 hours.
- Daily showcase cap: 20 accepted demo requests per India Standard Time day.
- Concurrent queue cap: 2 pending/in-progress public demo calls.
- Showcase workspace credit allowance: 7,200 credits per cycle and 25 calls/day. The worker reserves 12 credits for each 120-second call and charges actual connected duration through the existing completion webhook.
- Calling window: 9:00 AM to 8:00 PM IST.
- Maximum call duration: 120 seconds, enforced by the existing queue worker and calling service dial request.
- The visitor cannot submit a workspace ID, prompt, agent configuration, voice ID, model ID, callback URL, or arbitrary provider setting. Those values come from the dedicated showcase workspace.
- Call recording is disabled. The completion handler does not retain the public demo transcript, summary, or analysis.
- Visitor phone data remains in the synthetic contact and queue only for the 24-hour cooldown. The backend automatically redacts expired phone data at startup and every 15 minutes. You can also run `pnpm --filter @repo/backend cleanup:public-demo` manually.
- Public demo contacts are treated as system test calls. They cannot trigger campaign retries, CRM follow-ups or workspace routing automations.

The per-process IP limiter uses in-memory storage. If the backend runs multiple replicas, configure a shared rate-limit store before increasing public traffic. Database row locking still serializes per-showcase request quotas and concurrency checks across replicas.

## Rollout

Keep `NEXT_PUBLIC_PUBLIC_DEMO_ENABLED=false` until the dedicated workspace exists, all backend/calling environment variables are configured, and a real end-to-end test call succeeds. Then set it to `true`. The existing dashboard test-call route and its authentication/verified-phone requirements remain unchanged.
