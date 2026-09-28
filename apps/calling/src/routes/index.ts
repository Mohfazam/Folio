import type { Express } from "express";
import { PLIVO_ANSWER_PATH } from "../config/paths.js";
import { plivoVoiceRoute } from "./plivo-voice.js";

// Every normal HTTP route is registered here, in one place.
export function registerRoutes(app: Express) {
  app.post("/plivo-voice", plivoVoiceRoute);
}
