/**
 * Detects conversational backchannels (passive affirmations / listening signals)
 * such as "hmm", "haan", "okay", "right", "uh-huh", "theek hai".
 * In human conversation, these signify that the listener is paying attention,
 * NOT that the speaker should stop talking.
 */
const BACKCHANNEL_WORDS = new Set([
  "hm",
  "hmm",
  "mhm",
  "uh",
  "um",
  "haan",
  "han",
  "ha",
  "ok",
  "okay",
  "k",
  "right",
  "yeah",
  "ya",
  "yes",
  "yep",
  "sure",
  "theek",
  "accha",
  "acha",
  "sahi",
  "cool",
]);

export function isBackchannel(text: string): boolean {
  const clean = text
    .replace(/\[.*?\]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim()
    .toLowerCase();

  if (!clean) return true; // noise or empty punctuation
  if (BACKCHANNEL_WORDS.has(clean)) return true;

  const words = clean.split(/\s+/);
  if (words.length <= 2 && words.every((w) => BACKCHANNEL_WORDS.has(w))) {
    return true; // e.g. "haan theek", "okay right", "haan haan"
  }

  return false;
}
