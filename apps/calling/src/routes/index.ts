import type { Express } from "express";
import { dialRoute } from "./dial.js";
import { plivoVoiceRoute } from "./plivo-voice.js";

// Every normal HTTP route is registered here, in one place.
export function registerRoutes(app: Express) {
  app.post("/plivo-voice", plivoVoiceRoute);
  app.get("/dial", dialRoute);
}
