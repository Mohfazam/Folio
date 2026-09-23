import WebSocket from "ws";
import { env } from "../../config/env";

// Opens a connection to Sarvam's TTS endpoint.
// onAudioChunk fires every time Sarvam sends back a piece of generated speech.
export function connectSarvamTTS(onAudioChunk: (chunk: Buffer) => void): WebSocket {
  const url = "wss://api.sarvam.ai/text-to-speech/ws?model=bulbul:v2";

  const ws = new WebSocket(url, {
    headers: { "API-SUBSCRIPTION-KEY": env.sarvamApiKey },
  });

  ws.on("open", () => console.log("Sarvam TTS connected"));

  ws.on("message", (data) => {
    // TODO: confirm exact response shape (likely base64 audio chunks) once testing starts
    onAudioChunk(data as Buffer);
  });

  ws.on("error", (err) => console.error("Sarvam TTS error:", err));
  ws.on("close", () => console.log("Sarvam TTS connection closed"));

  return ws;
}

export function sendTextToSpeak(ws: WebSocket, text: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ text }));
  }
}
