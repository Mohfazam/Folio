/**
 * Detects explicit caller opt-out / Do Not Call requests or wrong numbers:
 * e.g., "Don't call again", "Not interested", "Mat call karo", "Wrong number".
 */
const OPT_OUT_PATTERNS = [
  /\b(not interested|dont call|don't call|do not call|stop calling)\b/i,
  /\b(remove (my|me|this) (number|from|list)|unsubscribe|block me)\b/i,
  /\b(wrong number|galat number|wrong person|not me)\b/i,
  /\b(mat call (karo|karna)|interest nahi hai|zarurat nahi hai)\b/i,
];

export function isOptOutUtterance(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  return OPT_OUT_PATTERNS.some((pattern) => pattern.test(clean));
}

export function buildOptOutResponse(language = "en-IN"): string {
  if (language.startsWith("hi")) {
    return "Theek hai, main aapka number list se hata deti hoon. Aapko dobara call nahi aayega. Dhanyawad! [HANGUP]";
  }
  return "I completely understand. I've noted to remove your number so you won't be called again. Thank you! [HANGUP]";
}
