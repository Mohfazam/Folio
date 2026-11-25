import type { CallerIntentState, EdgeCaseAction } from "./types.js";

const GENERIC_GREETINGS = new Set([
  "hello",
  "helo",
  "hellow",
  "hallo",
  "hi",
  "hey",
  "haanji",
  "hanji",
  "haan",
  "han",
  "namaste",
  "namaskar",
  "yes",
  "speaking",
  "yes speaking",
  "who is this",
  "who this",
  "kaun bol raha hai",
  "kon bol raha hai",
  "kon hai",
  "kaun hai",
]);

export function isGenericGreeting(text: string): boolean {
  const clean = text
    .replace(/\[.*?\]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim()
    .toLowerCase();

  if (!clean) return false;
  if (GENERIC_GREETINGS.has(clean)) return true;

  const words = clean.split(/\s+/);
  // Matches e.g. "hello hello", "haanji hello", "yes hello speaking"
  if (words.length <= 3 && words.every((w) => GENERIC_GREETINGS.has(w))) {
    return true;
  }

  return false;
}

export function handleGenericGreeting(
  text: string,
  state: CallerIntentState,
  threshold = 2,
  language = "en-IN"
): EdgeCaseAction | null {
  if (!isGenericGreeting(text)) {
    // Reset consecutive hello count if caller said a real sentence
    state.consecutiveHelloCount = 0;
    return null;
  }

  state.consecutiveHelloCount++;
  state.totalHelloCount++;

  // Always mark intro completed on any caller greeting so we never swallow subsequent speech
  state.introCompleted = true;

  // Once threshold is reached (e.g. 2 consecutive "hellos"), directly reassure audibility
  if (state.consecutiveHelloCount >= threshold) {
    state.hasAudioComplaint = true;
    const isHindi = language.toLowerCase().startsWith("hi");
    const replyText = isHindi
      ? "Haanji, bilkul! Main aapko sun pa rahi hoon. Kya aapko meri aawaz aa rahi hai?"
      : "Hello! Yes, I can hear you clearly! Can you hear me okay?";
    return {
      type: "audibility_check",
      replyText,
    };
  }

  // Pass through to the conversational LLM immediately so it acknowledges and advances the conversation
  return null;
}
