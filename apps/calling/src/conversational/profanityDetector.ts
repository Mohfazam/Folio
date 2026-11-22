const PROFANITY_PATTERNS: RegExp[] = [
  /\b(fuck|shit|bitch|bastard|asshole|idiot|stupid|shut up|gtfo)\b/i,
  /\b(madarchod|bhenchod|bhosdike|chutiya|chutiye|harami|kutta|kamina|saale|gadhe)\b/i,
  /\b(bakwas mat kar|faltu mat bol|bakwas band kar)\b/i,
];

export function isProfanityUtterance(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  return PROFANITY_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildProfanityWarning(offenseCount: number, language: string = "en-IN"): { replyText: string; shouldHangup: boolean } {
  const isHindi = language.toLowerCase().startsWith("hi");
  if (offenseCount >= 2) {
    return {
      replyText: isHindi
        ? "Anuchit bhasha ke karan main yeh call samapt kar rahi hoon. Namaste."
        : "Due to inappropriate language, I am ending this call now. Goodbye.",
      shouldHangup: true,
    };
  }

  return {
    replyText: isHindi
      ? "Kripya shisht bhasha ka prayog karein, anyatha mujhe call disconnect karni padegi."
      : "I request you to please maintain professional language so I can assist you.",
    shouldHangup: false,
  };
}
