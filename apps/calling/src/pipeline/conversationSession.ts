import { performance } from "node:perf_hooks";
import { openSttSession, type SttSession } from "../providers/sarvam/stt.js";
import { generateReplyStream } from "../providers/claude/generateReply.js";
import { convertTextToSpeech, openSarvamTtsStream } from "../providers/sarvam/tts.js";
import { metricsCollector } from "../monitoring/metricsCollector.js";
import { normalizeLanguageCode, detectLanguageFromText } from "../utils/language.js";

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
  sessionState?: CallSessionState;
}

const MAX_BUFFERED_CHUNKS = 500; // ~10 seconds of 20ms chunks
const MAX_CALL_DURATION_MS = 12 * 60 * 1000; // 12 minutes (Plivo limit is 15min)
const STT_RECONNECT_MAX_ATTEMPTS = 2;
const STT_RECONNECT_DELAY_MS = 1500;
const EMPTY_REPLY_FALLBACK = "I'm sorry, I didn't catch that. Could you please repeat?";

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
  let interruptionHandled = false;
  let turnInProgress = false; // serialize turns to prevent history corruption
  let queuedTurn: { text: string; language?: string } | null = null;
  let sttReconnectAttempts = 0;
  const pending: Buffer[] = []; // audio buffered while STT connection establishes
  const history: { role: "user" | "assistant"; content: string }[] = [];

  // ── Dynamic language tracking ──────────────────────────────────
  // Tracks the active language detected from caller speech across turns.
  // Starts with the configured language and updates per-turn from STT detection.
  let currentLanguage = normalizeLanguageCode(options?.language);

  const sessionStartTime = performance.now();

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

  // Plays a welcome greeting when the call connects
  async function speakGreeting() {
    const greetingText =
      options?.greetingText || "Hello! Thanks for taking my call. Do you have a quick moment?";
    const currentGen = ++generationId;
    history.push({ role: "assistant", content: greetingText });
    options?.sessionState?.addAssistantTurn(greetingText);

    try {
      console.log(`${tag} 🤖 AI Greeting: "${greetingText}"`);
      const audio = await convertTextToSpeech(greetingText, {
        speaker: "priya",
        languageCode: currentLanguage,
      });

      if (closed || generationId !== currentGen) return;

      console.log(`${tag} 🔊 Playing greeting to caller (${audio.length} bytes)`);
      callbacks.playAudio(audio);
      options?.sessionState?.recordGreetingPlayed(Math.round(performance.now() - sessionStartTime));
    } catch (err: any) {
      console.error(`${tag} Greeting error:`, err?.message ?? err);
      options?.sessionState?.recordError("tts", "tts_synthesis", err?.message ?? "Greeting error");
    }
  }

  // Processes caller speech turn: Gemini reply -> Sarvam TTS -> Plivo playback
  async function handleCallerTurn(userText: string, language?: string) {
    const trimmed = userText.trim();
    if (!trimmed) return;

    // ── Turn serialization: if a turn is already in progress, queue this one ──
    if (turnInProgress) {
      queuedTurn = { text: trimmed, language };
      console.log(`${tag} ⏳ Turn queued (another turn in progress): "${trimmed.slice(0, 50)}..."`);
      return;
    }
    turnInProgress = true;

    const currentGen = ++generationId;
    const controller = new AbortController();
    const turnStartedAt = performance.now();

    // ── Dynamic language detection ──────────────────────────────
    // Priority: STT-detected language > text-based detection > previous language
    const sttDetected = language ? normalizeLanguageCode(language) : null;
    const textDetected = detectLanguageFromText(trimmed);
    const activeLanguage = sttDetected || textDetected || currentLanguage;

    // Update session-wide language if we detected a change
    if (activeLanguage !== currentLanguage) {
      console.log(`${tag} 🌐 Language switched: ${currentLanguage} → ${activeLanguage}`);
      currentLanguage = activeLanguage;
    }

    activeTurn = controller;
    console.log(`${tag} 🗣️ Caller: "${trimmed}" (detected: ${activeLanguage})`);
    history.push({ role: "user", content: trimmed });
    options?.sessionState?.addUserTurn(trimmed, activeLanguage);

    let tts: Awaited<ReturnType<typeof openSarvamTtsStream>> | null = null;
    let firstSentenceLogged = false;
    let turnAudioBytes = 0;
    let sentenceCount = 0;
    try {
      const pendingSentences: string[] = [];
      let firstAudioLogged = false;
      const ttsPromise = openSarvamTtsStream((audioChunk) => {
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
        speaker: "priya",
        languageCode: activeLanguage,
        signal: controller.signal,
      });

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
        options?.instructions
      );
      void replyPromise.catch(() => {});

      tts = await ttsPromise;
      console.log(`${tag} ⏱️ TTS ready: ${Math.round(performance.now() - turnStartedAt)}ms after transcript final`);
      for (const sentence of pendingSentences) tts.sendText(sentence);
      const reply = await replyPromise;

      if (closed || generationId !== currentGen) return;

      // ── Empty reply safety net: if Gemini returned nothing, speak a fallback ──
      if (!reply.trim() && sentenceCount === 0) {
        console.warn(`${tag} ⚠️ Gemini returned empty reply — speaking fallback`);
        metricsCollector.recordEmptyReplyFallback();
        options?.sessionState?.recordError("model", "model_empty", "Gemini returned empty response");
        const fallbackAudio = await convertTextToSpeech(EMPTY_REPLY_FALLBACK, {
          speaker: "priya",
          languageCode: activeLanguage,
        });
        if (!closed && generationId === currentGen) {
          callbacks.playAudio(fallbackAudio);
          history.push({ role: "assistant", content: EMPTY_REPLY_FALLBACK });
          options?.sessionState?.addAssistantTurn(EMPTY_REPLY_FALLBACK);
        }
        return;
      }

      await tts.finish();
      if (closed || generationId !== currentGen) return;

      // Check if conversation concluded (via [HANGUP] token or explicit exit keywords)
      // IMPORTANT: Do NOT treat language-switch turns as exit phrases
      const isExitPhrase = /\b(bye|goodbye|bye bye|byee|take care|have a good day|have a nice day|that's all|thats all|that is all|nothing else|hang up|disconnect)\b/i.test(trimmed);
      const hasHangupToken = /\[(?:HANGUP|END_CALL|HANG_UP)\]/i.test(reply);
      const isLanguageSwitch = sttDetected !== null || textDetected !== null;
      const shouldHangup = (hasHangupToken || isExitPhrase) && !isLanguageSwitch;

      const cleanReply = reply.replace(/\[(?:HANGUP|END_CALL|HANG_UP)\]/gi, "").trim();

      console.log(`${tag} 🤖 AI: "${cleanReply}" ${shouldHangup ? "🛑 [AUTO-HANGUP QUEUED]" : ""}`);
      history.push({ role: "assistant", content: cleanReply });
      options?.sessionState?.addAssistantTurn(cleanReply);

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
    if (interruptionHandled) return;
    interruptionHandled = true;
    generationId++;
    activeTurn?.abort();
    callbacks.clearAudio();
  }

  // ── STT Connection with auto-reconnect ─────────────────────────
  async function connectStt() {
    try {
      const session = await openSttSession({
        onSpeechStart: () => {
          interruptionHandled = false;
          console.log(`${tag} ⚡ Speech detected; waiting for transcript confirmation`);
        },
        onPartial: (text) => {
          // Only interrupt on substantial partial transcripts (>15 chars)
          // to reduce false barge-in on brief noise / background sounds
          if (text?.trim() && text.trim().length > 15) {
            interruptForCallerSpeech();
            if (process.env.NODE_ENV !== "production") {
              console.log(`${tag} ... ${text.trim()}`);
            }
          }
        },
        onFinal: (text, language) => {
          if (text?.trim()) interruptForCallerSpeech();
          handleCallerTurn(text, language);
        },
        onError: (message) => {
          console.error(`${tag} STT error: ${message}`);
          options?.sessionState?.recordError("stt", "stt_stream", message);
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

      // Speak greeting as soon as connection is ready
      speakGreeting();
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
        console.error(`${tag} ❌ STT reconnect attempts exhausted — hanging up call`);
        callbacks.hangup?.("STT connection failed after retries");
      }
    }
  }

  // Start the STT connection
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
      generationId++;
      activeTurn?.abort();
      callbacks.clearAudio();
      stt?.close();
      const durationSec = ((performance.now() - sessionStartTime) / 1000).toFixed(1);
      console.log(`${tag} session closed (duration: ${durationSec}s, turns: ${history.length})`);
    },
  };
}
