import { performance } from "node:perf_hooks";
import { openSttSession, type SttSession } from "../providers/sarvam/stt.js";
import { generateReplyStream } from "../providers/claude/generateReply.js";
import { convertTextToSpeech, openSarvamTtsStream } from "../providers/sarvam/tts.js";

export interface SessionCallbacks {
  playAudio: (mulawChunk: Buffer) => void;
  clearAudio: () => void;
}

export interface ConversationSession {
  handleAudio: (mulawChunk: Buffer) => void;
  close: () => void;
}

export interface ConversationSessionOptions {
  instructions?: string;
  language?: string;
  greetingText?: string;
}

const MAX_BUFFERED_CHUNKS = 500; // ~10 seconds of 20ms chunks

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
  const pending: Buffer[] = []; // audio buffered while STT connection establishes
  const history: { role: "user" | "assistant"; content: string }[] = [];

  // Plays a welcome greeting when the call connects
  async function speakGreeting() {
    const greetingText = options?.greetingText || "Hello! How can I help you today?";
    const currentGen = ++generationId;
    history.push({ role: "assistant", content: greetingText });

    try {
      console.log(`${tag} 🤖 AI Greeting: "${greetingText}"`);
      const audio = await convertTextToSpeech(greetingText, {
        speaker: "priya",
        languageCode: options?.language?.startsWith("hi") ? "hi-IN" : "en-IN",
      });

      if (closed || generationId !== currentGen) return;

      console.log(`${tag} 🔊 Playing greeting to caller (${audio.length} bytes)`);
      callbacks.playAudio(audio);
    } catch (err: any) {
      console.error(`${tag} Greeting error:`, err?.message ?? err);
    }
  }

  // Processes caller speech turn: Gemini reply -> Sarvam TTS -> Plivo playback
  async function handleCallerTurn(userText: string, language?: string) {
    const trimmed = userText.trim();
    if (!trimmed) return;

    const currentGen = ++generationId;
    const controller = new AbortController();
    const turnStartedAt = performance.now();
    const activeLanguage = language || options?.language || "en-IN";
    activeTurn = controller;
    console.log(`${tag} 🗣️ Caller: "${trimmed}" (${language ?? options?.language ?? "auto"})`);
    history.push({ role: "user", content: trimmed });

    let tts: Awaited<ReturnType<typeof openSarvamTtsStream>> | null = null;
    let firstSentenceLogged = false;
    try {
      const pendingSentences: string[] = [];
      let firstAudioLogged = false;
      const ttsPromise = openSarvamTtsStream((audioChunk) => {
        if (!firstAudioLogged) {
          firstAudioLogged = true;
          console.log(`${tag} ⏱️ First audio: ${Math.round(performance.now() - turnStartedAt)}ms after transcript final`);
        }
        if (!closed && generationId === currentGen) callbacks.playAudio(audioChunk);
      }, {
        speaker: "priya",
        languageCode: activeLanguage.startsWith("hi") ? "hi-IN" : "en-IN",
        signal: controller.signal,
      });

      console.log(`${tag} 🧠 Streaming Gemini reply...`);
      const replyPromise = generateReplyStream(
        history,
        (sentence) => {
          if (closed || generationId !== currentGen) return;
          if (!firstSentenceLogged) {
            firstSentenceLogged = true;
            console.log(`${tag} ⏱️ First sentence: ${Math.round(performance.now() - turnStartedAt)}ms after transcript final`);
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

      await tts.finish();
      if (closed || generationId !== currentGen) return;

      console.log(`${tag} 🤖 AI: "${reply}"`);
      history.push({ role: "assistant", content: reply });
    } catch (err: any) {
      const wasAborted = controller.signal.aborted;
      controller.abort();
      if (!wasAborted) {
        console.error(`${tag} Pipeline error:`, err?.message ?? err);
      }
    } finally {
      tts?.close();
      if (activeTurn === controller) activeTurn = null;
    }
  }

  function interruptForCallerSpeech() {
    if (interruptionHandled) return;
    interruptionHandled = true;
    generationId++;
    activeTurn?.abort();
    callbacks.clearAudio();
  }

  // Connects realtime STT to Sarvam
  openSttSession({
    onSpeechStart: () => {
      interruptionHandled = false;
      console.log(`${tag} ⚡ Speech detected; waiting for transcript confirmation`);
    },
    onPartial: (text) => {
      if (text?.trim()) {
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
    },
  })
    .then((session) => {
      if (closed) {
        session.close();
        return;
      }
      stt = session;
      console.log(`${tag} STT connected, flushing ${pending.length} buffered chunks`);
      for (const chunk of pending) session.sendAudio(chunk);
      pending.length = 0;

      // Speak greeting as soon as connection is ready
      speakGreeting();
    })
    .catch((err) => console.error(`${tag} could not open STT:`, err));

  return {
    handleAudio(chunk) {
      if (stt) {
        stt.sendAudio(chunk);
      } else if (pending.length < MAX_BUFFERED_CHUNKS) {
        pending.push(chunk);
      }
    },
    close() {
      closed = true;
      generationId++;
      activeTurn?.abort();
      callbacks.clearAudio();
      stt?.close();
      console.log(`${tag} session closed`);
    },
  };
}
