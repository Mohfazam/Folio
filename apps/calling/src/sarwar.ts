import { createServer } from "node:http";
import express from "express";
import { registerRoutes } from "./routes/index.js";
import { attachMediaStream } from "./routes/media-stream.js";

export function startServer() {
  const app = express();
  registerRoutes(app);

  const server = createServer(app);
  attachMediaStream(server);

  const PORT = 3000;
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}