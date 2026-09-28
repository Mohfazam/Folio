import { SarvamAIClient } from "sarvamai";
import { env } from "../../config/env.js";

const sarvam = new SarvamAIClient({ apiSubscriptionKey: env.sarvamApiKey });

export type TtsSocket = {
  sendText: (text: string) => Promise<void> | void;
  close?: () => void;
};

// Uses the official SDK instead of a raw WebSocket so the same API key is used
// consistently across the app. The returned object keeps the old call-site API
// shape (`sendTextToSpeak(ttsSocket, text)`) while delegating to the SDK.
export function connectSarvamTTS(onAudioChunk: (chunk: Buffer) => void): TtsSocket {
  return {
    async sendText(text: string) {
      const response = await sarvam.textToSpeech.convert({
        text,
        model: "bulbul:v3",
        language_code: "en-IN",
        speaker: "anushka",
      });

      const audioBase64 = response.audios[0];
      if (!audioBase64) {
        throw new Error("No audio returned from Sarvam TTS");
      }

      onAudioChunk(Buffer.from(audioBase64, "base64"));
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
