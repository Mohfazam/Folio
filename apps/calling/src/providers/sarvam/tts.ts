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

