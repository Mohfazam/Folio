# PowerShell script to create granular commits for every file change
# Run from repository root: .\scripts\commit-audio-and-recording-fixes.ps1

Write-Host "Creating granular commits for audio sensitivity, noise filtering, and latency fixes..." -ForegroundColor Cyan

# 1. Calling: Latency fix - switch primary model to ultra-low latency gemini-2.5-flash
git add apps/calling/src/providers/gemini/generateReply.ts
git commit -m "perf(calling): switch primary model to gemini-2.5-flash to eliminate model fallback latency"

# 2. Calling: STT VAD sensitivity, noise rejection, and silence duration optimization
git add apps/calling/src/providers/sarvam/stt.ts
git commit -m "perf(calling): tune Sarvam STT VAD threshold, prefix padding, and silence endpointing"

# 3. Calling: Telephony audio pre-processor with noise gate and adaptive speech gain
git add apps/calling/src/utils/audioFilter.ts
git commit -m "feat(calling): add telephony audio preprocessor with noise gate and +5.3dB speech booster"

# 4. Calling: Audio filter integration in conversation session
git add apps/calling/src/pipeline/conversationSession.ts
git commit -m "feat(calling): route Plivo live audio stream through noise gate and speech booster"

# 5. Calling: Background chatter and noise suppression in barge-in detector
git add apps/calling/src/conversational/bargeInDetector.ts
git commit -m "fix(calling): suppress ambient background chatter and require 4+ words for barge-in"

# 6. Calling: Conversational engine intro continuation
git add apps/calling/src/conversational/conversationalEngine.ts
git commit -m "fix(calling): continue intro smoothly without interruption on early greetings"

# 7. Calling: Audio filter unit tests
git add apps/calling/test/audioFilter.test.ts
git commit -m "test(calling): add unit tests for noise gate attenuation and speech gain booster"

# 8. Calling: Test file identifier fixes
git add apps/calling/test/recordingConfig.test.ts
git commit -m "test(calling): fix exported variable identifier in recordingConfig test"

git add apps/calling/test/recordingValidator.test.ts
git commit -m "test(calling): fix exported variable identifier in recordingValidator test"

git add apps/calling/test/recordingWebhookDispatcher.test.ts
git commit -m "test(calling): fix exported variable identifier in recordingWebhookDispatcher test"

git add scripts/commit-audio-and-recording-fixes.ps1
git commit -m "chore(scripts): automation script for audio sensitivity and latency commits"

Write-Host "All commits created successfully!" -ForegroundColor Green
git log --oneline -10
