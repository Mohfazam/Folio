import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { registerRoutes } from "./routes/index.js";

export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  registerRoutes(app);

  return app;
}

export function startServer(): express.Express {
  const app = createApp();

  app.listen(env.port, "0.0.0.0", () => {
    console.log(`[backend] 🚀 Backend service running on port ${env.port}`);
  });

  return app;
}
