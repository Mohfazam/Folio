import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env";

const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });
const GEMINI_MODEL = "gemini-3.8-flash";

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

const WEB_SEARCH_INTENT = /\b(?:search(?: the)? (?:web|internet|online)|web search|internet search|browse(?: the)? (?:web|internet|online)|look (?:it )?up online|check online|find (?:it )?online|latest|current(?:ly)?|today|yesterday|right now|this week|this month|this year|recent|news|weather|forecast|stock price|share price|exchange rate|live score|current score|release date|opening hours|open now|near me)\b/i;

export function shouldSearchWeb(text: string): boolean {
  return WEB_SEARCH_INTENT.test(text);
}

export async function generateReply(
  conversationHistory: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const response = await genAI.interactions.create({
    model: GEMINI_MODEL,
    input: formatConversation(conversationHistory),
    system_instruction: SYSTEM_INSTRUCTION,
    store: false,
  });

  return response.output_text?.trim() ?? "";
}

function formatConversation(
  conversationHistory: { role: "user" | "assistant"; content: string }[]
): string {
  return conversationHistory
    .map(({ role, content }) => `${role === "assistant" ? "Assistant" : "Caller"}: ${content}`)
    .join("\n");
}

export async function generateReplyStream(
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  onSentence: (sentence: string) => void,
  signal?: AbortSignal,
  searchWeb = false
): Promise<string> {
  const stream = await genAI.interactions.create({
    model: GEMINI_MODEL,
    input: formatConversation(conversationHistory),
    system_instruction: searchWeb
      ? `${SYSTEM_INSTRUCTION}\n- Use Google Search for this request and base current claims on its results. If search does not answer the question, say so.`
      : SYSTEM_INSTRUCTION,
    generation_config: { max_output_tokens: 384 },
    ...(searchWeb ? { tools: [{ type: "google_search" as const }] } : {}),
    store: false,
    stream: true,
  });

  let buffer = "";
  let reply = "";
  for await (const event of stream) {
    if (signal?.aborted) break;
    if (event.event_type !== "step.delta" || event.delta.type !== "text") continue;
    buffer += event.delta.text;

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
