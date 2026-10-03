/**
 * Multilingual language utilities for real-time AI voice calling.
 * Maps Indian and global languages, detects language intents & scripts,
 * and normalizes BCP-47 codes supported by Sarvam STT & Bulbul TTS.
 */

// Supported Sarvam Bulbul:v3 language codes
export const SUPPORTED_LANGUAGES = [
  "en-IN",
  "hi-IN",
  "te-IN",
  "ta-IN",
  "kn-IN",
  "mr-IN",
  "bn-IN",
  "gu-IN",
  "ml-IN",
  "pa-IN",
  "od-IN",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Normalizes input language string into a valid BCP-47 code supported by Sarvam.
 * Falls back to "en-IN" if unspecified or unsupported.
 */
export function normalizeLanguageCode(lang?: string): SupportedLanguage {
  if (!lang) return "en-IN";
  const clean = lang.toLowerCase().trim().replace(/_/g, "-");

  if (clean.startsWith("te") || clean.includes("telugu")) return "te-IN";
  if (clean.startsWith("hi") || clean.includes("hindi")) return "hi-IN";
  if (clean.startsWith("ta") || clean.includes("tamil")) return "ta-IN";
  if (clean.startsWith("kn") || clean.includes("kannada")) return "kn-IN";
  if (clean.startsWith("mr") || clean.includes("marathi")) return "mr-IN";
  if (clean.startsWith("bn") || clean.includes("bengali") || clean.includes("bangla")) return "bn-IN";
  if (clean.startsWith("gu") || clean.includes("gujarati")) return "gu-IN";
  if (clean.startsWith("ml") || clean.includes("malayalam")) return "ml-IN";
  if (clean.startsWith("pa") || clean.includes("punjabi")) return "pa-IN";
  if (clean.startsWith("od") || clean.startsWith("or") || clean.includes("odia")) return "od-IN";
  if (clean.startsWith("en") || clean.includes("english")) return "en-IN";

  return "en-IN";
}

/**
 * Detects language from Unicode script or spoken/written switch requests in the text.
 * Returns the detected BCP-47 code or null if no specific language match was found.
 */
export function detectLanguageFromText(text: string): SupportedLanguage | null {
  if (!text) return null;

  // 1. Unicode Script Range Detection (High confidence)
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN"; // Telugu script
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN"; // Tamil script
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN"; // Kannada script
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml-IN"; // Malayalam script
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN"; // Gujarati script
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN"; // Bengali script
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa-IN"; // Punjabi (Gurmukhi) script
  if (/[\u0B00-\u0B7F]/.test(text)) return "od-IN"; // Odia script
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN"; // Devanagari script (Hindi / Marathi)

  // 2. Keyword / Intent Detection for language switching (Romanized / English / Transliteration)
  const lower = text.toLowerCase();

  // Telugu patterns
  if (/\b(telugu|తెలుగు|matladu|matladandi|matladatava|telugulo)\b/i.test(lower)) return "te-IN";

  // Hindi patterns
  if (/\b(hindi|हिन्दी|हिंदी|baat\s*karo|baat\s*kijiye|bolo|boliye|hindime|hindimein)\b/i.test(lower)) return "hi-IN";

  // Tamil patterns
  if (/\b(tamil|தமிழ்|pesu|pesunga|tamilil)\b/i.test(lower)) return "ta-IN";

  // Kannada patterns
  if (/\b(kannada|ಕನ್ನಡ|mathadi|mathadiri|kannadadalli)\b/i.test(lower)) return "kn-IN";

  // Marathi patterns
  if (/\b(marathi|मराठी|bola|bolaa|marathit)\b/i.test(lower)) return "mr-IN";

  // Bengali patterns
  if (/\b(bengali|bangla|বাংলা|kotha\s*bolun)\b/i.test(lower)) return "bn-IN";

  // Gujarati patterns
  if (/\b(gujarati|ગુજરાતી|vaat\s*karo)\b/i.test(lower)) return "gu-IN";

  // Malayalam patterns
  if (/\b(malayalam|മലയാളം|samsarikku|samsarikkumo)\b/i.test(lower)) return "ml-IN";

  // Punjabi patterns
  if (/\b(punjabi|ਪੰਜਾਬੀ|gall\s*karo|gal\s*karo)\b/i.test(lower)) return "pa-IN";

  // Odia patterns
  if (/\b(odia|oriya|ଓଡ଼ିଆ)\b/i.test(lower)) return "od-IN";

  // Explicit English request
  if (/\b(english|अंग्रेजी|ఇంగ్లీష్|ஆங்கிலம்|in\s*english|speak\s*english)\b/i.test(lower)) return "en-IN";

  return null;
}

/**
 * Returns true if the text represents an intent to change or switch language.
 * Used to prevent accidental auto-hangups.
 */
export function isLanguageSwitchIntent(text: string): boolean {
  if (!text) return false;
  if (detectLanguageFromText(text) !== null) return true;
  return /\b(language|speak|talk|bhasha|bhaasha|matladu|baat\s*karo|switch\s*to)\b/i.test(text);
}
