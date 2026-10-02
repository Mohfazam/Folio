import type { Request, Response } from "express";
import { buildStreamXml } from "../providers/plivo/xml.js";
import { env } from "../config/env.js";
import { activeCallRegistry } from "../session/ActiveCallRegistry.js";

// Plivo calls this the moment the recipient picks up: "what should I do with this call?"
// Our answer: "open a live audio stream to my /media-stream WebSocket."
export function plivoVoiceRoute(req: Request, res: Response) {
  const data = { ...req.query, ...req.body };
  const callUuid = (data.CallUUID as string) || (data.call_uuid as string) || "";
  const requestUuid = (data.RequestUUID as string) || (data.request_uuid as string) || "";
  const to = (data.To as string) || (data.to as string) || "";
  const from = (data.From as string) || (data.from as string) || "";

  console.log(`[plivo-voice] 📞 Call picked up: CallUUID=${callUuid}, RequestUUID=${requestUuid}, To=${to}, From=${from}`);

  if (callUuid) {
    activeCallRegistry.bindPlivoCall(callUuid, requestUuid, to);
    activeCallRegistry.markInProgress(callUuid);
  }

  const streamUrl = env.publicUrl.replace(/^https?:\/\//, "wss://") + "/media-stream";
  res.type("text/xml").send(buildStreamXml(streamUrl));
}
