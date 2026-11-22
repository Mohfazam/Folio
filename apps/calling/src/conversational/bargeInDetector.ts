import { isBackchannel } from "./backchannelDetector.js";
import { isGenericGreeting } from "./genericGreetingTracker.js";
import { isLanguageSwitchIntent } from "../utils/language.js";

/**
 * Common background chatter, ambient filler, and low-intent conversational murmurs
 * that should NEVER interrupt ongoing AI speech playback.
 */
const AMBIENT_MURMUR_PATTERNS = [
  /^(and\s+(so|then|yeah|what|now)|in\s+the|at\s+the|of\s+the|to\s+the|for\s+the|on\s+the)\b/i,
  /^(you\s+know|i\s+mean|i\s+think|like\s+this|so\s+yeah|oh\s+yeah|yeah\s+yeah|all\s+right)\b/i,
  /^(kya\s+hua|arre\s+yaar|haan\s+bhai|theek\s+hai\s+na|dekho\s+ye|chalo\s+aao|pani\s+lao|idhar\s+aao)\b/i,
  /^(woh\s+to|kuch\s+nahi|kya\s+hai\s+ye|sun\s+na|acha\s+baba|haan\s+re)\b/i,
  /^(enti\s+idi|chudu|ikkadiki\s+ra|em\s+ledu|sare\s+le)\b/i,
];

/**
 * Explicit conversational interruption commands directed at the speaker.
 */
const EXPLICIT_INTERRUPT_COMMANDS =
  /\b(wait|hold on|please wait|stop|listen|just listen|ruko|ruk jao|ek second|ek minute|suno|zara suno|aagandi|aagu|thamba|oru nimisham)\b/i;

/**
 * Question markers indicating the caller is actively asking a question mid-speech.
 */
const QUESTION_PATTERNS = [
  // English questions
  /\b(what|why|how|when|where|who|which|how much|can you|could you|tell me|what is)\b/i,
  // Hindi questions
  /\b(kya|kyun|kaise|kab|kahan|kaun|kitna|kitne|kitni|bataiye|batao)\b/i,
  // Telugu questions
  /\b(enti|enduku|ela|eppudu|ekkada|evvaru|enta|cheppandi)\b/i,
  // Tamil questions
  /\b(enna|yen|eppadi|eppo|enge|yaar|evvalavu|sollunga)\b/i,
];

export interface BargeInOptions {
  lastAssistantReply?: string;
  currentLanguage?: string;
}

/**
 * Calculates word overlap between caller partial and recent AI speech to detect acoustic echo / speaker bleed.
 * Returns true if >= 50% of the words in partialText match words in assistantSpeech.
 */
export function isAcousticEcho(partialText: string, assistantSpeech?: string): boolean {
  if (!assistantSpeech || !partialText) return false;
  const callerWords = partialText
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (callerWords.length === 0) return false;

  const assistantTextLower = assistantSpeech.toLowerCase().replace(/[^\w\s]/g, " ");
  const assistantWords = new Set(assistantTextLower.split(/\s+/).filter(Boolean));

  let matchCount = 0;
  for (const word of callerWords) {
    if (assistantWords.has(word) || assistantTextLower.includes(word)) {
      matchCount++;
    }
  }

  return matchCount / callerWords.length >= 0.5;
}

/**
 * Evaluates whether an STT partial transcript represents a genuine caller interruption
 * while AI speech playback is actively in progress.
 *
 * Rules:
 * 1. Reject acoustic echo (speaker bleed from phone earpiece/speaker).
 * 2. Reject passive backchannels ("haan", "hmm", "okay").
 * 3. Reject solitary greetings ("hello", "hi").
 * 4. Reject background murmur / ambient chatter fragments.
 * 5. Accept explicit interruption commands ("wait", "ruko", "stop", "hold on", "suno").
 * 6. Accept direct questions ("what is the fee", "kitna lagega", "enti cost").
 * 7. Accept explicit language switch requests ("Hindi me bolo", "Can you speak Telugu").
 * 8. Accept substantive utterances (>= 4 words, >= 16 characters) not matching ambient chatter.
 */
export function shouldBargeIn(partialText: string, options?: BargeInOptions): boolean {
  const clean = partialText.trim();
  if (!clean || clean.length < 3) return false;

  // 1. Acoustic echo suppression
  if (options?.lastAssistantReply && isAcousticEcho(clean, options.lastAssistantReply)) {
    return false;
  }

  // 2. Passive backchannels & solitary greetings
  if (isBackchannel(clean) || isGenericGreeting(clean)) {
    return false;
  }

  // 3. Explicit language switch request (High priority: switch immediately)
  if (isLanguageSwitchIntent(clean)) {
    return true;
  }

  // 4. Explicit verbal interruption command ("wait", "stop", "ruko", "hold on", "suno")
  if (EXPLICIT_INTERRUPT_COMMANDS.test(clean)) {
    return true;
  }

  // 5. Direct active question
  const isQuestion = QUESTION_PATTERNS.some((p) => p.test(clean));
  const words = clean.split(/\s+/);
  if (isQuestion && words.length >= 2) {
    return true;
  }

  // 6. Filter out common ambient room chatter & background TV noise
  if (AMBIENT_MURMUR_PATTERNS.some((p) => p.test(clean))) {
    return false;
  }

  // 7. Substantive caller statement: must be at least 4 distinct words and >= 16 chars
  if (words.length >= 4 && clean.length >= 16) {
    return true;
  }

  // Otherwise, default to letting the AI finish her sentence smoothly
  return false;
}
