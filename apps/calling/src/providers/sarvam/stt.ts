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
  onClose?: (code?: number, reason?: string) => void;
}

export interface SttSession {
  sendAudio: (mulawChunk: Buffer) => boolean;
  close: () => void;
}

// Opens ONE realtime STT connection for ONE call.
// Sarvam's own voice-activity detection decides when the caller's turn ends:
// that moment arrives as a "transcript.final" message.
export async function openSttSession(handlers: SttHandlers): Promise<SttSession> {
  const socket = await sarvam.speechToTextRealtimeStreaming.connect({
    language_code: "auto",
    model: "saaras:v3-realtime",
    encoding: "mulaw",
    sample_rate: "8000",
    endpointing: "vad",
    threshold: "0.40",
    min_speech_duration_ms: "180",
    prefix_padding_ms: "200",
    silence_duration_ms: "380",
    "Api-Subscription-Key": KEY,
    debug: false,
  });

  let opened = false;
  let intentionallyClosed = false;
  let failureReported = false;
  let rejectOpenFailure: ((error: Error) => void) | null = null;
  const openFailure = new Promise<never>((_, reject) => {
    rejectOpenFailure = reject;
  });

  const reportFailure = (message: string) => {
    if (intentionallyClosed || failureReported) return;
    failureReported = true;
    const error = new Error(message);
    if (opened) handlers.onError?.(message);
    else rejectOpenFailure?.(error);
  };

  socket.on("message", (msg) => {
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
      case "transcript.final": {
        const detected =
          (msg as any).detected_language ??
          (msg as any).language_code ??
          (msg as any).language;
        handlers.onFinal((msg as any).text, detected);
        break;
      }
      case "error":
        console.error(`[stt.ts] ❌ Sarvam error event:`, JSON.stringify(msg));
        reportFailure(`${(msg as any).code}: ${(msg as any).message}`);
        break;
      default:
        break;
    }
  });

  socket.on("error", (err) => reportFailure(err.message));
  socket.on("close", (event) => {
    if (intentionallyClosed) return;
    if (opened) {
      handlers.onClose?.(event?.code, event?.reason);
    } else {
      reportFailure("Sarvam STT WebSocket closed before opening");
    }
  });

  // NOTE: do NOT call socket.connect() here. The SDK already opens the connection.
  let openTimeoutTimer: NodeJS.Timeout | null = null;
  const openTimeout = new Promise<never>((_, reject) => {
    openTimeoutTimer = setTimeout(() => reject(new Error("Sarvam STT connect timeout (3500ms)")), 3500);
    openTimeoutTimer.unref();
  });
  try {
    await Promise.race([socket.waitForOpen(), openFailure, openTimeout]);
    opened = true;
  } catch (error) {
    intentionallyClosed = true;
    try {
      socket.close();
    } catch {
      // The socket may already have closed while its connection was opening.
    }
    throw error;
  } finally {
    if (openTimeoutTimer) clearTimeout(openTimeoutTimer);
  }

  return {
    sendAudio: (chunk) => {
      if (socket.readyState !== 1) return false; // 1 = OPEN
      try {
        socket.sendRealtimeAudioInput({
          event: "audio_input",
          audio: chunk.toString("base64"),
        });
        return true;
      } catch (error) {
        reportFailure(error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    close: () => {
      intentionallyClosed = true;
      socket.close();
    },
  };
}
