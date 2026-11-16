import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";

const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });
const PRIMARY_MODEL = "gemini-flash-lite-latest";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";

const SYSTEM_INSTRUCTION = `
You are an expert human-like phone representative on a live outbound voice call.
CRITICAL CONVERSATIONAL RULES:
- Speak concisely and punchy: exactly 1 to 2 short sentences per turn (max 25-30 words).
- Sound natural and human: use natural casual conversational markers where appropriate (e.g., "Got it", "Sure thing", "Understood", "I see").
- Do NOT sound like a robotic script or read bulleted lists.
- Ask one clear question or give one concise answer, then let the caller speak.
- Stay strictly on topic based on the business details, catalog, and call objectives provided.
- If the caller asks off-topic questions, politely acknowledge and steer right back to the call's purpose.
- Speak directly to the caller.

CRITICAL — MULTILINGUAL RESPONSE RULES:
- You MUST reply in whatever language the caller is speaking. If the caller speaks Hindi, reply in Hindi. If Telugu, reply in Telugu. If Tamil, reply in Tamil. Match their language exactly.
- If the caller switches language mid-call, seamlessly switch to that language too.
- NEVER end the call, hang up, or offer a callback just because the caller switched languages.
- When replying in an Indian language (Hindi, Telugu, Tamil, Kannada, etc.), write your response using the native script of that language (Devanagari for Hindi, Telugu script for Telugu, etc.). Do NOT use romanized transliteration.
- You are fully multilingual. Respond naturally and fluently in: English, Hindi, Telugu, Tamil, Kannada, Marathi, Bengali, Gujarati, Malayalam, Punjabi, and Odia.

- CALL CONCLUSION: When the conversation naturally concludes (the recipient says goodbye, says they are not interested, has no more questions, or you deliver your final parting message), conclude warmly and append [HANGUP] at the very end of your response.
Example: "Thanks for your time! Have a great day! [HANGUP]"
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
  customInstructions?: string,
  modelProfile?: "showcase"
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

    // Split long clauses (> 60 chars) on comma/semicolon for early TTS streaming
    if (buffer.length > 60) {
      const clauseMatch = /([,;]+)\s+/.exec(buffer);
      const delimiter = clauseMatch?.[1];
      if (clauseMatch && delimiter && clauseMatch.index > 15) {
        const clauseEnd = clauseMatch.index + delimiter.length;
        const clause = buffer.slice(0, clauseEnd).trim();
        if (clause) {
          dispatchSentence(clause);
        }
        buffer = buffer.slice(clauseEnd).trimStart();
      }
    }
  };

  // Public showcase calls use a higher-capability server-selected Gemini model.
  // The visitor cannot choose or override this profile. Fall back to the existing
  // production model if the configured showcase model is unavailable.
  const primaryModel = modelProfile === "showcase"
    ? process.env.PUBLIC_DEMO_GEMINI_MODEL?.trim() || "gemini-2.5-flash"
    : PRIMARY_MODEL;
  const fallbackModel = modelProfile === "showcase" ? PRIMARY_MODEL : FALLBACK_MODEL;

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
    await runStream(primaryModel);
  } catch (err: any) {
    if (signal?.aborted) return fullReply.trim();
    console.warn(`[generateReplyStream] Primary model ${primaryModel} failed, trying fallback:`, err?.message ?? err);
    try {
      await runStream(fallbackModel);
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
