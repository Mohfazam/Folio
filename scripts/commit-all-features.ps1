# Master PowerShell script to commit every single file change as an individual, granular commit
# Run from repository root: .\scripts\commit-all-features.ps1

Write-Host "Creating granular commits for all features..." -ForegroundColor Cyan

# ── Calling: Audio Sensitivity, Noise Gate & Latency ──
git add apps/calling/src/providers/gemini/generateReply.ts
git commit -m "perf(calling): switch primary model to gemini-2.5-flash to eliminate fallback latency"

git add apps/calling/src/providers/sarvam/stt.ts
git commit -m "perf(calling): tune Sarvam STT VAD threshold, prefix padding, and silence endpointing"

git add apps/calling/src/utils/audioFilter.ts
git commit -m "feat(calling): add telephony audio preprocessor with noise gate and +5.3dB speech booster"

git add apps/calling/src/pipeline/conversationSession.ts
git commit -m "feat(calling): route Plivo live audio stream through noise gate and speech booster"

git add apps/calling/src/conversational/bargeInDetector.ts
git commit -m "fix(calling): suppress ambient background chatter and require 4+ words for barge-in"

git add apps/calling/src/conversational/conversationalEngine.ts
git commit -m "fix(calling): continue intro smoothly without interruption on early greetings"

git add apps/calling/src/routes/plivo-recording.ts
git commit -m "fix(calling): parse record_url from Plivo callback and fallback to direct backend dispatch"

git add apps/calling/src/routes/plivo-voice.ts
git commit -m "fix(calling): pass dual casing options to Plivo record API on call answer"

git add apps/calling/src/routes/dial.ts
git commit -m "fix(calling): accept CALLING_WEBHOOK_SECRET in dial preflight check"

git add apps/calling/src/delivery/callDelivery.ts
git commit -m "fix(calling): support CALLING_WEBHOOK_SECRET fallback in recording dispatcher"

git add apps/calling/test/audioFilter.test.ts
git commit -m "test(calling): add unit tests for noise gate attenuation and speech gain booster"

git add apps/calling/test/recordingConfig.test.ts
git commit -m "test(calling): fix exported variable identifier in recordingConfig test"

git add apps/calling/test/recordingValidator.test.ts
git commit -m "test(calling): fix exported variable identifier in recordingValidator test"

git add apps/calling/test/recordingWebhookDispatcher.test.ts
git commit -m "test(calling): fix exported variable identifier in recordingWebhookDispatcher test"

# ── Backend: 24/7 Background Worker Service ──
git add apps/backend/src/worker/recordingSyncWorker.ts
git commit -m "feat(backend): add 24/7 Plivo recording sync worker to pull and link audio URLs"

git add apps/backend/src/worker/queueCleanerWorker.ts
git commit -m "feat(backend): add 24/7 queue cleaner worker to clear zombie calls and release credits"

git add apps/backend/src/worker/workerDaemon.ts
git commit -m "feat(backend): add unified worker daemon orchestrating queue, recordings, and cleanup"

git add apps/backend/src/worker-runner.ts
git commit -m "feat(backend): add standalone worker-runner CLI entrypoint for 24/7 deployment"

git add apps/backend/src/server.ts
git commit -m "feat(backend): integrate 24/7 worker daemon directly into API server lifecycle"

git add apps/backend/src/routes/calls.ts
git commit -m "feat(backend): store plivoCallId in metadata, multi-strategy call lookup, and on-demand Plivo recording sync"

git add apps/backend/src/routes/index.ts
git commit -m "feat(backend): register POST /api/calls/sync-recordings endpoint"

git add apps/backend/package.json
git commit -m "feat(backend): add start:worker and dev:worker scripts to package manifest"

git add apps/backend/test/workerDaemon.test.ts
git commit -m "test(backend): add unit test for 24/7 worker daemon initialization"

git add apps/backend/test/audioRangeParser.test.ts
git commit -m "test(backend): fix exported identifier in audioRangeParser test"

git add apps/backend/test/recordingPolicy.test.ts
git commit -m "test(backend): fix exported identifier in recordingPolicy test"

git add apps/backend/test/recordingProxyStreamer.test.ts
git commit -m "test(backend): fix exported identifier in recordingProxyStreamer test"

# ── Frontend: Proxy & UI Components ──
git add apps/frontend/src/app/api/calls/sync-recordings/route.ts
git commit -m "feat(frontend): add API proxy route for workspace call recordings sync"

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

git add scripts/
git commit -m "chore(scripts): automation scripts for granular git commits"

Write-Host "All granular commits created successfully!" -ForegroundColor Green
git log --oneline -25
