/**
 * Structured Context and Dynamic System Prompt Compiler for Multi-Tech & Multi-Industry AI Calls.
 * Supports SaaS, Developer Tools, AI/Cloud, FinTech, HealthTech, CyberSecurity, E-Commerce, EdTech, and General Tech.
 */

export interface CatalogOffering {
  name: string;
  category?: string;
  price?: string;
  duration?: string;
  description?: string;
  keyBenefits?: string[];
}

export interface ObjectionHandler {
  objection: string;
  counterResponse: string;
}

export interface KnowledgeBaseItem {
  id?: string;
  type:
    | "faq"
    | "product_feature"
    | "pricing_plan"
    | "technical_spec"
    | "troubleshooting"
    | "integration_guide"
    | "competitor_comparison"
    | "case_study"
    | "policy_legal"
    | "document"
    | "course_info"
    | "fee"
    | "deadline"
    | "policy"
    | string;
  title?: string;
  category?: string;
  question?: string;
  content: string;
  tags?: string[];
  metadata?: Record<string, any>;
  priority?: number;
  targetPersonas?: string[];
}

export interface BusinessContext {
  displayName: string;
  industry?: string;
  tagline?: string;
  description?: string;
  operatingHours?: string;
  address?: string;
  supportPhone?: string;
  toneOfVoice?: string;
  aiPersonaName?: string;
  catalogOfferings?: CatalogOffering[];
  guardrails?: string[];
}

export interface CampaignContext {
  name?: string;
  primaryObjective?: string;
  callOpeningHook?: string;
  keyTalkingPoints?: string[];
  objectionHandlers?: ObjectionHandler[];
  callToAction?: string;
  fallbackOffer?: string;
}

export interface ContactContext {
  fullName?: string;
  secondaryName?: string;
  phoneNumber?: string;
  email?: string;
  contextData?: Record<string, any>;
}

export interface PromptContext {
  business?: BusinessContext;
  campaign?: CampaignContext;
  contact?: ContactContext;
  knowledgeBase?: KnowledgeBaseItem[];
  additionalInstructions?: string;
}

