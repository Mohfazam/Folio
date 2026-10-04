import { startServer } from "./server.js";

process.on("unhandledRejection", (reason, _promise) => {
  console.error("[FATAL] Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[FATAL] Uncaught Exception:", error);
});

startServer();
