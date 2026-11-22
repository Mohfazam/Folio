const TRANSFER_PATTERNS: RegExp[] = [
  /\b(talk to (a )?human|speak to (a )?human|real person|human agent|live agent)\b/i,
  /\b(connect (me )?to (a )?(human|person|agent|representative|manager))\b/i,
  /\b(customer (service|care) executive|talk to manager|speak to manager)\b/i,
  /\b(insaan se baat|agent se baat|representative se baat|manager se baat)\b/i,
  /\b(kisi aur se baat|kisi aur ko phone do)\b/i,
];

export function isTransferUtterance(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (normalized.length > 100) return false;
  return TRANSFER_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildTransferResponse(language: string = "en-IN"): string {
  const isHindi = language.toLowerCase().startsWith("hi");
  if (isHindi) {
    return "Main samajh sakti hoon. Main note kar leti hoon ki aap senior representative se baat karna chahte hain aur callback schedule kar deti hoon. Tab tak ke liye main aapki kya madad kar sakti hoon?";
  }
  return "I understand. I have noted your request for a human specialist and will arrange a callback. In the meantime, what questions can I help answer for you right now?";
}
