// src/test-gemini.ts (temporary, delete once confirmed working)
import { generateReply } from "./providers/claude/generateReply";

generateReply([{ role: "user", content: "Say hello in one short sentence." }])
  .then((reply) => console.log("Gemini replied:", reply))
  .catch((err) => console.error("Gemini error:", err));