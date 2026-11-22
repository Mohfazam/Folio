const HOLD_PATTERNS: RegExp[] = [
  /\b(hold on|hold karo|hold kijiye|hold karna|on hold)\b/i,
  /\b(one (second|sec|minute|min)|1 (second|sec|minute|min))\b/i,
  /\b(ek (second|sec|minute|min)|1 (second|minute))\b/i,
  /\b(just a (second|sec|minute|moment))\b/i,
  /\b(wait a (second|sec|minute|moment)|wait wait|please wait)\b/i,
  /\b(ruko|rukna|ruk jao|ruk jaiye|zara rukna|thoda ruko)\b/i,
  /\b(line pe (raho|bane raho|rehna))\b/i,
  /\b(do minute|thodi der)\b/i,
];

export function isHoldUtterance(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (normalized.length > 80) return false;
  return HOLD_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildHoldResponse(language: string = "en-IN"): string {
  const isHindi = language.toLowerCase().startsWith("hi");
  if (isHindi) {
    return "Ji bilkul, aap araam se waqt lijiye, main yahi hoon.";
  }
  return "Sure, take your time, I am right here.";
}
