import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";

const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });
const PRIMARY_MODEL = "gemini-flash-lite-latest";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";

const SYSTEM_INSTRUCTION = `
You are a friendly, natural, and concise AI phone assistant representing the business on a live call.
- Keep responses short, direct, and conversational (1-2 spoken sentences per turn).
- Never lecture, monologue, or read long lists. Speak like a real person on a phone call.
- Stay strictly on topic based on the business details, catalog, and call objectives provided.
- If the caller asks off-topic questions (e.g. weather, stocks, unrelated general knowledge), politely acknowledge and steer back to the call's purpose.
- Never use markdown formatting, bullet points, asterisks, URLs, or emojis.
- Speak directly to the caller.
`.trim();

export function shouldSearchWeb(_text: string): boolean {
  return false;
}

function formatContents(
  conversationHistory: { role: "user" | "assistant"; content: string }[]
) {
  return conversationHistory.map(({ role, content }) => ({
    role: role === "assistant" ? "model" : "user",
    parts: [{ text: content }],
  }));
}

export async function generateReply(
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  systemPrompt?: string
): Promise<string> {
  const contents = formatContents(conversationHistory);
  const sysInst = systemPrompt ? `${SYSTEM_INSTRUCTION}\n${systemPrompt}` : SYSTEM_INSTRUCTION;

  try {
    const response = await genAI.models.generateContent({
      model: PRIMARY_MODEL,
      config: {
        systemInstruction: sysInst,
        maxOutputTokens: 250,
      },
      contents,
    });
    return response.text?.trim() ?? "";
  } catch (err: any) {
    console.warn(`[generateReply] Primary model ${PRIMARY_MODEL} failed, trying fallback:`, err?.message ?? err);
    const fallbackResponse = await genAI.models.generateContent({
      model: FALLBACK_MODEL,
      config: {
        systemInstruction: sysInst,
        maxOutputTokens: 250,
      },
      contents,
    });
    return fallbackResponse.text?.trim() ?? "";
  }
}

/**
 * Streams reply sentences from Gemini with low latency (< 1s first chunk).
 * Dispatches completed sentences and long clauses immediately to TTS.
 */
export async function generateReplyStream(
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  onSentence: (sentence: string) => void,
  signal?: AbortSignal,
  searchWeb = false,
  customInstructions?: string
): Promise<string> {
  const contents = formatContents(conversationHistory);
  const sysInst = [
    SYSTEM_INSTRUCTION,
    customInstructions ? `Additional call context: ${customInstructions}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  let buffer = "";
  let fullReply = "";

  const dispatchSentence = (text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    onSentence(cleaned);
    fullReply += (fullReply ? " " : "") + cleaned;
  };

  const processChunk = (chunkText: string) => {
    buffer += chunkText;

    // Split on sentence boundaries (. ! ? or Hindi danda ।)
    let match = /([.!?।]+)(?:\s+|$)/.exec(buffer);
    while (match && match.index !== undefined && match[1]) {
      const sentenceEnd = match.index + match[1].length;
      const sentence = buffer.slice(0, sentenceEnd).trim();
      if (sentence) {
        dispatchSentence(sentence);
      }
      buffer = buffer.slice(sentenceEnd).trimStart();
      match = /([.!?।]+)(?:\s+|$)/.exec(buffer);
    }

    // Split long clauses (> 100 chars) on comma/semicolon for low TTS delay
    if (buffer.length > 100) {
      const clauseMatch = /([,;]+)\s+/.exec(buffer);
      const delimiter = clauseMatch?.[1];
      if (clauseMatch && delimiter && clauseMatch.index > 25) {
        const clauseEnd = clauseMatch.index + delimiter.length;
        const clause = buffer.slice(0, clauseEnd).trim();
        if (clause) {
          dispatchSentence(clause);
        }
        buffer = buffer.slice(clauseEnd).trimStart();
      }
    }
  };

  // Helper to run stream with a given model
  const runStream = async (model: string) => {
    const responseStream = await genAI.models.generateContentStream({
      model,
      config: {
        systemInstruction: sysInst,
        maxOutputTokens: 200,
      },
      contents,
    });

    for await (const chunk of responseStream) {
      if (signal?.aborted) break;
      if (chunk.text) {
        processChunk(chunk.text);
      }
    }
  };

  try {
    await runStream(PRIMARY_MODEL);
  } catch (err: any) {
    if (signal?.aborted) return fullReply.trim();
    console.warn(`[generateReplyStream] Primary model failed, trying fallback:`, err?.message ?? err);
    try {
      await runStream(FALLBACK_MODEL);
    } catch (retryErr: any) {
      console.error(`[generateReplyStream] Fallback model also failed:`, retryErr?.message ?? retryErr);
    }
  }

  // Flush any remaining buffer text
  if (!signal?.aborted && buffer.trim()) {
    dispatchSentence(buffer.trim());
  }

  return fullReply.trim();
}
