import type { Request, Response } from "express";
import { buildStreamXml } from "../providers/plivo/xml";
import { env } from "../config/env";

export function plivoVoiceRoute(req: Request, res: Response) {
  const streamUrl = env.publicUrl.replace("https://", "wss://") + "/media-stream";
  res.type("text/xml");
  res.send(buildStreamXml(streamUrl));
}
