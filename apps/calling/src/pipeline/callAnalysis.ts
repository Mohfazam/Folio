import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import type { TranscriptTurn, CallAnalysisResult } from "../types/callTypes.js";
import type { PromptContext } from "../prompts/compileSystemPrompt.js";

const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });

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
    };
  }

  const transcriptText = transcript
    .map((t) => `${t.speaker === "assistant" ? "Agent" : "Caller"}: ${t.text}`)
    .join("\n");

  const prompt = `You are an expert sales, customer outreach, and call analysis auditor.
Analyze this phone call transcript between an automated AI agent and a caller.

Context:
- Business: ${context?.business?.displayName || "Our Business"} (${context?.business?.industry || "General"})
- Campaign Objective: ${context?.campaign?.primaryObjective || "Outreach & Inquiries"}
- Target Contact: ${context?.contact?.fullName || "Customer"}

Transcript:
${transcriptText}

Extract the following details in strict JSON format:
{
  "summary": "1-2 concise sentences summarizing the call outcome and discussion",
  "interestLevel": "high" | "medium" | "low" | "unknown",
  "sentiment": "positive" | "neutral" | "negative",
  "objectionsRaised": ["any objections or hesitation voiced by caller, e.g. price, timing, not interested"],
  "followUpRequested": boolean,
  "requestedCallbackTime": "explicit day or time if caller requested callback, else null",
  "notes": "actionable notes or next steps for human sales / support reps"
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
      requestedCallbackTime: parsed.requestedCallbackTime || undefined,
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
    };
  }
}
