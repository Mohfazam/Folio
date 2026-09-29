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

const MAX_BUFFERED_CHUNKS = 500; // ~10 seconds of 20ms chunks

// One instance per live call:
// 1. Caller speaks -> Sarvam STT transcribes.
// 2. STT final transcript -> Gemini generates conversational reply.
// 3. Reply text -> Sarvam TTS generates 8kHz mu-law audio.
// 4. Audio buffer -> Plivo playAudio outputs sound to the caller's phone.
// 5. Caller interruption (barge-in) -> cancels ongoing AI speech and clears Plivo queue.
export function createConversationSession(
  callId: string,
  callbacks: SessionCallbacks
): ConversationSession {
  const tag = `[call ${callId.slice(0, 8)}]`;
  let stt: SttSession | null = null;
  let closed = false;
  let generationId = 0; // increments on each turn to invalidate stale/interrupted responses
  let activeTurn: AbortController | null = null;
  const pending: Buffer[] = []; // audio buffered while STT connection establishes
  const history: { role: "user" | "assistant"; content: string }[] = [];

  // Plays a welcome greeting when the call connects
  async function speakGreeting() {
    const greetingText = "Hello! How can I help you today?";
    const currentGen = ++generationId;
    history.push({ role: "assistant", content: greetingText });

    try {
      console.log(`${tag} 🤖 AI Greeting: "${greetingText}"`);
      const audio = await convertTextToSpeech(greetingText, {
        speaker: "priya",
        languageCode: "en-IN",
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
    activeTurn = controller;
    console.log(`${tag} 🗣️ Caller: "${trimmed}" (${language ?? "auto"})`);
    history.push({ role: "user", content: trimmed });

    let tts: Awaited<ReturnType<typeof openSarvamTtsStream>> | null = null;
    try {
      const pendingSentences: string[] = [];
      const ttsPromise = openSarvamTtsStream((audioChunk) => {
        if (!closed && generationId === currentGen) callbacks.playAudio(audioChunk);
      }, {
        speaker: "priya",
        languageCode: language?.startsWith("hi") ? "hi-IN" : "en-IN",
        signal: controller.signal,
      });

      console.log(`${tag} 🧠 Streaming Gemini reply...`);
      const replyPromise = generateReplyStream(history, (sentence) => {
        if (closed || generationId !== currentGen) return;
        if (tts) tts.sendText(sentence);
        else pendingSentences.push(sentence);
      }, controller.signal);
      void replyPromise.catch(() => {});

      tts = await ttsPromise;
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

  // Connects realtime STT to Sarvam
  openSttSession({
    onSpeechStart: () => {
      console.log(`${tag} ⚡ Caller started speaking (barge-in)`);
      // Interrupt any current AI speech immediately
      generationId++;
      activeTurn?.abort();
      callbacks.clearAudio();
    },
    onPartial: (text) => {
      if (text?.trim()) {
        console.log(`${tag} ... ${text.trim()}`);
      }
    },
    onFinal: (text, language) => {
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
