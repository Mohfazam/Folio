import WebSocket from "ws";
import { env } from "../../config/env";

// Opens a connection to Sarvam's realtime STT endpoint.
// onTranscript fires every time Sarvam sends back recognized text.
export function connectSarvamSTT(onTranscript: (text: string) => void): WebSocket {
  const url = "wss://api.sarvam.ai/speech-to-text/transcribe/realtime/ws?language-code=auto";

  const ws = new WebSocket(url, {
    headers: { "API-SUBSCRIPTION-KEY": env.sarvamApiKey },
  });

  ws.on("open", () => console.log("Sarvam STT connected"));

  ws.on("message", (data) => {
    const parsed = JSON.parse(data.toString());
    // TODO: confirm exact response shape from Sarvam docs once testing starts
    if (parsed?.transcript) onTranscript(parsed.transcript);
  });

  ws.on("error", (err) => console.error("Sarvam STT error:", err));
  ws.on("close", () => console.log("Sarvam STT connection closed"));

  return ws;
}

// Forward a chunk of audio (from Plivo) into the open Sarvam connection
export function sendAudioChunk(ws: WebSocket, audioChunk: Buffer) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(audioChunk);
  }
}
