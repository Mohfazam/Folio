// src/test-sarvam-tts.ts
import { SarvamAIClient } from "sarvamai";
import fs from "fs";
import { env } from "./config/env";

const client = new SarvamAIClient({ apiSubscriptionKey: env.sarvamApiKey });

async function testSpeech() {
  const response = await client.textToSpeech.convert({
    text: "नमस्ते, यह एक परीक्षण है।",
    language_code: "hi-IN",
    model: "bulbul:v3",
    speaker: "shubh", // default v3 voice
  });

  const audioBase64 = response.audios[0];
  if (!audioBase64) {
    throw new Error("No audio returned from Sarvam TTS");
  }

  fs.writeFileSync("test-output.wav", Buffer.from(audioBase64, "base64"));
  console.log("Audio saved to test-output.wav");
}

testSpeech().catch((err) => console.error("Sarvam TTS error:", err));