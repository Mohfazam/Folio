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
  threshold = 3
): EdgeCaseAction | null {
  if (!isGenericGreeting(text)) {
    // Reset consecutive hello count if caller said a real sentence
    state.consecutiveHelloCount = 0;
    return null;
  }

  state.consecutiveHelloCount++;
  state.totalHelloCount++;

  // While still delivering intro, ignore up to 2 early "hello"s so she finishes her opening
  if (!state.introCompleted && state.consecutiveHelloCount <= 2) {
    return { type: "continue_intro" };
  }

  // Once threshold is reached (e.g. 3 consecutive "hellos"), stop and directly check audibility
  if (state.consecutiveHelloCount >= threshold) {
    state.hasAudioComplaint = true;
    return {
      type: "audibility_check",
      replyText: "Hello! Yes, you are audible! Can you hear me clearly?",
    };
  }

  return null;
}
