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

const WEB_SEARCH_INTENT = /\b(?:search(?: the)? (?:web|internet)|web search|internet search|browse(?: the)? (?:web|internet)|look up|look online|check online|from (?:the )?(?:web|internet)|on the web|online|internet|latest|current(?:ly)?|today|yesterday|right now|this week|this month|this year|recent|news|weather|forecast|stock price|share price|exchange rate|score|results|release date|opening hours|open now|near me|availability|available now|price of|cost of|version of|president|prime minister|ceo|governor|mayor)\b/i;

export function shouldSearchWeb(text: string): boolean {
  return WEB_SEARCH_INTENT.test(text);
}

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
  signal?: AbortSignal,
  searchWeb = false
): Promise<string> {
  const contents = conversationHistory.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await genAI.models.generateContentStream({
    model: "gemini-3.5-flash-lite",
    contents,
    config: {
      systemInstruction: searchWeb
        ? `${SYSTEM_INSTRUCTION}\n- This request needs current web information. Use Google Search and base the answer on its results. If the results do not answer the question, say so.`
        : SYSTEM_INSTRUCTION,
      maxOutputTokens: 384,
      ...(searchWeb ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });

  let buffer = "";
  let reply = "";
  const sourceDomains = new Set<string>();

  for await (const chunk of response) {
    if (signal?.aborted) break;
    buffer += chunk.text ?? "";

    for (const groundingChunk of chunk.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) {
      const uri = groundingChunk.web?.uri;
      if (!uri) continue;
      try {
        sourceDomains.add(new URL(uri).hostname.replace(/^www\./, ""));
      } catch {
        continue;
      }
    }

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

  if (!signal?.aborted && sourceDomains.size) {
    const attribution = `I checked ${Array.from(sourceDomains).slice(0, 2).join(" and ")} for that.`;
    onSentence(attribution);
    reply += ` ${attribution}`;
  }

  return reply.trim();
}