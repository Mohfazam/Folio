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
  const response = await sarvam.textToSpeech.convert({
    text,
    model: "bulbul:v3",
    language_code: (options?.languageCode as any) ?? "en-IN",
    speaker: (options?.speaker as any) ?? "priya",
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
      completed = true;
      resolveCompletion();
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
    socket.close();
  };
  options?.signal?.addEventListener("abort", abort, { once: true });

  socket.configureConnection({
    language_code: (options?.languageCode as any) ?? "en-IN",
    speaker: (options?.speaker as any) ?? "priya",
    speech_sample_rate: 8000,
    output_audio_codec: "mulaw",
    min_buffer_size: 30,
  });

  return {
    sendText(text) {
      if (!completed && !options?.signal?.aborted) socket.convert(text);
    },
    async finish() {
      if (!finishCalled && !completed) {
        finishCalled = true;
        socket.flush();
      }
      await completion;
    },
    close() {
      options?.signal?.removeEventListener("abort", abort);
      if (!completed) fail(new Error("TTS stream closed before completion"));
      socket.close();
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
    close() {
      // No persistent socket to close; the SDK call is one-shot.
    },
  };
}

export function sendTextToSpeak(ws: TtsSocket | null | undefined, text: string) {
  if (!ws || typeof ws.sendText !== "function") {
    return;
  }

  return ws.sendText(text);
}

