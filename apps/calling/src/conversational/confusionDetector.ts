const CONFUSION_PATTERNS: RegExp[] = [
  /\b(i don't understand|didn't understand|i don't get it|makes no sense)\b/i,
  /\b(what do you mean|what does that mean|confused|not clear)\b/i,
  /\b(samajh nahi aaya|samajh nahi aa raha|samjha nahi|kuch samajh nahi)\b/i,
  /\b(kya keh rahe ho|kya matlab|matlab kya hai|kya kehna chahte ho)\b/i,
];

export function isConfusionUtterance(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (normalized.length > 90) return false;
  return CONFUSION_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildClarificationPrefix(language: string = "en-IN"): string {
  const isHindi = language.toLowerCase().startsWith("hi");
  if (isHindi) {
    return "Ji koi baat nahi, main aasan shabdon mein bata deti hoon: ";
  }
  return "No problem at all, let me put it simply: ";
}
