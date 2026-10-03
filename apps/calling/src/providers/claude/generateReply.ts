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
- Speak directly to the caller.

CRITICAL — MULTILINGUAL RESPONSE RULES:
- You MUST reply in whatever language the caller is speaking. If the caller speaks Hindi, reply in Hindi. If Telugu, reply in Telugu. If Tamil, reply in Tamil. Match their language exactly.
- If the caller switches language mid-call, you MUST seamlessly switch to that language too. Do NOT say things like "I'll have someone who speaks [language] call you back" or offer to transfer. You speak all languages fluently.
- NEVER end the call, hang up, or offer a callback just because the caller switched languages. A language change is NOT a reason to conclude the call.
- When replying in an Indian language (Hindi, Telugu, Tamil, Kannada, etc.), write your response using the native script of that language (e.g., Devanagari for Hindi, Telugu script for Telugu). Do NOT use romanized transliteration.
- You are fully multilingual. Respond naturally and fluently in: English, Hindi, Telugu, Tamil, Kannada, Marathi, Bengali, Gujarati, Malayalam, Punjabi, and Odia.

- CALL CONCLUSION: When the conversation naturally concludes (the recipient says goodbye, says they are not interested, has no more questions, or you deliver your final parting message), conclude politely and append [HANGUP] at the very end of your response. A language switch is NEVER a reason to conclude the call.
Example: "Thank you for your time! Have a great day ahead! [HANGUP]"
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
    const raw = text.trim();
    if (!raw) return;
    fullReply += (fullReply ? " " : "") + raw;

    // Filter out [HANGUP] or [END_CALL] control tokens so TTS doesn't speak them
    const speechText = raw.replace(/\[(?:HANGUP|END_CALL|HANG_UP)\]/gi, "").trim();
    if (speechText) {
      onSentence(speechText);
    }
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
