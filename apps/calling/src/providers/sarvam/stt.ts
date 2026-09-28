import { SarvamAIClient } from "sarvamai";
import { env } from "../../config/env.js";

delete (globalThis as any).WebSocket;

const KEY = env.sarvamApiKey;
const sarvam = new SarvamAIClient({ apiSubscriptionKey: KEY });

export interface SttHandlers {
  onSpeechStart?: () => void;
  onPartial?: (text: string) => void;
  onFinal: (text: string, language?: string) => void;
  onError?: (message: string) => void;
}

export interface SttSession {
  sendAudio: (mulawChunk: Buffer) => void;
  close: () => void;
}

// Opens ONE realtime STT connection for ONE call.
// Sarvam's own voice-activity detection decides when the caller's turn ends:
// that moment arrives as a "transcript.final" message.
export async function openSttSession(handlers: SttHandlers): Promise<SttSession> {
  console.log(`[stt.ts] openSttSession: connecting with key ${KEY.slice(0, 8)}...${KEY.slice(-4)}`);
  const socket = await sarvam.speechToTextRealtimeStreaming.connect({
    language_code: "auto",
    model: "saaras:v3-realtime",
    encoding: "mulaw",
    sample_rate: "8000",
    endpointing: "vad",
    "Api-Subscription-Key": KEY,
    debug: false,
  });

  socket.on("message", (msg) => {
    console.log(`[stt.ts] raw message:`, JSON.stringify(msg));
    switch ((msg as any).event) {
      case "session.begin":
        console.log(`[stt.ts] ✅ session.begin received — key accepted!`);
        break;
      case "vad.speech_start":
        handlers.onSpeechStart?.();
        break;
      case "transcript.partial":
        handlers.onPartial?.((msg as any).text);
        break;
      case "transcript.final":
        handlers.onFinal((msg as any).text, (msg as any).language);
        break;
      case "error":
        console.error(`[stt.ts] ❌ Sarvam error event:`, JSON.stringify(msg));
        handlers.onError?.(`${(msg as any).code}: ${(msg as any).message}`);
        break;
      default:
        break;
    }
  });

  socket.on("error", (err) => handlers.onError?.(err.message));

  // NOTE: do NOT call socket.connect() here. The SDK already opens the connection.
  await socket.waitForOpen();

  return {
    sendAudio: (chunk) => {
      if (socket.readyState !== 1) return; // 1 = OPEN
      socket.sendRealtimeAudioInput({
        event: "audio_input",
        audio: chunk.toString("base64"),
      });
    },
    close: () => socket.close(),
  };
}
