const REPEAT_PATTERNS: RegExp[] = [
  /\b(repeat|say (that|it) again|come again|pardon|what was that)\b/i,
  /\b(what did you say|didn't (hear|catch)|missed that)\b/i,
  /\b(can you repeat|could you repeat|repeat please)\b/i,
  /\b(phir se (bolo|batao|kaho)|dobara (bolo|batao|kaho)|wapas bolo)\b/i,
  /\b(kya bole|kya kaha|ek aur baar|fir se bolo|fir se batao)\b/i,
];

export function isRepeatUtterance(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (normalized.length > 90) return false;
  return REPEAT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildRepeatPrefix(language: string = "en-IN"): string {
  const isHindi = language.toLowerCase().startsWith("hi");
  if (isHindi) {
    return "Ji bilkul, main dobara batati hoon: ";
  }
  return "Sure, let me repeat that: ";
}
