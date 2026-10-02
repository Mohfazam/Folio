import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { registerRoutes } from "./routes/index.js";
import { attachMediaStream } from "./routes/media-stream.js";

export function startServer() {
  const app = express();

  // Middleware for cross-origin requests and webhook body parsing
  app.use(cors());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  registerRoutes(app);

  const server = createServer(app);
  attachMediaStream(server);

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] 🚀 Calling service running on port ${PORT}`);
  });

  return server;
}