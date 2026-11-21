/**
 * Detects if the caller indicates they are busy, driving, in a meeting,
 * or requests a callback at a later time.
 */
const BUSY_PATTERNS = [
  /\b(busy right now|im busy|i am busy|in a meeting|driving|in car|at work)\b/i,
  /\b(call (me )?later|call back later|call afterwards|not now|cant talk now)\b/i,
  /\b(baad me (baat|call)|abhi busy|meeting me|driving kar raha|gaadi chala)\b/i,
  /\b(bad me call|bad me baat|baad me bolo|phir call karo|baad me)\b/i,
];

export function isBusyUtterance(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  return BUSY_PATTERNS.some((pattern) => pattern.test(clean));
}

export function buildBusyCallbackResponse(language = "en-IN"): string {
  if (language.startsWith("hi")) {
    return "Bilkul samjh sakti hoon! Main aapko baad me call karungi. Aapka din shubh ho! [HANGUP]";
  }
  return "Completely understand! I'll note to call you back at a better time. Have a great day! [HANGUP]";
}
