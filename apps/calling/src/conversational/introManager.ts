export interface IntroOptions {
  contactName?: string | null;
  persona?: string | null;
  businessName?: string | null;
  customGreeting?: string | null;
  language?: string;
}

export function buildOpeningIntro(options: IntroOptions): string {
  if (options.customGreeting && options.customGreeting.trim().length > 0) {
    return options.customGreeting.trim();
  }

  const name = options.contactName?.trim();
  const persona = options.persona?.trim() || "Aarohi";
  const business = options.businessName?.trim() || "Foolioo";
  const isHindi = options.language?.startsWith("hi");

  if (name && !/^(unknown|test|user|contact|lead)$/i.test(name)) {
    if (isHindi) {
      return `Namaste ${name} ji! Main ${business} se ${persona} baat kar rahi hoon. Aap kaise hain aaj?`;
    }
    return `Hello ${name}! This is ${persona} calling from ${business}. How are you doing today?`;
  }

  if (isHindi) {
    return `Namaste! Main ${business} se ${persona} baat kar rahi hoon. Kya aap mujhe sun pa rahe hain?`;
  }

  return `Hello! This is ${persona} calling from ${business}. Can you hear me okay?`;
}
