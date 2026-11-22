import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";

const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });
const PRIMARY_MODEL = "gemini-flash-lite-latest";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";

const SYSTEM_INSTRUCTION = `
You are a warm, highly professional and natural human-like voice representative on a live phone call.

CRITICAL BEHAVIORS FOR REALISTIC PHONE CONVERSATIONS:
- Outbound Call Dynamics: When the call connects, you have already greeted the caller. On the first turn, warmly acknowledge what they said, state who you are and why you are calling in ONE brief sentence (under 15 words), and ask if now is a good time to speak.
- Natural pacing: Speak in short, conversational sentences (1-2 sentences per turn, maximum 15-25 words). Real humans talk in brief exchanges on the phone, never monologues.
- Never robotic: Never use phrases like "As an AI", "According to my system", "I am programmed to", or "In my database". You represent the business warmly and directly.
- Casual natural markers: Use subtle conversational phrases where appropriate ("Sure", "Got it", "Understood", "Right", "Haanji", "Bilkul", "Great", "Definitely").
- Pause for the speaker: State one clear thought or ask one focused question, then pause and let the other person answer.
- Interruptions: If the caller interrupts you, immediately address their question or concern without repeating what you were saying before.
- Audio clarity: If the caller asks if you can hear them or says "Hello?", warmly reassure them ("Yes! I can hear you clearly.") and continue smoothly.

CRITICAL — MULTILINGUAL RESPONSE RULES:
- You MUST reply in whatever language the caller is speaking. If the caller speaks Hindi, reply in Hindi. If Telugu, reply in Telugu. If Tamil, reply in Tamil. Match their language and formality level.
- If the caller switches language mid-call (e.g. English to Hindi or Hinglish), seamlessly switch with them immediately.
- Never hang up or offer a callback because of a language switch.
- When replying in Indian languages, use native script (Devanagari for Hindi, etc.). Do not use romanized transliteration.
- You are fully multilingual in: English, Hindi, Hinglish, Telugu, Tamil, Kannada, Marathi, Bengali, Gujarati, Malayalam, Punjabi, Odia.

- CALL CONCLUSION: When the conversation concludes (the caller says goodbye, thanks you, says not interested, or completes the goal), deliver a warm closing and append [HANGUP] at the very end.
Example: "Thanks for your time! Have a wonderful day! [HANGUP]"
`.trim();

export function shouldSearchWeb(_text: string): boolean {
  return false;
}

export function formatContents(
  conversationHistory: { role: "user" | "assistant"; content: string }[]
): { role: "user" | "model"; parts: [{ text: string }] }[] {
  if (!conversationHistory || conversationHistory.length === 0) {
    return [{ role: "user", parts: [{ text: "Hello" }] }];
  }

  const merged: { role: "user" | "model"; text: string }[] = [];

  for (const turn of conversationHistory) {
    const role: "user" | "model" = turn.role === "assistant" ? "model" : "user";
    const text = (turn.content || "").trim();
    if (!text) continue;

    const last = merged[merged.length - 1];
    if (last && last.role === role) {
      // Merge consecutive turns of the same role so Gemini never gets duplicate adjacent roles
      last.text = `${last.text}\n${text}`.trim();
    } else {
      merged.push({ role, text });
    }
  }

  if (merged.length === 0) {
    return [{ role: "user", parts: [{ text: "Hello" }] }];
  }

  // Gemini API requires the first message in contents to be from role 'user'.
  // If the conversation began with an assistant greeting, prepend a natural user context trigger:
  if (merged[0]?.role === "model") {
    merged.unshift({
      role: "user",
      text: "[Phone call connected - recipient answered the phone]",
    });
  }

  // Gemini API generates the model response to the final user turn.
  // If the last turn is somehow model (e.g. edge-case interruption), ensure a user prompt follows:
  if (merged[merged.length - 1]?.role === "model") {
    merged.push({
      role: "user",
      text: "Hello?",
    });
  }

  return merged.map(({ role, text }) => ({
    role,
    parts: [{ text }],
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

  const isTransientError = (err: any): boolean => {
    const msg = (err?.message || "").toLowerCase();
    const status = err?.status || err?.statusCode;
    return (
      status === 429 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      msg.includes("resource_exhausted") ||
      msg.includes("overloaded") ||
      msg.includes("rate limit") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("fetch failed")
    );
  };

  const runStreamWithRetry = async (model: string, retries = 1): Promise<void> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (signal?.aborted) return;
      try {
        await runStream(model);
        return;
      } catch (err: any) {
        if (signal?.aborted) return;
        if (attempt < retries && isTransientError(err)) {
          const delayMs = 350 * (attempt + 1);
          console.warn(`[generateReplyStream] Model ${model} hit transient error (${err?.message}), retrying in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        throw err;
      }
    }
  };

  try {
    await runStreamWithRetry(primaryModel, 1);
  } catch (err: any) {
    if (signal?.aborted) return fullReply.trim();
    console.warn(`[generateReplyStream] Primary model ${primaryModel} failed, trying fallback:`, err?.message ?? err);
    try {
      await runStreamWithRetry(fallbackModel, 1);
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
