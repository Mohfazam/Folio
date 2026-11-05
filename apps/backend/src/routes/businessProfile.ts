import type { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { businessProfiles } from "@repo/db";

const VALID_INDUSTRIES = [
  "saas_software",
  "developer_tools",
  "fintech",
  "ai_cloud",
  "healthtech",
  "ecommerce_retail",
  "cybersecurity",
  "education",
  "beauty_wellness",
  "healthcare",
  "real_estate",
  "automotive",
  "fitness",
  "professional_services",
  "retail",
  "general",
] as const;
type IndustryType = (typeof VALID_INDUSTRIES)[number];


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function configuredLanguages(): string[] {
  const raw = process.env.FOOLIOO_LANGUAGE_CATALOG_JSON;
  if (!raw) return ["en-IN"];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ["en-IN"];
    const result = parsed.flatMap((item) => isRecord(item) && typeof item.code === "string" ? [item.code] : []);
    return result.length ? result : ["en-IN"];
  } catch {
    return ["en-IN"];
  }
}

function configuredVoiceIds(): string[] {
  const raw = process.env.FOOLIOO_VOICE_CATALOG_JSON;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => isRecord(item) && typeof item.id === "string" ? [item.id] : []);
  } catch {
    return [];
  }
}

function normalizeAgentSettings(value: unknown, profileGuardrails: string[], complianceNotes: string | null) {
  if (!isRecord(value)) return { ok: false as const, error: "Agent settings must be an object." };
  const agentName = cleanString(value.agentName, 80);
  const tone = cleanString(value.tone, 500);
  const language = cleanString(value.language, 20) ?? "en-IN";
  const greeting = cleanString(value.greeting, 2000);
  const primaryObjective = cleanString(value.primaryObjective, 1500);
  const handoffInstructions = cleanString(value.handoffInstructions, 1500) ?? "";
  const pronunciationNotes = cleanString(value.pronunciationNotes, 2000) ?? "";
  const speechRate = typeof value.speechRate === "number" ? value.speechRate : Number(value.speechRate ?? 1);
  const voiceId = cleanString(value.voiceId, 160);
  const guardrails = profileGuardrails;

  if (!agentName || !tone || !greeting || !primaryObjective) {
    return { ok: false as const, error: "Agent name, speaking style, opening greeting and primary objective are required." };
  }
  const languages = configuredLanguages();
  if (!languages.includes(language)) {
    return { ok: false as const, error: "Choose a language enabled in the configured voice catalogue." };
  }
  if (!Number.isFinite(speechRate) || speechRate < 0.8 || speechRate > 1.2) {
    return { ok: false as const, error: "Speaking speed must be between 0.8x and 1.2x." };
  }
  const voices = configuredVoiceIds();
  if (voiceId && voices.length > 0 && !voices.includes(voiceId)) {
    return { ok: false as const, error: "Choose a voice from the configured voice catalogue." };
  }
  if (!guardrails.length) {
    return { ok: false as const, error: "Add at least one safety rule for your agent." };
  }

  return {
    ok: true as const,
    settings: {
      version: 1, agentName, tone, language, speechRate, voiceId: voiceId || null, greeting,
      primaryObjective, handoffInstructions, pronunciationNotes,
      complianceNotes: complianceNotes ?? "",
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * GET /api/business-profile
 *
 * Fetch business profile for a client.
 */
export async function getBusinessProfileRoute(req: Request, res: Response) {
  try {
    const [profile] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.clientId, req.clientId!))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ ok: false, error: "No business profile found for this workspace" });
    }

    return res.json({
      ok: true,
      businessProfile: profile,
    });
  } catch (err: unknown) {
    console.error("[business-profile/get] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * POST /api/business-profile (or PUT)
 *
 * Upsert business profile for a client.
 */
export async function upsertBusinessProfileRoute(req: Request, res: Response) {
  try {
    const body = isRecord(req.body) ? req.body : {};
    const clientId = req.clientId!;
    const [existing] = await db.select().from(businessProfiles)
      .where(eq(businessProfiles.clientId, clientId)).limit(1);

    // Omitted fields preserve the existing profile. This matters when the same
    // endpoint is used to update only the AI persona configuration.
    const industry = typeof body.industry === "string" ? body.industry : existing?.industry ?? "general";
    const displayName = cleanString(body.displayName, 180) ?? existing?.displayName ?? null;
    const description = cleanString(body.description, 5000) ?? existing?.description ?? null;
    const tagline = body.tagline === undefined ? existing?.tagline ?? null : cleanString(body.tagline, 300);
    const website = body.website === undefined ? existing?.website ?? null : cleanString(body.website, 500);
    const address = body.address === undefined ? existing?.address ?? null : cleanString(body.address, 1000);
    const operatingHours = body.operatingHours === undefined ? existing?.operatingHours ?? null : cleanString(body.operatingHours, 500);
    const supportPhone = body.supportPhone === undefined ? existing?.supportPhone ?? null : cleanString(body.supportPhone, 40);
    const toneOfVoice = cleanString(body.toneOfVoice, 500) ?? existing?.toneOfVoice ?? "Warm, professional, knowledgeable, and concise";
    const aiPersonaName = cleanString(body.aiPersonaName, 80) ?? existing?.aiPersonaName ?? "Assistant";
    const complianceNotes = body.complianceNotes === undefined ? existing?.complianceNotes ?? null : cleanString(body.complianceNotes, 3000);
    const guardrails = Array.isArray(body.guardrails)
      ? [...new Set(body.guardrails.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 30)
      : existing?.guardrails ?? [];
    const catalogOfferings = Array.isArray(body.catalogOfferings) ? body.catalogOfferings : existing?.catalogOfferings ?? [];
    const keyDifferentiators = Array.isArray(body.keyDifferentiators)
      ? body.keyDifferentiators.filter((item): item is string => typeof item === "string").slice(0, 30)
      : existing?.keyDifferentiators ?? [];
    const incomingMetadata = isRecord(body.metadata) ? body.metadata : {};

    if (!displayName || !description) {
      return res.status(400).json({ ok: false, error: "Business name and description are required." });
    }
    if (!VALID_INDUSTRIES.includes(industry as IndustryType)) {
      return res.status(400).json({ ok: false, error: "Choose a supported business industry." });
    }

    // The existing business-profile endpoint also stores the agent-specific settings.
    // Provider-independent settings live in metadata.aiAgentSettings, avoiding a schema migration.
    let agentSettings: Record<string, unknown> | null = null;
    if (body.agentSettings !== undefined) {
      const normalized = normalizeAgentSettings(body.agentSettings, guardrails, complianceNotes);
      if (!normalized.ok) return res.status(400).json({ ok: false, error: normalized.error });
      agentSettings = normalized.settings;
    }

    const insertMetadata: Record<string, unknown> = {
      ...incomingMetadata,
      ...(agentSettings ? { aiAgentSettings: agentSettings } : {}),
    };

    const savedAgentName = agentSettings && typeof agentSettings.agentName === "string"
      ? agentSettings.agentName
      : aiPersonaName;
    const savedTone = agentSettings && typeof agentSettings.tone === "string"
      ? agentSettings.tone
      : toneOfVoice;
    const profileValues = {
      industry: industry as IndustryType, displayName, tagline, description, website, address, operatingHours, supportPhone,
      catalogOfferings, toneOfVoice: savedTone, aiPersonaName: savedAgentName,
      guardrails, keyDifferentiators, complianceNotes, updatedAt: new Date(),
    };

    let result;
    if (existing) {
      const metadataExpression = agentSettings
        ? sql`jsonb_set(COALESCE(${businessProfiles.metadata}, '{}'::jsonb) || ${JSON.stringify(incomingMetadata)}::jsonb, '{aiAgentSettings}', ${JSON.stringify(agentSettings)}::jsonb, true)`
        : sql`COALESCE(${businessProfiles.metadata}, '{}'::jsonb) || ${JSON.stringify(incomingMetadata)}::jsonb`;
      const [updated] = await db.update(businessProfiles).set({ ...profileValues, metadata: metadataExpression })
        .where(eq(businessProfiles.id, existing.id)).returning();
      result = updated;
    } else {
      const [inserted] = await db.insert(businessProfiles).values({ clientId, ...profileValues, metadata: insertMetadata }).returning();
      result = inserted;
    }

    return res.status(existing ? 200 : 201).json({
      ok: true, businessProfile: result, agentSettings: agentSettings ?? (isRecord(insertMetadata.aiAgentSettings) ? insertMetadata.aiAgentSettings : null),
    });
  } catch (err: unknown) {
    console.error("[business-profile/upsert] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
