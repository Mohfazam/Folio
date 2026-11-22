import { performance } from "node:perf_hooks";
import { openSttSession, type SttSession } from "../providers/sarvam/stt.js";
import { generateReplyStream } from "../providers/gemini/generateReply.js";
import { convertTextToSpeech, openSarvamTtsStream, type StreamingTtsSession } from "../providers/sarvam/tts.js";
import { metricsCollector } from "../monitoring/metricsCollector.js";
import { normalizeLanguageCode, detectLanguageFromText } from "../utils/language.js";
import { SilenceWatchdog } from "../conversational/silenceWatchdog.js";
import { buildOpeningIntro } from "../conversational/introManager.js";
import { ConversationalEngine } from "../conversational/conversationalEngine.js";
import { getRandomLatencyFiller } from "../conversational/latencyFiller.js";

import type { CallSessionState } from "../session/CallSessionState.js";

export interface SessionCallbacks {
  playAudio: (mulawChunk: Buffer) => void;
  clearAudio: () => void;
  hangup?: (reason?: string) => void;
}

export interface ConversationSession {
  handleAudio: (mulawChunk: Buffer) => void;
  close: () => void;
}

export interface ConversationSessionOptions {
  instructions?: string;
  language?: string;
  greetingText?: string;
  speaker?: string;
  speechRate?: number;
  sessionState?: CallSessionState;
}

const MAX_BUFFERED_CHUNKS = 500; // ~10 seconds of 20ms chunks
const MAX_CALL_DURATION_MS = 12 * 60 * 1000; // 12 minutes (Plivo limit is 15min)
const STT_RECONNECT_MAX_ATTEMPTS = 2;
const STT_RECONNECT_DELAY_MS = 1500;
const EMPTY_REPLY_FALLBACK = "I'm sorry, I didn't catch that. Could you please repeat?";

function isNoiseOrFiller(text: string): boolean {
  const clean = text.replace(/\[.*?\]/g, "").replace(/[^\w\s]/g, "").trim().toLowerCase();
  if (!clean) return true; // pure punctuation or tags like [noise]
  if (clean.length <= 2 && !["no", "hi", "ok", "ya"].includes(clean)) return true;
  if (["uh", "um", "ah", "er", "hmm", "hm", "mhm", "huh"].includes(clean)) return true;
  return false;
}

