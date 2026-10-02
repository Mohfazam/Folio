import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";

const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });
const PRIMARY_MODEL = "gemini-flash-lite-latest";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";

const SYSTEM_INSTRUCTION = `
You are a friendly, concise, natural AI voice assistant on a live phone call.
- Keep responses natural, conversational, and direct (1-3 short spoken sentences).
- Avoid long essays or numbered bullet lists. Use spoken transitions instead.
- Answer simple questions immediately and concisely.
- For practical or multi-step questions, give a direct 1-sentence answer first, then provide concise next steps.
- Never use markdown formatting, bullet points, asterisks, URLs, or emojis.
- Speak directly to the caller.
`.trim();

// Specific web search intent (strictly requires explicit request to search online)
const WEB_SEARCH_INTENT = /\b(?:(?:search|look up|check|browse|find)(?: (?:the|on))? (?:web|internet|google)|latest news|current weather in|live score of)\b/i;

export function shouldSearchWeb(text: string): boolean {
  return WEB_SEARCH_INTENT.test(text);
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
  const runStream = async (model: string, withSearch: boolean) => {
    const config: any = {
      systemInstruction: sysInst,
      maxOutputTokens: 250,
    };
    if (withSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const responseStream = await genAI.models.generateContentStream({
      model,
      config,
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
    await runStream(PRIMARY_MODEL, searchWeb);
  } catch (err: any) {
    if (signal?.aborted) return fullReply.trim();

    // If searchWeb failed with 429 quota or other error, retry immediately without search
    if (searchWeb) {
      console.warn(`[generateReplyStream] Search failed, retrying without search tool:`, err?.message ?? err);
      try {
        await runStream(PRIMARY_MODEL, false);
      } catch (retryErr: any) {
        console.warn(`[generateReplyStream] Primary retry failed, using fallback model:`, retryErr?.message ?? retryErr);
        await runStream(FALLBACK_MODEL, false);
      }
    } else {
      console.warn(`[generateReplyStream] Primary model failed, trying fallback:`, err?.message ?? err);
      await runStream(FALLBACK_MODEL, false);
    }
  }

  // Flush any remaining buffer text
  if (!signal?.aborted && buffer.trim()) {
    dispatchSentence(buffer.trim());
  }

  return fullReply.trim();
}
