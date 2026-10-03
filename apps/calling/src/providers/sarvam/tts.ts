// In Node 22+, globalThis.WebSocket drops custom headers in constructor.
// Deleting it forces sarvamai SDK to use the 'ws' package with full header support.
delete (globalThis as any).WebSocket;

import { SarvamAIClient } from "sarvamai";
import { env } from "../../config/env.js";

const sarvam = new SarvamAIClient({ apiSubscriptionKey: env.sarvamApiKey });

export interface TextToSpeechOptions {
  speaker?: "priya" | "shubh" | "aditya" | "ritu" | "kavya" | string;
  languageCode?: string;
}

/**
 * Converts text into 8kHz mu-law audio Buffer directly compatible with Plivo phone streams.
 */
export async function convertTextToSpeech(
  text: string,
  options?: TextToSpeechOptions
): Promise<Buffer> {
  const speaker = options?.speaker ?? "priya";
  const languageCode = options?.languageCode ?? "en-IN";

  const response = await sarvam.textToSpeech.convert({
    text,
    model: "bulbul:v3",
    language_code: languageCode as any,
    speaker: speaker as any,
    output_audio_codec: "mulaw",
    speech_sample_rate: 8000,
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
  setLanguage?: (languageCode: string) => void;
}

export async function openSarvamTtsStream(
  onAudioChunk: (chunk: Buffer) => void,
  options?: TextToSpeechOptions & { signal?: AbortSignal }
): Promise<StreamingTtsSession> {
  const socket = await sarvam.textToSpeechStreaming.connect({
    model: "bulbul:v3",
    send_completion_event: "true",
  });

  let resolveCompletion!: () => void;
  let rejectCompletion!: (error: Error) => void;
  let completed = false;
  let finishCalled = false;
  let pendingFlushes = 0;

  const completion = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });
  void completion.catch(() => {});

  const fail = (error: Error) => {
    if (completed) return;
    completed = true;
    rejectCompletion(error);
  };

  socket.on("message", (message) => {
    if (message.type === "audio") {
      onAudioChunk(Buffer.from(message.data.audio, "base64"));
    } else if (message.type === "event" && message.data.event_type === "final") {
      pendingFlushes = Math.max(0, pendingFlushes - 1);
      if (finishCalled && pendingFlushes === 0 && !completed) {
        completed = true;
        resolveCompletion();
      }
    } else if (message.type === "error") {
      fail(new Error(message.data.message));
    }
  });

  socket.on("error", (error) => fail(error));
  socket.on("close", () => {
    if (!completed) fail(new Error("Sarvam TTS stream closed before completion"));
  });

  await socket.waitForOpen();
  if (options?.signal?.aborted) {
    socket.close();
    throw new Error("TTS stream aborted");
  }

  const abort = () => {
    fail(new Error("TTS stream aborted"));
    try {
      socket.close();
    } catch {
      // ignore
    }
  };
  options?.signal?.addEventListener("abort", abort, { once: true });

  const speaker = options?.speaker ?? "priya";
  const languageCode = options?.languageCode ?? "en-IN";

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
    },
  });

  return {
    sendText(text) {
      if (completed || options?.signal?.aborted) return;
      pendingFlushes++;
      try {
        socket.convert(text);
        socket.flush();
      } catch (error) {
        pendingFlushes = Math.max(0, pendingFlushes - 1);
        fail(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    },
    setLanguage(newLang: string) {
      if (completed || options?.signal?.aborted) return;
      try {
        (socket as any).sendJson({
          type: "config",
          data: {
            language_code: newLang,
            speaker,
            speech_sample_rate: 8000,
            output_audio_codec: "mulaw",
          },
        });
      } catch (e) {
        console.warn("[openSarvamTtsStream] Failed to send reconfig language:", e);
      }
    },
    async finish() {
      if (!finishCalled) {
        finishCalled = true;
        if (pendingFlushes === 0 && !completed) {
          completed = true;
          resolveCompletion();
        }
      }
      // Safety timeout: don't hang longer than 5 seconds waiting for TTS final flush
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(resolve, 5000).unref();
      });
      await Promise.race([completion, timeoutPromise]);
    },
    close() {
      options?.signal?.removeEventListener("abort", abort);
      if (!completed) fail(new Error("Sarvam TTS stream closed before completion"));
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
