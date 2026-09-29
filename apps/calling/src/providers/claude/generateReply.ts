import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env";

const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });

const SYSTEM_INSTRUCTION = `
You are a friendly, helpful AI voice assistant on a phone call.
- Match the level of detail to the question: answer simple questions briefly, but fully explain practical or multi-step requests.
- For instructions, include the necessary steps, quantities, timing, and relevant cautions.
- For practical or multi-step questions, open with one concrete summary sentence of about 15 words, then give the complete necessary steps and specifics.
- Do not omit useful details just to be brief.
- Use clear, natural spoken language and transitions between steps.
- Avoid repetition and optional background; make every sentence add useful information.
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
      maxOutputTokens: 384,
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