/**
 * Detects questions inquiring whether the caller is speaking with an AI, robot, or bot.
 */
const AI_IDENTITY_PATTERNS = [
  /\b(are you (an? )?(ai|robot|bot|machine|computer|automated))\b/i,
  /\b(am i talking to (an? )?(ai|robot|bot|computer))\b/i,
  /\b(aap (robot|computer|ai|bot) (ho|hai) kya)\b/i,
  /\b(kya aap (robot|ai) ho)\b/i,
  /\b(real human|real person|insaan ho)\b/i,
];

export function isAiIdentityInquiry(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  return AI_IDENTITY_PATTERNS.some((pattern) => pattern.test(clean));
}

export function buildAiIdentityResponse(persona = "Aarohi", businessName = "Foolioo", language = "en-IN"): string {
  if (language.startsWith("hi")) {
    return `Haanji, main ${businessName} ki AI voice assistant ${persona} hoon! Main bilkul ek human representative ki tarah aapki madad kar sakti hoon. Kahiye, main aapki kya madad kar sakti hoon?`;
  }
  return `Yes, I am ${persona}, an AI voice assistant for ${businessName}! But I'm fully equipped to help you just like a real person. What questions can I answer for you?`;
}
