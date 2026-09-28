import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env";

const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });

const SYSTEM_INSTRUCTION = `
You are a friendly, helpful AI voice assistant on a phone call.
- Keep your answers short, concise, and natural (1 to 2 sentences maximum).
- Never use markdown formatting, bullet points, asterisks, URLs, or emojis.
- Speak directly to the caller.
`.trim();

export async function generateReply(conversationHistory: { role: "user" | "assistant"; content: string }[]): Promise<string> {
  const contents = conversationHistory.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await genAI.models.generateContent({
    model: "gemini-flash-latest",
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });

  return (response.text ?? "").trim();
}