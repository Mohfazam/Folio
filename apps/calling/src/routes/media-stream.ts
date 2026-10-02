import type { Server } from "node:http";
import PlivoWebSocketServer from "plivo-stream-sdk-node";
import {
  createConversationSession,
  type ConversationSession,
} from "../pipeline/conversationSession.js";

import { activeCallRegistry } from "../session/ActiveCallRegistry.js";
import { plivoClient } from "../providers/plivo/client.js";
import { metricsCollector } from "../monitoring/metricsCollector.js";

// The live-audio WebSocket endpoint. Plivo connects here once per call.
export function attachMediaStream(server: Server) {
  // one ConversationSession per live call, keyed by that call's websocket
  const sessions = new WeakMap<object, ConversationSession>();

  const plivoServer = new PlivoWebSocketServer({ server, path: "/media-stream" });

  plivoServer
    .onStart((event, ws) => {
      const { callId, mediaFormat } = event.start;
      console.log(`[call ${callId.slice(0, 8)}] stream started`, mediaFormat);
      metricsCollector.recordCallConnected();

      const activeRecord = activeCallRegistry.get(callId);
      const instructions = activeRecord?.sessionState?.instructions;
      const language = activeRecord?.sessionState?.language;
      const greetingText = activeRecord?.sessionState?.greetingText;

      if (instructions) {
        console.log(`[call ${callId.slice(0, 8)}] 📜 Loaded system prompt (${instructions.length} chars)`);
      }
      if (greetingText) {
        console.log(`[call ${callId.slice(0, 8)}] 🗣️ Initial greeting: "${greetingText}"`);
      }

      const session = createConversationSession(
        callId,
        {
          playAudio: (mulawChunk) => {
            plivoServer.playAudio(ws, "audio/x-mulaw", 8000, mulawChunk);
          },
          clearAudio: () => {
            try {
              plivoServer.clearAudio(ws);
            } catch (err: any) {
              console.warn(`[call ${callId.slice(0, 8)}] clearAudio warning:`, err?.message ?? err);
            }
          },
          hangup: async (reason?: string) => {
            console.log(`[call ${callId.slice(0, 8)}] 🛑 Auto-hangup executing: "${reason || "call ended"}". Terminating Plivo call...`);
            try {
              // Hangup the Plivo call first, THEN close the session.
              // Closing the session first could abort the outgoing HTTP request.
              await plivoClient.calls.hangup(callId);
            } catch (err: any) {
              console.warn(`[call ${callId.slice(0, 8)}] Plivo hangup error:`, err?.message ?? err);
            } finally {
              session.close();
            }
          },
        },
        {
          instructions,
          language,
          greetingText,
          sessionState: activeRecord?.sessionState,
        }
      );

      sessions.set(ws, session);
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
