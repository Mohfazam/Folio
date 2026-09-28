import type { Request, Response } from "express";
import { buildStreamXml } from "../providers/plivo/xml.js";
import { env } from "../config/env.js";
import { MEDIA_STREAM_PATH } from "../config/paths.js";

// Plivo calls this the moment the parent picks up: "what should I do with this call?"
// Our answer: "open a live audio stream to my /media-stream WebSocket."
export function plivoVoiceRoute(_req: Request, res: Response) {
  const streamUrl = env.publicUrl.replace(/^https?:\/\//, "wss://") + "/media-stream";
  res.type("text/xml").send(buildStreamXml(streamUrl));
}
