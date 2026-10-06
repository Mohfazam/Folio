import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
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

/**
 * GET /api/business-profile
 *
 * Fetch business profile for a client.
 */
export async function getBusinessProfileRoute(req: Request, res: Response) {
  try {
    const { clientId } = req.query as { clientId?: string };

    if (!clientId) {
      return res.status(400).json({ ok: false, error: "clientId query parameter is required" });
    }

    const [profile] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.clientId, clientId))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ ok: false, error: `No business profile found for clientId: ${clientId}` });
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
    const {
      clientId,
      industry = "general",
      displayName,
      tagline,
      description,
      website,
      address,
      operatingHours,
      supportPhone,
      catalogOfferings = [],
      toneOfVoice = "Warm, professional, knowledgeable, and concise",
      aiPersonaName = "Assistant",
      guardrails = [],
      keyDifferentiators = [],
      complianceNotes,
      metadata = {},
    } = req.body as {
      clientId?: string;
      industry?: string;
      displayName?: string;
      tagline?: string;
      description?: string;
      website?: string;
      address?: string;
      operatingHours?: string;
      supportPhone?: string;
      catalogOfferings?: any[];
      toneOfVoice?: string;
      aiPersonaName?: string;
      guardrails?: string[];
      keyDifferentiators?: string[];
      complianceNotes?: string;
      metadata?: Record<string, any>;
    };

    if (!clientId || !displayName || !description) {
      return res.status(400).json({
        ok: false,
        error: "clientId, displayName, and description are required",
      });
    }

    const validatedIndustry = VALID_INDUSTRIES.includes(industry as IndustryType)
      ? (industry as IndustryType)
      : "general";

    const [existing] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.clientId, clientId))
      .limit(1);

    let result;

    if (existing) {
      const [updated] = await db
        .update(businessProfiles)
        .set({
          industry: validatedIndustry,
          displayName,
          tagline: tagline ?? null,
          description,
          website: website ?? null,
          address: address ?? null,
          operatingHours: operatingHours ?? null,
          supportPhone: supportPhone ?? null,
          catalogOfferings,
          toneOfVoice,
          aiPersonaName,
          guardrails,
          keyDifferentiators,
          complianceNotes: complianceNotes ?? null,
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(businessProfiles.id, existing.id))
        .returning();
      result = updated;
    } else {
      const [inserted] = await db
        .insert(businessProfiles)
        .values({
          clientId,
          industry: validatedIndustry,
          displayName,
          tagline: tagline ?? null,
          description,
          website: website ?? null,
          address: address ?? null,
          operatingHours: operatingHours ?? null,
          supportPhone: supportPhone ?? null,
          catalogOfferings,
          toneOfVoice,
          aiPersonaName,
          guardrails,
          keyDifferentiators,
          complianceNotes: complianceNotes ?? null,
          metadata,
        })
        .returning();
      result = inserted;
    }

    return res.status(existing ? 200 : 201).json({
      ok: true,
      businessProfile: result,
    });
  } catch (err: unknown) {
    console.error("[business-profile/upsert] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
