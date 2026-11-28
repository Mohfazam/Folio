import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { messengerRouter } from "./routes/messengerRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health probes
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "messenger", status: "healthy" });
});
app.get("/health/live", (_req, res) => {
  res.json({ ok: true });
});
app.get("/health/ready", (_req, res) => {
  res.json({ ok: true });
});

// Messenger API & Webhook routes
app.use("/api/messenger", messengerRouter);

const server = app.listen(env.port, "0.0.0.0", () => {
  console.log(`[messenger] 🚀 Messenger service listening on port ${env.port}`);
  console.log(`[messenger] 🤖 Gemini AI composer & Plivo SMS sender ready`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`[messenger] Received ${signal}. Shutting down...`);
  server.close(() => {
    console.log("[messenger] Server closed cleanly.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
