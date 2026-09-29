import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env";

const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });

const SYSTEM_INSTRUCTION = `
You are a friendly, helpful AI voice assistant on a phone call.
- Keep your answers short, concise, and natural (1 to 2 sentences maximum).
- Keep each reply under 240 characters.
- Never use markdown formatting, bullet points, asterisks, URLs, or emojis.
- Speak directly to the caller.
`.trim();

export async function generateReply(
  conversationHistory: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const contents = conversationHistory.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await genAI.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents,
    config: { systemInstruction: SYSTEM_INSTRUCTION },
  });

  return (response.text ?? "").trim();
}

export async function generateReplyStream(
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  onSentence: (sentence: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const contents = conversationHistory.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await genAI.models.generateContentStream({
    model: "gemini-3.5-flash-lite",
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      maxOutputTokens: 100,
    },
  });

  let buffer = "";
  let reply = "";

  for await (const chunk of response) {
    if (signal?.aborted) break;
    buffer += chunk.text ?? "";

    let boundary = /[.!?।](?=\s)/.exec(buffer);
    while (boundary) {
      const sentence = buffer.slice(0, boundary.index + 1).trim();
      if (sentence) {
        onSentence(sentence);
        reply += `${sentence} `;
      }
      buffer = buffer.slice(boundary.index + 1).trimStart();
      boundary = /[.!?।](?=\s)/.exec(buffer);
    }
  }

  if (!signal?.aborted && buffer.trim()) {
    const sentence = buffer.trim();
    onSentence(sentence);
    reply += sentence;
  }

  return reply.trim();
}