// One instance per live call:
// 1. Caller speaks -> Sarvam STT transcribes.
// 2. STT final transcript -> Gemini generates conversational reply.
// 3. Reply text -> Sarvam TTS generates 8kHz mu-law audio.
// 4. Audio buffer -> Plivo playAudio outputs sound to the caller's phone.
// 5. Caller interruption (barge-in) -> cancels ongoing AI speech and clears Plivo queue.
export function createConversationSession(
  callId: string,
  callbacks: SessionCallbacks,
  options?: ConversationSessionOptions
): ConversationSession {
  const tag = `[call ${callId.slice(0, 8)}]`;
  let stt: SttSession | null = null;
  let closed = false;
  let generationId = 0; // increments on each turn to invalidate stale/interrupted responses
  let activeTurn: AbortController | null = null;
  let turnInProgress = false; // serialize turns to prevent history corruption
  let queuedTurn: { text: string; language?: string } | null = null;
  let sttReconnectAttempts = 0;
  let greetingStarted = false;
  let greetingDelivered = false;
  let currentLanguage = normalizeLanguageCode(options?.language ?? options?.sessionState?.language);
  const speaker = options?.speaker ?? options?.sessionState?.voiceId ?? "priya";
  const speechRate = typeof options?.speechRate === "number"
    ? Math.max(0.8, Math.min(1.2, options.speechRate))
    : options?.sessionState?.speechRate ?? 1;

  let silenceWatchdog: SilenceWatchdog | null = null;
  const conversationalEngine = new ConversationalEngine({
    persona: options?.sessionState?.context?.business?.aiPersonaName || "Aarohi",
    businessName: options?.sessionState?.context?.business?.displayName || "Foolioo",
    language: currentLanguage,
  });

  const pending: Buffer[] = []; // audio buffered while STT connection establishes
  const history: { role: "user" | "assistant"; content: string }[] = [];

  const sessionStartTime = performance.now();

  silenceWatchdog = new SilenceWatchdog(
    {
      onNudge: async (promptText) => {
        if (closed || turnInProgress) return;
        metricsCollector.recordSilencePromptTriggered();
        console.log(`${tag} ⏱️ Silence watchdog nudging caller: "${promptText}"`);
        try {
          const audio = await convertTextToSpeech(promptText, {
            speaker,
            languageCode: currentLanguage,
            pace: speechRate,
          });
          if (!closed && !turnInProgress) {
            callbacks.playAudio(audio);
            history.push({ role: "assistant", content: promptText });
            silenceWatchdog?.pause(Math.round((audio.length / 8000) * 1000) + 5000);
          }
        } catch (e: any) {
          console.warn(`${tag} Silence prompt TTS error:`, e?.message ?? e);
        }
      },
      onHangup: async (exitText) => {
        if (closed) return;
        console.log(`${tag} ⏱️ Silence watchdog terminating call due to persistent silence (>45s)`);
        try {
          const audio = await convertTextToSpeech(exitText, {
            speaker,
            languageCode: currentLanguage,
            pace: speechRate,
          });
          if (!closed) {
            callbacks.playAudio(audio);
          }
        } catch {}
        setTimeout(() => {
          if (!closed) callbacks.hangup?.("Call ended due to persistent caller silence");
        }, 3000);
      },
    },
    { nudgeTimeoutMs: 5000, language: currentLanguage }
  );

  // ── Safety: max call duration timer ─────────────────────────────
  // If auto-hangup never triggers (edge case), force-terminate the call
  // before Plivo's 15-minute hard limit to cleanly deliver results.
  const maxDurationTimer = setTimeout(() => {
    if (!closed) {
      console.warn(`${tag} ⏰ MAX CALL DURATION (${MAX_CALL_DURATION_MS / 60000}min) reached — forcing hangup`);
      metricsCollector.recordMaxDurationHangup();
      options?.sessionState?.recordError("plivo", "plivo_disconnect", "Max call duration exceeded");
      callbacks.hangup?.("Maximum call duration exceeded");
    }
  }, MAX_CALL_DURATION_MS);
  maxDurationTimer.unref();

  // ── Warm Persistent Streaming TTS WebSocket ──────────────────────
  // Keep an authenticated, configured TTS WebSocket alive across turns
  // to eliminate the 400-800ms connection handshake delay on caller replies.
  let warmTts: StreamingTtsSession | null = null;
  let warmTtsPromise: Promise<StreamingTtsSession> | null = null;

  async function getWarmTtsStream(): Promise<StreamingTtsSession> {
    if (warmTts && warmTts.isReady()) {
      return warmTts;
    }
    if (warmTtsPromise) {
      try {
        return await warmTtsPromise;
      } catch {
        // failed, retry below
      }
    }
    warmTtsPromise = openSarvamTtsStream(() => {}, {
      speaker,
      languageCode: currentLanguage,
      pace: speechRate,
    });
    try {
      warmTts = await warmTtsPromise;
      return warmTts;
    } finally {
      warmTtsPromise = null;
    }
  }

  // Pre-connect streaming TTS WebSocket at session start alongside STT
  void getWarmTtsStream().catch((e) => console.warn(`${tag} Warm TTS pre-connect notice:`, e?.message ?? e));

  // Plays a welcome greeting and introduction when the call connects
  async function speakGreeting() {
    if (greetingStarted || closed) return;
    greetingStarted = true;

    // Highest priority: client's campaign opening greeting or configured custom greeting
    const greetingText =
      options?.sessionState?.greetingText?.trim() ||
      options?.greetingText?.trim() ||
      buildOpeningIntro({
        contactName: options?.sessionState?.contactName?.trim(),
        persona: options?.sessionState?.context?.business?.aiPersonaName || "Aarohi",
        businessName: options?.sessionState?.context?.business?.displayName || "Foolioo",
        customGreeting: options?.greetingText,
        language: currentLanguage,
      });

    const currentGen = ++generationId;
    history.push({ role: "assistant", content: greetingText });
    options?.sessionState?.addAssistantTurn(greetingText);

    try {
      console.log(`${tag} 🤖 AI Greeting: "${greetingText}"`);
      // Use pre-warmed audio synthesized during phone ringing for 0ms startup delay
      const audio = options?.sessionState
        ? await options.sessionState.getGreetingAudio()
        : await convertTextToSpeech(greetingText, {
            speaker,
            languageCode: currentLanguage,
            pace: speechRate,
          });

      if (closed || (generationId !== currentGen && greetingDelivered)) {
        // If caller already spoke and greeting was superseded, clean up
        if (history.length > 0 && history[history.length - 1]?.content === greetingText) {
          history.pop();
        }
        return;
      }

      console.log(`${tag} 🔊 Playing greeting to caller (${audio.length} bytes)`);
      callbacks.playAudio(audio);
      greetingDelivered = true;
      conversationalEngine.markIntroCompleted();
      conversationalEngine.setLastAssistantReply(greetingText);
      const greetingDurationMs = Math.round((audio.length / 8000) * 1000);
      silenceWatchdog?.pause(greetingDurationMs + 5000);
      options?.sessionState?.recordGreetingPlayed(Math.round(performance.now() - sessionStartTime));
    } catch (err: any) {
      console.error(`${tag} Greeting error:`, err?.message ?? err);
      options?.sessionState?.recordError("tts", "tts_synthesis", err?.message ?? "Greeting error");
      // Automatic retry with concise greeting fallback to prevent silent calls
      try {
        const fallbackText = "Hello! Can you hear me okay?";
        const retryAudio = await convertTextToSpeech(fallbackText, {
          speaker,
          languageCode: currentLanguage,
          pace: speechRate,
        });
        if (!closed) {
          callbacks.playAudio(retryAudio);
          greetingDelivered = true;
          conversationalEngine.markIntroCompleted();
          silenceWatchdog?.reset();
        }
      } catch (retryErr: any) {
        console.error(`${tag} Greeting retry also failed:`, retryErr?.message ?? retryErr);
      }
    }
  }

  async function speakImmediateResponse(responseText: string, lang: string, shouldHangup = false) {
    const currentGen = ++generationId;
    interruptForCallerSpeech();
    turnInProgress = true;
    silenceWatchdog?.reset(true);
    const cleanText = responseText.replace(/\[(?:HANGUP|END_CALL|HANG_UP)\]/gi, "").trim();
    history.push({ role: "assistant", content: cleanText });
    options?.sessionState?.addAssistantTurn(cleanText);
    conversationalEngine.setLastAssistantReply(cleanText);

    try {
      console.log(`${tag} 🤖 AI Immediate: "${cleanText}" ${shouldHangup ? "🛑 [AUTO-HANGUP]" : ""}`);
      const audio = await convertTextToSpeech(cleanText, {
        speaker,
        languageCode: lang,
        pace: speechRate,
      });

      if (!closed && generationId === currentGen) {
        callbacks.playAudio(audio);
        const immDurationMs = Math.round((audio.length / 8000) * 1000);
        silenceWatchdog?.pause(immDurationMs + 5000);
      }

      if (shouldHangup && callbacks.hangup) {
        const audioDurationMs = Math.round((audio.length / 8000) * 1000);
        const waitMs = Math.max(1200, audioDurationMs + 800);
        setTimeout(() => {
          if (!closed) callbacks.hangup?.("Call ended by edge-case handler");
        }, waitMs);
      }
    } catch (err: any) {
      console.error(`${tag} Immediate speech error:`, err?.message ?? err);
      options?.sessionState?.recordError("tts", "tts_synthesis", err?.message ?? "Immediate speech error");
    } finally {
      turnInProgress = false;
    }
  }

  // Processes caller speech turn: Gemini reply -> Sarvam TTS -> Plivo playback
  async function handleCallerTurn(userText: string, language?: string) {
    const trimmed = userText.trim();
    if (!trimmed) return;
    silenceWatchdog?.registerSpeech();

    // ── Turn serialization & fresh interrupt handling ──
    // If a turn is currently in progress and the caller speaks again,
    // interrupt the in-progress AI response immediately and prioritize this latest utterance.
    if (turnInProgress) {
      console.log(`${tag} 🔄 Interrupted ongoing turn with fresh caller utterance: "${trimmed.slice(0, 50)}..."`);
      interruptForCallerSpeech();
      queuedTurn = { text: trimmed, language };
      return;
    }
    turnInProgress = true;

    const previousLanguage = currentLanguage;
    const currentGen = ++generationId;
    const controller = new AbortController();
    const turnStartedAt = performance.now();

    // ── Dynamic language detection ──────────────────────────────
    // Priority: STT-detected language > text-based detection > previous language
    const sttDetected = language ? normalizeLanguageCode(language) : null;
    const textDetected = detectLanguageFromText(trimmed);
    const activeLanguage = sttDetected || textDetected || currentLanguage;

    // Update session-wide language if we detected an actual change
    const isLanguageSwitch = activeLanguage !== previousLanguage;
    if (isLanguageSwitch) {
      console.log(`${tag} 🌐 Language switched: ${previousLanguage} → ${activeLanguage}`);
      currentLanguage = activeLanguage;
    }

    activeTurn = controller;
    console.log(`${tag} 🗣️ Caller: "${trimmed}" (detected: ${activeLanguage})`);
    history.push({ role: "user", content: trimmed });
    options?.sessionState?.addUserTurn(trimmed, activeLanguage);

    let tts: StreamingTtsSession | null = null;
    let firstSentenceLogged = false;
    let turnAudioBytes = 0;
    let sentenceCount = 0;
    try {
      const pendingSentences: string[] = [];
      let firstAudioLogged = false;

      // Acquire warm TTS stream immediately (already connected from session start — 0ms connect delay)
      try {
        tts = await getWarmTtsStream();
        if (tts.setLanguage && isLanguageSwitch) {
          tts.setLanguage(activeLanguage);
        }
        tts.setAudioHandler((audioChunk) => {
          if (!firstAudioLogged) {
            firstAudioLogged = true;
            const audioMs = Math.round(performance.now() - turnStartedAt);
            options?.sessionState?.recordFirstAudioTime(audioMs);
            metricsCollector.recordTurnLatency(undefined, audioMs);
            console.log(`${tag} ⏱️ First audio: ${audioMs}ms after transcript final`);
          }
          turnAudioBytes += audioChunk.length;
          if (!closed && generationId === currentGen) callbacks.playAudio(audioChunk);
        });
        console.log(`${tag} ⏱️ Warm TTS active: ${Math.round(performance.now() - turnStartedAt)}ms after transcript final`);
      } catch (warmErr: any) {
        console.warn(`${tag} ⚠️ Warm TTS unavailable (${warmErr?.message}), creating fresh stream`);
        tts = null;
      }

      console.log(`${tag} 🧠 Streaming Gemini reply...`);
      const replyPromise = generateReplyStream(
        history,
        (sentence) => {
          if (closed || generationId !== currentGen) return;
          sentenceCount++;
          if (!firstSentenceLogged) {
            firstSentenceLogged = true;
            const sentenceMs = Math.round(performance.now() - turnStartedAt);
            options?.sessionState?.recordFirstSentenceTime(sentenceMs);
            metricsCollector.recordTurnLatency(sentenceMs, undefined);
            console.log(`${tag} ⏱️ First sentence: ${sentenceMs}ms after transcript final`);
          }
          if (tts) tts.sendText(sentence);
          else pendingSentences.push(sentence);
        },
        controller.signal,
        false,
        options?.instructions,
        options?.sessionState?.isPublicDemo ? "showcase" : undefined
      );
      void replyPromise.catch(() => {});

      if (!tts) {
        try {
          tts = await openSarvamTtsStream((audioChunk) => {
            if (!firstAudioLogged) {
              firstAudioLogged = true;
              const audioMs = Math.round(performance.now() - turnStartedAt);
              options?.sessionState?.recordFirstAudioTime(audioMs);
              metricsCollector.recordTurnLatency(undefined, audioMs);
              console.log(`${tag} ⏱️ First audio: ${audioMs}ms after transcript final`);
            }
            turnAudioBytes += audioChunk.length;
            if (!closed && generationId === currentGen) callbacks.playAudio(audioChunk);
          }, {
            speaker,
            languageCode: activeLanguage,
            pace: speechRate,
            signal: controller.signal,
          });
          for (const sentence of pendingSentences) tts.sendText(sentence);
        } catch (ttsErr: any) {
          console.warn(`${tag} ⚠️ Streaming TTS unavailable (${ttsErr?.message}), using batch TTS fallback`);
          tts = null;
        }
      }

      const reply = await replyPromise;

      if (closed || generationId !== currentGen) return;

      // ── Empty reply safety net: if Gemini returned nothing, speak a fallback ──
      if (!reply.trim() && sentenceCount === 0) {
        console.warn(`${tag} ⚠️ Gemini returned empty reply — speaking fallback`);
        metricsCollector.recordEmptyReplyFallback();
        options?.sessionState?.recordError("model", "model_empty", "Gemini returned empty response");
        const fallbackAudio = await convertTextToSpeech(EMPTY_REPLY_FALLBACK, {
          speaker,
          languageCode: activeLanguage,
          pace: speechRate,
        });
        if (!closed && generationId === currentGen) {
          callbacks.playAudio(fallbackAudio);
          history.push({ role: "assistant", content: EMPTY_REPLY_FALLBACK });
          options?.sessionState?.addAssistantTurn(EMPTY_REPLY_FALLBACK);
        }
        return;
      }

      if (tts) {
        await tts.finish();
      }
      if (closed || generationId !== currentGen) return;

      // If streaming TTS produced no audio bytes (or was unavailable), synthesize reply via batch TTS
      if (turnAudioBytes === 0 && reply.trim()) {
        console.warn(`${tag} ⚠️ Streaming TTS produced 0 audio bytes — activating batch TTS fallback`);
        const cleanForAudio = reply.replace(/\[(?:HANGUP|END_CALL|HANG_UP)\]/gi, "").trim();
        if (cleanForAudio) {
          const fallbackAudio = await convertTextToSpeech(cleanForAudio, {
            speaker,
            languageCode: activeLanguage,
            pace: speechRate,
          });
          if (!closed && generationId === currentGen) {
            callbacks.playAudio(fallbackAudio);
            turnAudioBytes += fallbackAudio.length;
          }
        }
      }

      // Check if conversation concluded (via [HANGUP] token or explicit exit keywords)
      // IMPORTANT:
      // 1. Never treat mid-sentence phrases or long statements as exit phrases.
      // 2. Only allow caller exit if utterance is concise (<=45 chars) with explicit intent to end.
      // 3. Prevent premature AI hallucinated [HANGUP] on early turns (require at least 3 assistant turns).
      const isExplicitCallerExit =
        trimmed.length <= 45 &&
        /\b(bye|goodbye|bye bye|byee|ok bye|okay bye|thank you bye|thanks bye|disconnect|cut the call|end the call|not interested|dont call|don't call|do not call|stop calling|remove my number|unsubscribe)\b/i.test(trimmed);

      const assistantTurns =
        options?.sessionState?.transcript.filter((t) => t.speaker === "assistant").length ??
        history.filter((h) => h.role === "assistant").length;

      const hasHangupToken = /\[(?:HANGUP|END_CALL|HANG_UP)\]/i.test(reply);
      const shouldHangup =
        (isExplicitCallerExit || (hasHangupToken && assistantTurns >= 3)) && !isLanguageSwitch;

      const cleanReply = reply.replace(/\[(?:HANGUP|END_CALL|HANG_UP)\]/gi, "").trim();

      console.log(`${tag} 🤖 AI: "${cleanReply}" ${shouldHangup ? "🛑 [AUTO-HANGUP QUEUED]" : ""}`);
      history.push({ role: "assistant", content: cleanReply });
      options?.sessionState?.addAssistantTurn(cleanReply);
      conversationalEngine.setLastAssistantReply(cleanReply);
      const turnPlaybackDurationMs = Math.round((turnAudioBytes / 8000) * 1000);
      silenceWatchdog?.pause(turnPlaybackDurationMs + 5000);

      // If call is concluded, wait for audio playback to reach the phone and hang up
      if (shouldHangup && callbacks.hangup) {
        // 8000 bytes = 1.0s of 8kHz mu-law audio
        const audioDurationMs = Math.round((turnAudioBytes / 8000) * 1000);
        const waitMs = Math.max(1200, audioDurationMs + 800);
        console.log(`${tag} ⏳ Waiting ${waitMs}ms (${audioDurationMs}ms playback + buffer) before hanging up...`);

        setTimeout(() => {
          if (!closed) {
            callbacks.hangup?.("Conversation completed by user or AI farewell");
          }
        }, waitMs);
      }
    } catch (err: any) {
      const wasAborted = controller.signal.aborted;
      controller.abort();
      if (!wasAborted) {
        console.error(`${tag} Pipeline error:`, err?.message ?? err);
        options?.sessionState?.recordError("model", "model_request", err?.message ?? "Pipeline error");
        // Safety audio fallback so caller never experiences dead air
        try {
          const fallbackAudio = await convertTextToSpeech(EMPTY_REPLY_FALLBACK, {
            speaker,
            languageCode: activeLanguage,
            pace: speechRate,
          });
          if (!closed && generationId === currentGen) {
            callbacks.playAudio(fallbackAudio);
            history.push({ role: "assistant", content: EMPTY_REPLY_FALLBACK });
          }
        } catch {}
      }
    } finally {
      tts?.close();
      if (activeTurn === controller) activeTurn = null;
      turnInProgress = false;

      // ── Process queued turn if one arrived during this turn ──
      if (queuedTurn && !closed) {
        const next = queuedTurn;
        queuedTurn = null;
        console.log(`${tag} ▶️ Processing queued turn: "${next.text.slice(0, 50)}..."`);
        handleCallerTurn(next.text, next.language);
      }
    }
  }

  function interruptForCallerSpeech() {
    generationId++;
    activeTurn?.abort();
    activeTurn = null;
    callbacks.clearAudio();
    warmTts?.setAudioHandler(() => {});
  }

  // ── STT Connection with auto-reconnect ─────────────────────────
  async function connectStt() {
    try {
      const session = await openSttSession({
        onSpeechStart: () => {
          silenceWatchdog?.reset(true);
          console.log(`${tag} ⚡ Speech detected; waiting for transcript confirmation`);
        },
        onPartial: (text) => {
          // Do not barge-in before the opening greeting has actually started playing
          if (!greetingDelivered) return;
          const trimmed = text?.trim();
          if (!trimmed || isNoiseOrFiller(trimmed)) return;

          // Prevent acoustic echo: ignore if STT is hearing the AI's own recent words
          const lastAssistant = conversationalEngine.getState().lastAssistantReply || "";
          if (lastAssistant && lastAssistant.toLowerCase().includes(trimmed.toLowerCase()) && trimmed.length > 5) {
            return;
          }

          // Do not interrupt on passive backchannels ("haan", "hmm") or early intro greetings
          const action = conversationalEngine.evaluateUtterance(trimmed, currentLanguage);
          if (action.type === "ignore_filler" || action.type === "continue_intro") {
            return;
          }

          // Fast conversational barge-in: any intentional caller speech stops AI speech immediately
          silenceWatchdog?.reset(true);
          interruptForCallerSpeech();
          console.log(`${tag} 🛑 Caller interrupted (barge-in): "${trimmed}"`);
        },
        onFinal: (text, language) => {
          silenceWatchdog?.registerSpeech();
          const finalTrimmed = text?.trim() || "";
          if (!finalTrimmed || isNoiseOrFiller(finalTrimmed)) {
            return;
          }

          const activeLang = language || currentLanguage;
          const action = conversationalEngine.evaluateUtterance(finalTrimmed, activeLang);

          if (action.type === "ignore_filler") {
            metricsCollector.recordBackchannelIgnored();
            console.log(`${tag} 🔇 Ignored passive backchannel: "${finalTrimmed}"`);
            return;
          }

          if (action.type === "continue_intro") {
            console.log(`${tag} 🗣️ Early greeting during intro ("${finalTrimmed}") — allowing intro to finish`);
            return;
          }

          greetingDelivered = true;
          conversationalEngine.markIntroCompleted();

          if (action.type === "audibility_check") {
            metricsCollector.recordAudibilityCheck();
            console.log(`${tag} 🔍 Audibility verification triggered: "${finalTrimmed}"`);
            speakImmediateResponse(action.replyText, activeLang, false);
            return;
          }

          if (action.type === "busy_callback") {
            metricsCollector.recordBusyCallback();
            console.log(`${tag} 📅 Busy / Callback requested: "${finalTrimmed}"`);
            speakImmediateResponse(action.replyText, activeLang, true);
            return;
          }

          if (action.type === "opt_out") {
            metricsCollector.recordOptOutTriggered();
            console.log(`${tag} 🛑 Caller requested opt-out: "${finalTrimmed}"`);
            options?.sessionState?.markOptOut();
            speakImmediateResponse(action.replyText, activeLang, true);
            return;
          }

          if (action.type === "ai_disclosure") {
            console.log(`${tag} 🤖 AI disclosure inquiry: "${finalTrimmed}"`);
            speakImmediateResponse(action.replyText, activeLang, false);
            return;
          }

          if (action.type === "hold_wait") {
            console.log(`${tag} ⏸️ Caller requested hold/wait: "${finalTrimmed}"`);
            silenceWatchdog?.pause(25000);
            speakImmediateResponse(action.replyText, activeLang, false);
            return;
          }

          if (action.type === "repeat_request") {
            console.log(`${tag} 🔁 Caller requested repeat: "${finalTrimmed}"`);
            speakImmediateResponse(action.replyText, activeLang, false);
            return;
          }

          if (action.type === "transfer_agent") {
            console.log(`${tag} 👤 Caller requested human transfer: "${finalTrimmed}"`);
            options?.sessionState?.markHumanTransfer();
            speakImmediateResponse(action.replyText, activeLang, false);
            return;
          }

          if (action.type === "clarification") {
            console.log(`${tag} 💡 Clarification requested: "${finalTrimmed}"`);
            speakImmediateResponse(action.replyText, activeLang, false);
            return;
          }

          if (action.type === "escalation_warning") {
            console.warn(`${tag} ⚠️ Profanity/abuse detected (hangup: ${action.shouldHangup}): "${finalTrimmed}"`);
            speakImmediateResponse(action.replyText, activeLang, action.shouldHangup);
            return;
          }

          // Passthrough to conversational LLM pipeline
          interruptForCallerSpeech();
          handleCallerTurn(finalTrimmed, language);
        },
        onError: (message) => {
          console.error(`${tag} STT error: ${message}`);
          options?.sessionState?.recordError("stt", "stt_stream", message);
        },
        onClose: (code, reason) => {
          console.warn(`${tag} ⚠️ STT socket closed (code=${code}, reason=${reason ?? "unknown"})`);
          if (!closed && sttReconnectAttempts < STT_RECONNECT_MAX_ATTEMPTS) {
            stt = null;
            sttReconnectAttempts++;
            metricsCollector.recordSttReconnect();
            console.warn(`${tag} 🔄 STT dropped unexpectedly — reconnecting (${sttReconnectAttempts}/${STT_RECONNECT_MAX_ATTEMPTS}) in ${STT_RECONNECT_DELAY_MS}ms...`);
            setTimeout(() => {
              if (!closed) connectStt();
            }, STT_RECONNECT_DELAY_MS);
          }
        },
      });

      if (closed) {
        session.close();
        return;
      }

      stt = session;
      sttReconnectAttempts = 0; // reset on successful connect
      options?.sessionState?.recordSttConnectTime(Math.round(performance.now() - sessionStartTime));
      console.log(`${tag} STT connected, flushing ${pending.length} buffered chunks`);
      for (const chunk of pending) session.sendAudio(chunk);
      pending.length = 0;
    } catch (err: any) {
      console.error(`${tag} could not open STT:`, err?.message ?? err);
      options?.sessionState?.recordError("stt", "stt_connection", err?.message ?? "STT connection failed");

      // ── Auto-reconnect logic ──
      if (!closed && sttReconnectAttempts < STT_RECONNECT_MAX_ATTEMPTS) {
        sttReconnectAttempts++;
        metricsCollector.recordSttReconnect();
        console.warn(`${tag} 🔄 Attempting STT reconnect (${sttReconnectAttempts}/${STT_RECONNECT_MAX_ATTEMPTS}) in ${STT_RECONNECT_DELAY_MS}ms...`);
        setTimeout(() => {
          if (!closed) connectStt();
        }, STT_RECONNECT_DELAY_MS);
      } else if (!closed) {
        console.warn(`${tag} ⚠️ STT reconnect attempts reached limit — cooling down and retrying in 4s (call stays connected)`);
        sttReconnectAttempts = 0;
        setTimeout(() => {
          if (!closed) connectStt();
        }, 4000);
      }
    }
  }

  // Parallel initialization: deliver opening greeting AND connect STT immediately
  speakGreeting();
  connectStt();

  return {
    handleAudio(chunk) {
      if (stt) {
        stt.sendAudio(chunk);
      } else if (pending.length < MAX_BUFFERED_CHUNKS) {
        pending.push(chunk);
      }
    },
    close() {
      if (closed) return; // idempotent
      closed = true;
      clearTimeout(maxDurationTimer);
      silenceWatchdog?.stop();
      generationId++;
      activeTurn?.abort();
      callbacks.clearAudio();
      warmTts?.close();
      stt?.close();
      const durationSec = ((performance.now() - sessionStartTime) / 1000).toFixed(1);
      console.log(`${tag} session closed (duration: ${durationSec}s, turns: ${history.length})`);
    },
  };
}
