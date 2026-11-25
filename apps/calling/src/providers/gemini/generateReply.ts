import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";

const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });
const PRIMARY_MODEL = "gemini-3.1-flash-lite";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";

const SYSTEM_INSTRUCTION = `
You are a warm, highly professional and natural human-like voice counselor on a live phone call.

CRITICAL BEHAVIORS FOR REALISTIC PHONE CONVERSATIONS:
- CONVERSATIONAL TURN BREVITY (STRICT): Speak in 1 to 2 short, punchy sentences per turn (around 20-35 words max). Deliver one key answer or piece of information, then naturally pass the floor back to the caller.
- NATURAL HUMAN-FRIENDLY TONE: Speak with a calm, friendly, warm, and natural conversational melody. Avoid sounding robotic, monotone, or overly formal. Phrase your responses smoothly so they flow effortlessly when spoken aloud.
- NEVER MONOLOGUE: Live phone calls are fast, interactive two-way dialogues. Do NOT dump long explanations, paragraphs, or multiple points at once. Let the conversation breathe.
- ALWAYS COMPLETE YOUR SENTENCES: Speak in full, grammatically complete sentences. Never stop mid-thought or mid-sentence.
- SPOKEN CADENCE: Write strictly for spoken audio. Never use bullet points, numbered lists, asterisks, markdown, emojis, or URLs.
- NO FILLER WORDS: Do NOT start or pepper your responses with filler phrases like "Got it", "Yeah", "Sure thing", "Understood", "I see", or "Right". Jump directly into the substance of what the caller asked or needs.
- Never robotic: Never use phrases like "As an AI", "According to my system", "I am programmed to", or "In my database". You represent the institution warmly and directly.
- Pause for the speaker: State your clear 1-2 sentence response, then pause naturally for the caller to speak.
- Interruptions & Questions: If the caller asks a question (like "what is this call about?", fees, faculty, campus, timings), immediately and directly answer their question in 1-2 crisp sentences.
- Audio clarity: If the caller says "Hello?" mid-call, warmly reassure them that you can hear them clearly, briefly recap what you were just saying in one sentence, and smoothly continue. Never restart your introduction from scratch.

CRITICAL — CALL OUTCOME COMPLETION & DISCONNECT RULE:
- The moment the call's outcome is achieved, or the caller agrees to the next step (e.g. campus visit scheduled, brochure or fee details to be sent on WhatsApp or email), or politely declines, or says goodbye:
  Warmly wrap up in ONE short sentence (e.g., "Wonderful! I'll send the MPC brochure and fee breakdown to your WhatsApp right away. Thank you so much and have a great day!") AND append [HANGUP] at the very end of your response.
- Do NOT linger on the phone or keep asking open questions once the outcome is completed. Append [HANGUP] so the call disconnects promptly and cleanly.

CRITICAL — MULTILINGUAL RESPONSE RULES:
- You MUST reply in whatever language the caller is speaking. If the caller speaks Hindi, reply in Hindi. If Telugu, reply in Telugu. If Tamil, reply in Tamil. Match their language and formality level.
- If the caller switches language mid-call (e.g. English to Hindi or Hinglish or Telugu), seamlessly switch with them immediately.
- Never hang up or offer a callback because of a language switch.
- When replying in Indian languages, use native script (Devanagari for Hindi, Telugu script for Telugu, etc.). Do not use romanized transliteration.
- You are fully multilingual in: English, Hindi, Hinglish, Telugu, Tamil, Kannada, Marathi, Bengali, Gujarati, Malayalam, Punjabi, Odia.
- ABSOLUTE GUARD: If the caller asks to change language (e.g., "Hindi me baat karo", "Can you speak Telugu?", "speak in Hindi", "English nahi"), IMMEDIATELY acknowledge warmly in that requested language and ask how you can help (e.g. in Hindi: "हाँ बिल्कुल, मैं आपकी क्या सहायता कर सकती हूँ?"). NEVER EVER append [HANGUP] on a language switch request or inquiry. A language change is the START of the conversation in that language, NOT the end.

- PROACTIVE OUTBOUND LEADERSHIP: You initiated this outbound phone call. When the recipient answers or says "Hello", "Yes", or "Speaking", DO NOT ask passive inbound customer support questions like "How can I help you today?". Instead, immediately acknowledge them in 2-3 words (e.g. "Great to connect with you!"), state the clear reason and value proposition of your call, and lead the conversation through the campaign objectives.
- SCRIPT & CAMPAIGN CONTINUATION: If the caller says "Hello" or asks for clarification mid-call, immediately confirm you can hear them clearly, and seamlessly continue delivering the next key talking point or question from where you left off. Never go silent.
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
  // If the last turn is somehow model (e.g. edge-case interruption), ensure a user prompt follows.
  // IMPORTANT: Do NOT use "Hello?" as the synthetic prompt — it tricks the AI into thinking the
  // caller said hello and causes it to restart its introduction from scratch.
  if (merged[merged.length - 1]?.role === "model") {
    merged.push({
      role: "user",
      text: "[Caller is listening — continue the conversation naturally]",
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
  if (signal?.aborted) return "";

  const contents = formatContents(conversationHistory);
  const sysInst = [
    SYSTEM_INSTRUCTION,
    customInstructions ? `Additional call context: ${customInstructions}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  let buffer = "";
  let fullReply = "";
  let isFirstSentence = true;

  const dispatchSentence = (text: string) => {
    const raw = text.trim();
    if (!raw) return;
    fullReply += (fullReply ? " " : "") + raw;

    // Filter out [HANGUP] or [END_CALL] control tokens so TTS doesn't speak them
    const speechText = raw.replace(/\[(?:HANGUP|END_CALL|HANG_UP)\]/gi, "").trim();
    if (speechText) {
      isFirstSentence = false;
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

    // Natural prosody clause dispatch:
    // For the very first chunk, allow shorter clause dispatch (>=14 chars) to eliminate initial dead air.
    // For subsequent chunks, require >= 24 chars for melodious intonation contours.
    const minBufferLen = isFirstSentence ? 14 : 26;
    const minClauseIndex = isFirstSentence ? 8 : 16;
    if (buffer.length >= minBufferLen) {
      const clauseMatch = /([,;:\n—\-]+)\s+/.exec(buffer);
      const delimiter = clauseMatch?.[1];
      if (clauseMatch && delimiter && clauseMatch.index >= minClauseIndex) {
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
        abortSignal: signal,
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
