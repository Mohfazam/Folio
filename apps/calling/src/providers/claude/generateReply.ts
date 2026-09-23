import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env";

const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });

export async function generateReply(conversationHistory: { role: "user" | "assistant"; content: string }[]): Promise<string> {
  const contents = conversationHistory.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await genAI.models.generateContent({
    model: "gemini-flash-latest",
    contents,
  });

  return response.text ?? "";
}