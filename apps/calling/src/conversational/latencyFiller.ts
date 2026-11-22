const ENGLISH_FILLERS = [
  "Hmm, let me check that for you.",
  "Right, one moment please.",
  "Sure, looking into that right now.",
  "Got it, give me just a second.",
];

const HINDI_FILLERS = [
  "Haanji, main dekh ke batati hoon ek second.",
  "Ji bilkul, ek second dijiye mujhe.",
  "Theek hai, main check karti hoon.",
];

export function getRandomLatencyFiller(language: string = "en-IN"): string {
  const isHindi = language.toLowerCase().startsWith("hi");
  const pool = isHindi ? HINDI_FILLERS : ENGLISH_FILLERS;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? pool[0]!;
}
