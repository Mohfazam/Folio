import type { Server } from "node:http";
import PlivoWebSocketServer from "plivo-stream-sdk-node";
import { MEDIA_STREAM_PATH } from "../config/paths.js";
import {
  createConversationSession,
  type ConversationSession,
} from "../pipeline/conversationSession.js";

// The live-audio WebSocket endpoint. Plivo connects here once per call.
export function attachMediaStream(server: Server) {
  // one ConversationSession per live call, keyed by that call's websocket
  const sessions = new WeakMap<object, ConversationSession>();

  new PlivoWebSocketServer({ server, path: MEDIA_STREAM_PATH })
    .onStart((event, ws) => {
      const { callId, mediaFormat } = event.start;
      console.log(`[call ${callId.slice(0, 8)}] stream started`, mediaFormat);
      sessions.set(ws, createConversationSession(callId));
    })
    .onMedia((event, ws) => {
      sessions.get(ws)?.handleAudio(event.getRawMedia());
    })
    .onError((error) => console.error("Plivo stream error:", error.message))
    .onClose((ws) => {
      sessions.get(ws)?.close();
      sessions.delete(ws);
    })
    .start();
}
