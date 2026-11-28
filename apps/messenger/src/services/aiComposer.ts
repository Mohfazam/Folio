import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";

const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });

export interface GeneratePostCallMessageOptions {
  contactName?: string | null;
  businessName?: string | null;
  callSummary?: string | null;
  interestLevel?: "high" | "medium" | "low" | "unknown" | null;
  sentiment?: "positive" | "neutral" | "negative" | null;
  infoRequested?: boolean;
  requestedInfo?: string | null;
  fallbackLink?: string | null;
}

/**
 * Uses Gemini AI to compose a tailor-made, human-sounding post-call SMS.
 * Produces crisp, actionable copy (around 100-150 characters) including the
 * relevant link, inquiry answer, or next step without generic clichés.
 */
export async function composePostCallMessage(
  options: GeneratePostCallMessageOptions
): Promise<string> {
  const contactName = options.contactName ? options.contactName.split(" ")[0] : "Hi";
  const business = options.businessName || "Folio";
  const link = options.fallbackLink ? ` ${options.fallbackLink}` : "";

  // Fallback template if Gemini fails or summary is empty
  const defaultFallback = `Hi ${contactName}, thanks for speaking with ${business} today! Here are the details you requested:${link}`.trim();

  if (!options.callSummary && !options.requestedInfo && !options.fallbackLink) {
    return defaultFallback;
  }

  const prompt = `You are a high-conversion, professional SMS copywriter for "${business}".
Write a personalized follow-up SMS to a customer who just had a phone call with us.

Call Details:
- Contact Name: ${options.contactName || "Customer"}
- Call Summary: ${options.callSummary || "Discussed business offerings"}
- Caller Interest Level: ${options.interestLevel || "medium"}
- What they asked for: ${options.requestedInfo || (options.infoRequested ? "Requested details/links" : "General follow-up")}
- Resource / Website link to include: ${options.fallbackLink || "N/A"}

STRICT Guidelines:
1. Length: Keep the message concise (100 to 150 characters target, maximum 160 characters).
2. Tone: Warm, professional, helpful, direct.
3. Content: Reference specifically what was discussed or requested (e.g. quote, booking, catalog, brochure, pricing).
4. Do NOT use emojis excessively (max 1 or 0).
5. If a link is provided, seamlessly embed it at the end.
6. Output ONLY the raw SMS text, nothing else.`;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const generated = response.text?.trim();
    if (generated && generated.length >= 15 && generated.length <= 250) {
      return generated;
    }
    return defaultFallback;
  } catch (err: unknown) {
    console.warn("[messenger/ai] Gemini generation failed, using fallback:", err instanceof Error ? err.message : err);
    return defaultFallback;
  }
}
