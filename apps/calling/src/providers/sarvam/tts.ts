// In Node 22+, globalThis.WebSocket drops custom headers in constructor.
// Deleting it forces sarvamai SDK to use the 'ws' package with full header support.
delete (globalThis as any).WebSocket;

import { SarvamAIClient } from "sarvamai";
import { env } from "../../config/env.js";

const sarvam = new SarvamAIClient({ apiSubscriptionKey: env.sarvamApiKey });

export interface TextToSpeechOptions {
  /** Sarvam Bulbul v3 speaker ID. */
  speaker?: string;
  languageCode?: string;
  /** Sarvam's `pace` parameter. Bulbul v3 supports 0.5–2.0. */
  pace?: number;
}

function normalizePace(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(0.5, Math.min(2, value));
}

export function sanitizeTextForSpeech(text: string): string {
  return text
    .replace(/\[(?:HANGUP|END_CALL|HANG_UP|interrupted)\]/gi, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[*_#`~]/g, "")
    .trim();
}

/**
 * Converts text into 8kHz mu-law audio Buffer directly compatible with Plivo phone streams.
 */
export async function convertTextToSpeech(
  text: string,
  options?: TextToSpeechOptions
): Promise<Buffer> {
  const cleanText = sanitizeTextForSpeech(text);
  if (!cleanText) {
    return Buffer.alloc(0);
  }

  const speaker = options?.speaker ?? "priya";
  const languageCode = options?.languageCode ?? "en-IN";
  const pace = normalizePace(options?.pace);

  const response = await sarvam.textToSpeech.convert({
    text: cleanText,
    model: "bulbul:v3",
    language_code: languageCode as any,
    speaker: speaker as any,
    output_audio_codec: "mulaw",
    speech_sample_rate: 8000,
    pace,
  });

  const audioBase64 = response.audios[0];
  if (!audioBase64) {
    throw new Error("No audio returned from Sarvam TTS");
  }

  return Buffer.from(audioBase64, "base64");
}

export interface StreamingTtsSession {
  sendText: (text: string) => void;
  finish: () => Promise<void>;
  close: () => void;
  languageCode: string;
  setLanguage?: (languageCode: string) => void;
  setAudioHandler: (handler: (chunk: Buffer) => void) => void;
  isReady: () => boolean;
}

export async function openSarvamTtsStream(
  onAudioChunk: (chunk: Buffer) => void,
  options?: TextToSpeechOptions & { signal?: AbortSignal }
): Promise<StreamingTtsSession> {
  const socket = await sarvam.textToSpeechStreaming.connect({
    model: "bulbul:v3",
    send_completion_event: "true",
  });

  let opened = false;
  let rejectOpenFailure: ((error: Error) => void) | null = null;
  const openFailure = new Promise<never>((_, reject) => {
    rejectOpenFailure = reject;
  });
  let resolveCompletion!: () => void;
  let rejectCompletion!: (error: Error) => void;
  let closed = false;
  let finishCalled = false;
  let pendingFlushes = 0;
  let currentAudioHandler = onAudioChunk;

  let completion = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });
  void completion.catch(() => {});

  const fail = (error: Error) => {
    if (closed) return;
    closed = true;
    rejectCompletion(error);
    if (!opened) rejectOpenFailure?.(error);
  };

  const abort = () => {
    fail(new Error("TTS stream aborted"));
    try {
      socket.close();
    } catch {
      // ignore
    }
  };

  socket.on("message", (message) => {
    if (message.type === "audio") {
      currentAudioHandler(Buffer.from(message.data.audio, "base64"));
    } else if (message.type === "event" && message.data.event_type === "final") {
      pendingFlushes = Math.max(0, pendingFlushes - 1);
      if (finishCalled && pendingFlushes === 0) {
        resolveCompletion();
      }
    } else if (message.type === "error") {
      fail(new Error(message.data.message));
    }
  });

  socket.on("error", (error) => fail(error));
  socket.on("close", () => {
    if (!closed) fail(new Error("Sarvam TTS stream closed before completion"));
  });

  if (options?.signal?.aborted) {
    abort();
  } else {
    options?.signal?.addEventListener("abort", abort, { once: true });
  }
  let openTimeoutTimer: NodeJS.Timeout | null = null;
  const openTimeout = new Promise<never>((_, reject) => {
    openTimeoutTimer = setTimeout(() => reject(new Error("Sarvam TTS WebSocket connect timeout (2500ms)")), 2500);
    openTimeoutTimer.unref();
  });
  try {
    await Promise.race([socket.waitForOpen(), openFailure, openTimeout]);
    if (closed || options?.signal?.aborted) throw new Error("TTS stream aborted");
    opened = true;
  } catch (error) {
    options?.signal?.removeEventListener("abort", abort);
    try {
      socket.close();
    } catch {
      // The socket may already have closed while its connection was opening.
    }
    throw error;
  } finally {
    if (openTimeoutTimer) clearTimeout(openTimeoutTimer);
  }

  const speaker = options?.speaker ?? "priya";
  const languageCode = options?.languageCode ?? "en-IN";
  const pace = normalizePace(options?.pace);

  // Avoid socket.configureConnection() because the sarvamai SDK automatically
  // injects `min_buffer_size: 50`, which causes Sarvam's bulbul:v3 API to reject
  // the configuration with 422: "Input parameters has to be a valid dictionary".
  (socket as any).sendJson({
    type: "config",
    data: {
      language_code: languageCode,
      speaker,
      speech_sample_rate: 8000,
      output_audio_codec: "mulaw",
      pace,
    },
  });

  return {
    languageCode,
    isReady() {
      return !closed && (socket as any).readyState === 1;
    },
    setAudioHandler(handler) {
      currentAudioHandler = handler;
    },
    sendText(text) {
      if (closed || options?.signal?.aborted) return;
      const clean = sanitizeTextForSpeech(text);
      if (!clean) return;
      pendingFlushes++;
      try {
        socket.convert(clean);
        socket.flush();
      } catch (error) {
        pendingFlushes = Math.max(0, pendingFlushes - 1);
        fail(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    },
    setLanguage(_newLang: string) {
      // Sarvam Bulbul:v3 WebSocket does not support dynamic reconfiguration mid-stream;
      // callers recreate a clean stream with the new language instead.
    },
    async finish() {
      if (pendingFlushes === 0) return;
      finishCalled = true;
      // Safety timeout: give up to 8000ms for Sarvam TTS to finish streaming audio
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(resolve, 8000).unref();
      });
      await Promise.race([completion, timeoutPromise]);
      // Reset for next turn so socket stays warm across turns
      finishCalled = false;
      pendingFlushes = 0;
      completion = new Promise<void>((resolve, reject) => {
        resolveCompletion = resolve;
        rejectCompletion = reject;
      });
      void completion.catch(() => {});
    },
    close() {
      options?.signal?.removeEventListener("abort", abort);
      closed = true;
      try {
        socket.close();
      } catch {
        // ignore
      }
    },
  };
}

export type TtsSocket = {
  sendText: (text: string) => Promise<void> | void;
  close?: () => void;
};

export function connectSarvamTTS(onAudioChunk: (chunk: Buffer) => void): TtsSocket {
  return {
    async sendText(text: string) {
      const audioBuffer = await convertTextToSpeech(text);
      onAudioChunk(audioBuffer);
    },
    close() {},
  };
}

export function sendTextToSpeak(ws: TtsSocket | null | undefined, text: string) {
  if (!ws || typeof ws.sendText !== "function") return;
  return ws.sendText(text);
}
