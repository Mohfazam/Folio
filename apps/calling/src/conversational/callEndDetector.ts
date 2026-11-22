/**
 * Detects explicit caller intent to end or leave the call:
 * e.g., "bye", "okay thank you bye", "that's all", "no thanks", "have to go", "not interested".
 */
const CALL_END_PATTERNS = [
  // Farewells
  /\b(bye|goodbye|bye bye|byee|ok bye|okay bye|thank you bye|thanks bye|bye thank you|alvida)\b/i,
  // Gratitude indicating conversation is finished
  /\b(thank you so much|thank you that'?s (all|it)|thanks that'?s (all|it)|that'?s (all|it)|that will be all|nothing else|no that'?s all|no that'?s it)\b/i,
  // Politely declining / no more questions
  /\b(not interested|dont call|don't call|do not call|stop calling|remove my number|no thanks|no thank you|i'?m good|we are good|no need|not needed|dont need|don't need)\b/i,
  // Busy / Gotta go
  /\b(i have to (go|leave)|got to go|have to go|talk (to you )?later|call you later|call back later|busy right now bye)\b/i,
  // Explicit hangup commands / regional phrases
  /\b(disconnect|cut the call|end the call|hang up|phone rakho|call cut karo|phone kaato|band karo|ab nahi|nahi chahiye|baad me)\b/i,
];

export function isCallEndIntent(text: string): boolean {
  const clean = text.trim();
  if (!clean || clean.length > 80) return false;
  return CALL_END_PATTERNS.some((pattern) => pattern.test(clean));
}

export function buildFastFarewell(language = "en-IN"): string {
  const lang = language.toLowerCase();
  if (lang.startsWith("hi")) {
    return "Aapke samay ke liye bahut dhanyawad. Aapka din shubh ho. Namaste!";
  }
  if (lang.startsWith("te")) {
    return "Mee samayaniki dhanyavadhalu. Namaskaram!";
  }
  if (lang.startsWith("ta")) {
    return "Ungal nerathirku nandri. Vanakkam!";
  }
  return "Thank you so much for your time. Have a wonderful day! Goodbye.";
}
