import { openSttSession, type SttSession } from "../providers/sarvam/stt.js";

export interface ConversationSession {
  handleAudio: (mulawChunk: Buffer) => void;
  close: () => void;
}

const MAX_BUFFERED_CHUNKS = 500; // ~10 seconds of 20 ms chunks

// One instance per live call.
// Step 1+2 only: audio in -> Sarvam STT -> log transcripts. (Gemini + TTS come next.)
export function createConversationSession(callId: string): ConversationSession {
  const tag = `[call ${callId.slice(0, 8)}]`;
  let stt: SttSession | null = null;
  let closed = false;
  const pending: Buffer[] = []; // audio that arrives while STT is still connecting

  openSttSession({
    onSpeechStart: () => console.log(`${tag} caller started speaking`),
    onPartial: (text) => console.log(`${tag} ...${text}`),
    onFinal: (text, language) => console.log(`${tag} CALLER SAID (${language ?? "?"}): ${text}`),
    onError: (message) => console.error(`${tag} STT error: ${message}`),
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
      stt?.close();
      console.log(`${tag} session closed`);
    },
  };
}
