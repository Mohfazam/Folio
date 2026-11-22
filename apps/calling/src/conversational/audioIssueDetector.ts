/**
 * Detects common telecom audio issues / inquiries from caller:
 * e.g., "Am I audible?", "Can you hear me?", "Aapki aawaz cut rahi hai",
 * "Aawaz nahi aa rahi", "You are breaking up".
 */
const AUDIO_ISSUE_PATTERNS = [
  /\b(am i audible|can you hear me|can you hear|are you there|you there)\b/i,
  /\b(aawaz|awaz|awaaz)\s+(nahi|nhi|cut|break|aa rahi|aarahi)\b/i,
  /\b(cant hear|can't hear|cannot hear|not able to hear|unable to hear)\b/i,
  /\b(breaking up|voice is breaking|call is breaking|sound is low)\b/i,
  /\b(sunai nahi de raha|sunai nhi de raha|kuch sunai|sun rahe ho)\b/i,
];

export function isAudioIssueUtterance(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  return AUDIO_ISSUE_PATTERNS.some((pattern) => pattern.test(clean));
}

export function buildAudibilityResponse(language = "en-IN"): string {
  if (language.startsWith("hi")) {
    return "Haanji, aapki aawaz bilkul saaf aa rahi hai! Kya aap mujhe sun pa rahe hain?";
  }
  return "Yes! I can hear you loud and clear. Can you hear me okay?";
}
