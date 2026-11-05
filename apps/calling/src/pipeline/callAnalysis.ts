import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import type { TranscriptTurn, CallAnalysisResult } from "../types/callTypes.js";
import type { PromptContext } from "../prompts/compileSystemPrompt.js";

const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });

function detectHumanRequest(transcript: TranscriptTurn[]): boolean {
  const explicitHumanRequestPatterns = [
    /\b(can|could|may|let|please|i want|i need|i would like|i'd like)\b.{0,50}\b(speak|talk|connect|transfer|put me through)\b.{0,50}\b(human|person|someone|representative|manager|supervisor|support|customer service|sales)\b/i,
    /\b(connect|transfer|put)\s+me\s+(to|through)\s+(a |an )?(human|person|representative|manager|supervisor|support|agent)\b/i,
    /\b(real person|human agent|live agent|human representative|speak to a human|talk to a human)\b/i,
  ];
  return transcript.some((turn) => turn.speaker === "user" && explicitHumanRequestPatterns.some((pattern) => pattern.test(turn.text)));
}

function detectOptOutRequest(transcript: TranscriptTurn[]): boolean {
  const explicitOptOutPatterns = [
    /\b(unsubscribe|opt me out|remove my number|remove me from (your )?(list|database)|put me on (the )?do not call list)\b/i,
    /\b(don't|dont|do not)\s+(call|contact|phone)\s+(me|this number|my number)\b(?!\s+(right now|now|today|tomorrow|later|this time|next week))\b/i,
    /\b(stop calling|stop contacting|never call|never contact)\s+(me|this number|my number)\b/i,
    /\b(do not call|dnc)\s+(me|this number|my number)\b/i,
  ];
  return transcript.some((turn) => turn.speaker === "user" && explicitOptOutPatterns.some((pattern) => pattern.test(turn.text)));
}

function isTimezoneQualifiedIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

/**
 * Runs a fast post-call extraction turn over the complete conversation transcript.
 * Extracts a concise summary, caller interest level, overall sentiment, objections raised,
 * and whether a human follow-up callback was requested.
 */
export async function analyzeCallTranscript(
  transcript: TranscriptTurn[],
  context?: PromptContext
): Promise<CallAnalysisResult> {
  const userTurns = transcript.filter((t) => t.speaker === "user");

  // If the call connected but the user never spoke or only answered with 0 turns
  if (userTurns.length === 0) {
    return {
      summary: "Call connected but caller never spoke.",
      interestLevel: "unknown",
      sentiment: "neutral",
      objectionsRaised: [],
      followUpRequested: false,
      humanRequested: false,
      optOutRequested: false,
    };
  }

  const transcriptText = transcript
    .map((t) => `${t.speaker === "assistant" ? "Agent" : "Caller"}: ${t.text}`)
    .join("\n");
  const humanRequestedFromTranscript = detectHumanRequest(transcript);
  const optOutRequestedFromTranscript = detectOptOutRequest(transcript);

  const prompt = `You are an expert sales, customer outreach, and call analysis auditor.
Analyze this phone call transcript between an automated AI agent and a caller.

Context:
- Business: ${context?.business?.displayName || "Our Business"} (${context?.business?.industry || "General"})
- Campaign Objective: ${context?.campaign?.primaryObjective || "Outreach & Inquiries"}
- Target Contact: ${context?.contact?.fullName || "Customer"}
- Current timestamp: ${new Date().toISOString()}
- Workspace timezone: ${context?.workspaceTimezone || "UTC"}

Transcript:
${transcriptText}

Extract the following details in strict JSON format:
{
  "summary": "1-2 concise sentences summarizing the call outcome and discussion",
  "interestLevel": "high" | "medium" | "low" | "unknown",
  "sentiment": "positive" | "neutral" | "negative",
  "objectionsRaised": ["any objections or hesitation voiced by caller, e.g. price, timing, not interested"],
  "followUpRequested": boolean,
  "humanRequested": boolean (true only when the caller explicitly asks to speak to a real person, representative, manager, or support agent),
  "optOutRequested": boolean (true when the caller explicitly asks to stop future outreach, for example "don't call me", "stop contacting this number", "remove my number", or "unsubscribe"; do not treat ending this call or asking for a temporary pause such as "don't call me tomorrow" as permanent opt-out),
  "requestedCallbackTime": "ISO-8601 timestamp with Z or the correct explicit UTC offset for the workspace timezone, resolved from the current timestamp, only when the caller gave a specific date and time; otherwise null",
  "notes": "actionable notes or next steps for human sales / support reps. Preserve the caller's exact natural-language callback request here when it cannot be safely converted to a specific timestamp."
}

Output only valid JSON with no markdown backticks or commentary.`;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-flash-lite-latest",
      config: {
        responseMimeType: "application/json",
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.text?.trim() || "{}";
    const parsed = JSON.parse(text);

    return {
      summary: parsed.summary || `Conversation completed with ${userTurns.length} caller turns.`,
      interestLevel: ["high", "medium", "low", "unknown"].includes(parsed.interestLevel)
        ? parsed.interestLevel
        : "unknown",
      sentiment: ["positive", "neutral", "negative"].includes(parsed.sentiment)
        ? parsed.sentiment
        : "neutral",
      objectionsRaised: Array.isArray(parsed.objectionsRaised) ? parsed.objectionsRaised : [],
      followUpRequested: Boolean(parsed.followUpRequested),
      humanRequested: humanRequestedFromTranscript || parsed.humanRequested === true,
      optOutRequested: optOutRequestedFromTranscript || parsed.optOutRequested === true,
      requestedCallbackTime: isTimezoneQualifiedIsoDate(parsed.requestedCallbackTime)
        ? new Date(parsed.requestedCallbackTime).toISOString()
        : undefined,
      notes: parsed.notes || undefined,
    };
  } catch (err: any) {
    console.warn(`[callAnalysis] Failed to run AI analysis on transcript:`, err?.message ?? err);
    return {
      summary: `Conversation completed with ${userTurns.length} caller turns.`,
      interestLevel: "unknown",
      sentiment: "neutral",
      objectionsRaised: [],
      followUpRequested: false,
      humanRequested: humanRequestedFromTranscript,
      optOutRequested: optOutRequestedFromTranscript,
    };
  }
}
