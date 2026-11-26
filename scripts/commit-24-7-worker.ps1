# PowerShell script to create granular commits for 24/7 background worker service
# Run from repository root: .\scripts\commit-24-7-worker.ps1

Write-Host "Creating granular commits for 24/7 worker service..." -ForegroundColor Cyan

# 1. Backend: Plivo recording sync worker
git add apps/backend/src/worker/recordingSyncWorker.ts
git commit -m "feat(backend): add 24/7 Plivo recording sync worker to pull and link audio URLs"

# 2. Backend: Queue cleaner worker
git add apps/backend/src/worker/queueCleanerWorker.ts
git commit -m "feat(backend): add 24/7 queue cleaner worker to clear zombie calls and release credits"

# 3. Backend: Unified worker daemon
git add apps/backend/src/worker/workerDaemon.ts
git commit -m "feat(backend): add unified worker daemon orchestrating queue, recordings, and cleanup"

# 4. Backend: Standalone worker runner entrypoint
git add apps/backend/src/worker-runner.ts
git commit -m "feat(backend): add standalone worker-runner CLI entrypoint for 24/7 deployment"

# 5. Backend: Server in-process daemon integration
git add apps/backend/src/server.ts
git commit -m "feat(backend): integrate 24/7 worker daemon directly into API server lifecycle"

# 6. Backend: Package scripts
git add apps/backend/package.json
git commit -m "feat(backend): add start:worker and dev:worker scripts to package manifest"

# 7. Backend: Worker daemon unit test
git add apps/backend/test/workerDaemon.test.ts
git commit -m "test(backend): add unit test for 24/7 worker daemon initialization"

# 8. Backend: Test file identifier fixes
git add apps/backend/test/audioRangeParser.test.ts
git commit -m "test(backend): fix exported identifier in audioRangeParser test"

git add apps/backend/test/recordingPolicy.test.ts
git commit -m "test(backend): fix exported identifier in recordingPolicy test"

git add apps/backend/test/recordingProxyStreamer.test.ts
git commit -m "test(backend): fix exported identifier in recordingProxyStreamer test"

git add scripts/commit-24-7-worker.ps1
git commit -m "chore(scripts): automation script for 24/7 worker service commits"

Write-Host "All 24/7 worker commits created successfully!" -ForegroundColor Green
git log --oneline -10
