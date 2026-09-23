// src/test-sarvam-stt.ts (temporary, delete once confirmed working)
import { SarvamAIClient } from "sarvamai";
import fs from "fs";
import { env } from "./config/env";

const client = new SarvamAIClient({ apiSubscriptionKey: env.sarvamApiKey });

async function testTranscription() {
  const audioFile = fs.createReadStream("test-audio.wav");

  const response = await client.speechToText.transcribe({
    file: audioFile,
    model: "saaras:v3",
    mode: "transcribe",
  });

  console.log("Sarvam transcribed:", response);
}

testTranscription().catch((err) => console.error("Sarvam STT error:", err));