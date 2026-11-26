# PowerShell script to create granular commits for every file change
# Run from repository root: .\scripts\commit-recording-fixes.ps1

Write-Host "Creating granular commits for recording fixes..." -ForegroundColor Cyan

# 1. Calling: Plivo recording callback parser & direct dispatch fallback
git add apps/calling/src/routes/plivo-recording.ts
git commit -m "fix(calling): parse record_url from Plivo callback and fallback to direct backend dispatch"

# 2. Calling: Pass dual case options to Plivo record API on call pickup
git add apps/calling/src/routes/plivo-voice.ts
git commit -m "fix(calling): pass dual casing options to Plivo record API on call answer"

# 3. Calling: Webhook secret check in dial route
git add apps/calling/src/routes/dial.ts
git commit -m "fix(calling): accept CALLING_WEBHOOK_SECRET in dial preflight check"

# 4. Calling: Dispatcher webhook secret fallback
git add apps/calling/src/delivery/callDelivery.ts
git commit -m "fix(calling): support CALLING_WEBHOOK_SECRET fallback in recording dispatcher"

# 5. Backend: Calls route multi-strategy matching and on-demand Plivo API sync
git add apps/backend/src/routes/calls.ts
git commit -m "feat(backend): store plivoCallId in metadata, multi-strategy call lookup, and on-demand Plivo recording sync"

# 6. Backend: Register sync-recordings route
git add apps/backend/src/routes/index.ts
git commit -m "feat(backend): register POST /api/calls/sync-recordings endpoint"

# 7. Frontend: Proxy route for recording sync
git add apps/frontend/src/app/api/calls/sync-recordings/route.ts
git commit -m "feat(frontend): add API proxy route for workspace call recordings sync"

# 8. Frontend: Component type fixes
git add apps/frontend/src/components/dashboard/audio-playback-speed.tsx
git commit -m "fix(frontend): export valid identifier in audio-playback-speed component"

git add apps/frontend/src/components/dashboard/audio-volume-control.tsx
git commit -m "fix(frontend): export valid identifier in audio-volume-control component"

git add apps/frontend/src/components/dashboard/audio-waveform-skeleton.tsx
git commit -m "fix(frontend): export valid identifier in audio-waveform-skeleton component"

git add apps/frontend/src/components/dashboard/recording-share-button.tsx
git commit -m "fix(frontend): export valid identifier in recording-share-button component"

git add apps/frontend/test/formatAudioTime.test.ts
git commit -m "test(frontend): export valid identifier in formatAudioTime unit test"

git add apps/frontend/test/useAudioKeyboardShortcuts.test.ts
git commit -m "test(frontend): export valid identifier in useAudioKeyboardShortcuts unit test"

git add scripts/commit-recording-fixes.ps1
git commit -m "chore(scripts): automation script for granular recording commits"

Write-Host "All granular commits created successfully!" -ForegroundColor Green
git log --oneline -15