export function compileSystemPrompt(ctx: PromptContext): string {
  const sections: string[] = [];

  // 1. Role, Persona & Business Identity
  const b = ctx.business;
  const persona = b?.aiPersonaName || "Assistant";
  const businessName = b?.displayName || "our company";
  const tone = b?.toneOfVoice || "Warm, professional, knowledgeable, conversational, and concise";

  sections.push(
    `### Role & Identity
You are ${persona}, an AI phone agent representing "${businessName}"${b?.industry ? ` in the ${b.industry.replace(/_/g, " ")} sector` : ""}.
Your tone is: ${tone}.
${b?.tagline ? `Company Tagline: "${b.tagline}"` : ""}
${b?.description ? `About the Company / Product: ${b.description}` : ""}
${b?.address ? `Location/Headquarters: ${b.address}` : ""}
${b?.operatingHours ? `Operating Hours / Availability: ${b.operatingHours}` : ""}
${b?.supportPhone ? `Escalation / Human Support Phone: ${b.supportPhone}` : ""}`.trim()
  );

  // 2. Contact Information
  const c = ctx.contact;
  if (c && (c.fullName || c.phoneNumber || c.contextData)) {
    const contactLines: string[] = ["### Call Recipient"];
    if (c.fullName) contactLines.push(`- Recipient Name: ${c.fullName}`);
    if (c.secondaryName) contactLines.push(`- Related / Secondary Contact: ${c.secondaryName}`);
    if (c.email) contactLines.push(`- Email: ${c.email}`);
    if (c.phoneNumber) contactLines.push(`- Phone: ${c.phoneNumber}`);

    if (c.contextData && Object.keys(c.contextData).length > 0) {
      contactLines.push("- Dynamic Customer Details & Profile:");
      for (const [k, v] of Object.entries(c.contextData)) {
        contactLines.push(`  • ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
      }
    }
    sections.push(contactLines.join("\n"));
  }

  // 3. Campaign Goals & Call Playbook
  const cp = ctx.campaign;
  if (cp) {
    const campaignLines: string[] = ["### Campaign Objective & Flow"];
    if (cp.name) campaignLines.push(`- Campaign Name: ${cp.name}`);
    if (cp.primaryObjective) campaignLines.push(`- Primary Objective: ${cp.primaryObjective}`);
    if (cp.callOpeningHook) campaignLines.push(`- Opening Hook: "${cp.callOpeningHook}"`);

    if (cp.keyTalkingPoints && cp.keyTalkingPoints.length > 0) {
      campaignLines.push("- Key Talking Points to weave in naturally:");
      for (const point of cp.keyTalkingPoints) {
        campaignLines.push(`  • ${point}`);
      }
    }

    if (cp.callToAction) campaignLines.push(`- Desired Call-To-Action (Closing): ${cp.callToAction}`);
    if (cp.fallbackOffer) campaignLines.push(`- Fallback Offer (if recipient is hesitant/busy): ${cp.fallbackOffer}`);

    sections.push(campaignLines.join("\n"));
  }

  // 4. Catalog / Offerings
  if (b?.catalogOfferings && b.catalogOfferings.length > 0) {
    const catalogLines: string[] = ["### Products, Services & Offerings Catalog"];
    for (const item of b.catalogOfferings) {
      const details = [
        item.category ? `Category: ${item.category}` : null,
        item.price ? `Price: ${item.price}` : null,
        item.duration ? `Duration/Tier: ${item.duration}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      catalogLines.push(`- **${item.name}**${details ? ` (${details})` : ""}: ${item.description || ""}`);
      if (item.keyBenefits && item.keyBenefits.length > 0) {
        catalogLines.push(`  Benefits: ${item.keyBenefits.join(", ")}`);
      }
    }
    sections.push(catalogLines.join("\n"));
  }

  // 5. Sophisticated Multi-Tech Knowledge Base
  if (ctx.knowledgeBase && ctx.knowledgeBase.length > 0) {
    const kbLines: string[] = ["### Company Knowledge Base & Technical Intelligence"];

    // Group entries by type for maximum prompt clarity
    const grouped: Record<string, KnowledgeBaseItem[]> = {};
    for (const entry of ctx.knowledgeBase) {
      const type = entry.type || "general";
      if (!grouped[type]) grouped[type] = [];
      grouped[type]!.push(entry);
    }

    const typeLabels: Record<string, string> = {
      product_feature: "Product Features & Architecture",
      technical_spec: "Technical Specs, Security & Compliance",
      integration_guide: "APIs, Webhooks & Integrations",
      pricing_plan: "Pricing Plans & Licensing",
      fee: "Fees & Pricing Structure",
      competitor_comparison: "Competitive Differentiators & Battlecards",
      troubleshooting: "Troubleshooting & Common Technical Issues",
      case_study: "Case Studies & Customer Proof Points",
      faq: "Frequently Asked Questions",
      policy_legal: "Legal, Privacy & Policies",
      policy: "Policies & Terms",
      deadline: "Deadlines & Milestones",
      course_info: "Course / Curriculum Details",
      document: "Documentation & Reference Notes",
    };

    for (const [type, items] of Object.entries(grouped)) {
      const header = typeLabels[type] || `${type.toUpperCase()} Reference`;
      kbLines.push(`\n#### ${header}:`);

      for (const item of items) {
        const titleOrQuestion = item.title || item.question || "";
        const categoryTag = item.category ? `[Category: ${item.category}] ` : "";
        const tags = item.tags && item.tags.length > 0 ? ` (Tags: ${item.tags.join(", ")})` : "";
        
        let metaString = "";
        if (item.metadata && Object.keys(item.metadata).length > 0) {
          metaString = ` | Specs: ${JSON.stringify(item.metadata)}`;
        }

        if (titleOrQuestion) {
          kbLines.push(`- **${categoryTag}${titleOrQuestion}**${tags}${metaString}:`);
          kbLines.push(`  ${item.content}`);
        } else {
          kbLines.push(`- ${categoryTag}${item.content}${tags}${metaString}`);
        }
      }
    }

    sections.push(kbLines.join("\n"));
  }

  // 6. Objection Handling
  if (cp?.objectionHandlers && cp.objectionHandlers.length > 0) {
    const objectionLines: string[] = ["### Objection Handling Guide"];
    for (const obj of cp.objectionHandlers) {
      objectionLines.push(`- If the caller says: "${obj.objection}"`);
      objectionLines.push(`  Recommended Response: "${obj.counterResponse}"`);
    }
    sections.push(objectionLines.join("\n"));
  }

  // 7. Hard Guardrails & Boundaries
  const guardrails: string[] = [
    "Speak conversationally and keep each turn to 1-2 sentences so the call feels natural.",
    "Never invent prices, specs, discounts, or policies not listed in this knowledge base or prompt.",
    "Do not sound robotic or read bullet points like a script; adapt to the caller's responses.",
    "When the conversation is completed (e.g. the caller says goodbye, confirms no more questions, says they are not interested, or you finish your final farewell), deliver a warm closing and append [HANGUP] at the end of your response.",
    "If the caller asks for human escalation or questions outside your scope, offer to have a representative call them back or share the support number.",
    "MULTILINGUAL: Always respond in the same language the caller is speaking. If they switch languages mid-call, switch with them seamlessly. Never offer to transfer to a human or end the call because of a language change. You are fully fluent in all supported Indian languages.",
    "When responding in an Indian language, use its native script (Devanagari for Hindi, Telugu script for Telugu, etc.). Never use romanized transliteration for Indian language responses.",
    ...(b?.guardrails || []),
  ];

  sections.push(`### Guardrails & Safety\n${guardrails.map((g) => `- ${g}`).join("\n")}`);

  // 8. Additional One-Off Instructions
  if (ctx.additionalInstructions) {
    sections.push(`### Special Instructions for this Call\n${ctx.additionalInstructions}`);
  }

  return sections.join("\n\n");
}

/**
 * Builds a natural, personalized outbound opening greeting based on context.
 * Falls back to an appropriate outbound greeting if details are missing.
 */
export function buildPersonalizedGreeting(ctx?: PromptContext): string {
  const DEFAULT_OUTBOUND_GREETING = "Hello! Thanks for taking my call. Do you have a quick moment?";
  if (!ctx) return DEFAULT_OUTBOUND_GREETING;

  const businessName = ctx.business?.displayName?.trim();
  const persona = ctx.business?.aiPersonaName?.trim();
  const contactName = ctx.contact?.fullName?.trim();
  const hook = ctx.campaign?.callOpeningHook?.trim();
  const objective = ctx.campaign?.primaryObjective?.trim();

  // 1. Explicit campaign opening hook provided
  if (hook) {
    if (contactName && !new RegExp(`\\b${contactName}\\b`, "i").test(hook)) {
      return `Hi ${contactName}! ${hook}`;
    }
    return hook;
  }

  // 2. Both business and contact name known
  if (businessName && contactName) {
    const callerIntro = persona ? `this is ${persona} calling from ${businessName}` : `calling from ${businessName}`;
    if (objective) {
      return `Hi ${contactName}, ${callerIntro} regarding ${objective}. Do you have a quick moment?`;
    }
    return `Hi ${contactName}, ${callerIntro}. Do you have a quick moment to speak?`;
  }

  // 3. Only business known
  if (businessName) {
    const callerIntro = persona ? `this is ${persona} calling from ${businessName}` : `calling from ${businessName}`;
    if (objective) {
      return `Hello! ${callerIntro} regarding ${objective}. Do you have a moment to speak?`;
    }
    return `Hello! ${callerIntro}. Do you have a quick moment?`;
  }

  // 4. Only contact name known
  if (contactName) {
    return `Hi ${contactName}! Thanks for taking my call. Do you have a quick moment?`;
  }

  // 5. Default fallback
  return DEFAULT_OUTBOUND_GREETING;
}
