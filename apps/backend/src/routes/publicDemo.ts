import type { Request, Response } from "express";
import { and, eq, gte, inArray } from "drizzle-orm";

import { db } from "../config/db.js";
import { matchesSecret } from "../middleware/auth.js";
import {
  auditLog,
  businessProfiles,
  callQueue,
  clients,
  contacts,
} from "@repo/db";

const ALLOWED_SCENARIOS = new Set([
  "admissions",
  "student-support",
  "general-enquiry",
]);

const ALLOWED_LANGUAGES = new Set([
  "en-IN",
  "hi-IN",
  "te-IN",
  "ta-IN",
  "kn-IN",
  "ml-IN",
]);

const MAX_CALL_SECONDS = 120;
const RESERVED_CREDITS = Math.ceil(MAX_CALL_SECONDS / 10);

const PHONE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DAILY_REQUEST_LIMIT = 20;
const MAX_CONCURRENT_DEMOS = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function istDayStart(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (key: string) =>
    parts.find((part) => part.type === key)?.value ?? "";

  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T00:00:00+05:30`
  );
}

async function verifyTurnstile(
  token: string,
  remoteIp: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();

  if (!secret || !token || token.length > 4096) {
    return false;
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret,
          response: token,
          ...(remoteIp ? { remoteip: remoteIp } : {}),
        }),
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(
        "[Turnstile] Cloudflare verification request failed:",
        response.status
      );
      return false;
    }

    const result = (await response.json()) as {
      success?: boolean;
      action?: string;
      hostname?: string;
    };

    const allowedHostnames = (
      process.env.PUBLIC_DEMO_ALLOWED_HOSTNAMES ?? ""
    )
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean);

    const hostnameAllowed =
      allowedHostnames.length > 0
        ? Boolean(
            result.hostname &&
              allowedHostnames.includes(result.hostname.toLowerCase())
          )
        : process.env.NODE_ENV !== "production";

    return (
      result.success === true &&
      result.action === "public_demo" &&
      hostnameAllowed
    );
  } catch (error) {
    console.error("[Turnstile] Verification request failed:", error);
    return false;
  }
}

/**
 * POST /api/public-demo
 *
 * Anonymous requests are accepted only from the trusted website proxy.
 */
export async function createPublicDemoRoute(
  req: Request,
  res: Response
) {
  if (process.env.PUBLIC_DEMO_ENABLED !== "true") {
    return res.status(503).json({
      ok: false,
      error: "The live demo is temporarily unavailable.",
    });
  }

  const proxySecret = process.env.PUBLIC_DEMO_PROXY_SECRET?.trim();

  if (
    !proxySecret ||
    !matchesSecret(
      proxySecret,
      req.get("x-public-demo-proxy-secret")?.trim()
    )
  ) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized demo request.",
    });
  }

  const body = isRecord(req.body) ? req.body : {};

  const phoneNumber =
    typeof body.phoneNumber === "string"
      ? body.phoneNumber.trim()
      : "";

  const scenario =
    typeof body.scenario === "string"
      ? body.scenario
      : "";

  const language =
    typeof body.language === "string"
      ? body.language
      : "";

  const captchaToken =
    typeof body.captchaToken === "string"
      ? body.captchaToken
      : "";

  const remoteIp =
    req.get("x-public-demo-ip")?.trim() ?? "";

  // Validate Indian mobile number.
  if (!/^\+91[6-9]\d{9}$/.test(phoneNumber)) {
    return res.status(400).json({
      ok: false,
      error:
        "For now, live demo calls are available to valid Indian mobile numbers only.",
    });
  }

  if (!ALLOWED_SCENARIOS.has(scenario)) {
    return res.status(400).json({
      ok: false,
      error: "Choose a supported demo scenario.",
    });
  }

  if (!ALLOWED_LANGUAGES.has(language)) {
    return res.status(400).json({
      ok: false,
      error: "Choose a supported conversation language.",
    });
  }

  if (body.consent !== true) {
    return res.status(400).json({
      ok: false,
      error:
        "Explicit consent is required before requesting a demo call.",
    });
  }

  if (!captchaToken || captchaToken.length > 4096) {
    return res.status(400).json({
      ok: false,
      error:
        "Complete the security check before requesting a call.",
    });
  }

  // Verify Cloudflare Turnstile.
  if (!(await verifyTurnstile(captchaToken, remoteIp))) {
    return res.status(403).json({
      ok: false,
      error:
        "Security verification failed. Refresh the check and try again.",
    });
  }

  const demoClientId = process.env.PUBLIC_DEMO_CLIENT_ID?.trim();

  if (!demoClientId) {
    return res.status(503).json({
      ok: false,
      error: "The live demo is not configured yet.",
    });
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Lock the dedicated showcase workspace row.
      // This serializes public-demo requests across replicas.
      const [client] = await tx
        .select()
        .from(clients)
        .where(eq(clients.id, demoClientId))
        .for("update")
        .limit(1);

      if (!client || !["active", "trialing"].includes(client.status)) {
        return {
          ok: false as const,
          status: 503,
          error: "The live demo is temporarily unavailable.",
        };
      }

      // Verify that the showcase agent is configured.
      const [profile] = await tx
        .select({
          metadata: businessProfiles.metadata,
        })
        .from(businessProfiles)
        .where(eq(businessProfiles.clientId, demoClientId))
        .limit(1);

      const profileMetadata = isRecord(profile?.metadata)
        ? profile.metadata
        : {};

      const agentSettings = profileMetadata.aiAgentSettings;

      if (
        !isRecord(agentSettings) ||
        !agentSettings.voiceId ||
        !agentSettings.greeting ||
        !agentSettings.primaryObjective
      ) {
        return {
          ok: false as const,
          status: 503,
          error:
            "The live demo agent is not ready yet. Please try again later.",
        };
      }

      // Enforce one request per phone number every 24 hours.
      const cutoff = new Date(Date.now() - PHONE_COOLDOWN_MS);

      const recentSameNumber = await tx
        .select({
          customFields: contacts.customFields,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.clientId, demoClientId),
            eq(contacts.phoneNumber, phoneNumber),
            gte(contacts.createdAt, cutoff)
          )
        );

      const alreadyRequested = recentSameNumber.some(
        (row) =>
          isRecord(row.customFields) &&
          row.customFields._fooliooSystem === "public_demo"
      );

      if (alreadyRequested) {
        return {
          ok: false as const,
          status: 429,
          error:
            "This number has already received a demo call recently. You can request another demo after 24 hours.",
        };
      }

      // Enforce the daily request limit using Indian Standard Time.
      const todayContacts = await tx
        .select({
          customFields: contacts.customFields,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.clientId, demoClientId),
            gte(contacts.createdAt, istDayStart())
          )
        );

      const todayDemoCount = todayContacts.filter(
        (row) =>
          isRecord(row.customFields) &&
          row.customFields._fooliooSystem === "public_demo"
      ).length;

      if (todayDemoCount >= DAILY_REQUEST_LIMIT) {
        return {
          ok: false as const,
          status: 429,
          error:
            "Today's live demo capacity has been reached. Please try again tomorrow.",
        };
      }

      // Enforce the concurrent demo limit.
      const activeQueue = await tx
        .select({
          id: callQueue.id,
        })
        .from(callQueue)
        .where(
          and(
            eq(callQueue.clientId, demoClientId),
            inArray(callQueue.status, ["pending", "in_progress"])
          )
        );

      if (activeQueue.length >= MAX_CONCURRENT_DEMOS) {
        return {
          ok: false as const,
          status: 429,
          error:
            "All live demo lines are busy right now. Please try again in a few minutes.",
        };
      }

      // Check showcase workspace credits and daily call allowance.
      const creditsAvailable =
        client.monthlyCreditsAllowance -
        client.creditsUsedThisCycle -
        client.creditsReservedThisCycle;

      const pendingReservations =
        activeQueue.length * RESERVED_CREDITS;

      if (
        creditsAvailable <
          pendingReservations + RESERVED_CREDITS ||
        client.callsMadeToday >= client.maxCallsPerDay
      ) {
        return {
          ok: false as const,
          status: 503,
          error:
            "The live demo has reached its calling capacity. Please try again later.",
        };
      }

      // Create the public demo contact.
      const [contact] = await tx
        .insert(contacts)
        .values({
          clientId: demoClientId,
          fullName: "Live demo visitor",
          phoneNumber,
          phoneNumberRaw: phoneNumber,
          lifecycleStage: "system_demo",
          tags: ["__foolioo_public_demo__"],
          customFields: {
            _fooliooSystem: "public_demo",
            publicDemoScenario: scenario,
            publicDemoLanguage: language,
            consentedAt: new Date().toISOString(),
            consentPolicyVersion: "public-demo-2026-11-06-v1",
            consentText:
              "I agree to receive one automated AI demo call from Foolioo at the number provided. I confirm I own this number or have permission to use it. I understand this is an AI-generated call, it is not recorded, and I can end it at any time.",
            source: "foolioo-website",
            phoneLast4: phoneNumber.slice(-4),
          },
          status: "pending",
          optOut: false,
        })
        .returning({
          id: contacts.id,
        });

      if (!contact) {
        throw new Error("Unable to create public demo contact.");
      }

      // Add the call to the existing calling queue.
      const [queueEntry] = await tx
        .insert(callQueue)
        .values({
          contactId: contact.id,
          clientId: demoClientId,
          campaignId: null,
          contactName: "Live demo visitor",
          phoneNumber,
          scheduledFor: new Date(),
          attemptNumber: 1,
          priority: 100,
          status: "pending",
          maxAttempts: 1,
          reservedCredits: 0,
        })
        .returning({
          id: callQueue.id,
        });

      if (!queueEntry) {
        throw new Error("Unable to queue public demo call.");
      }

      // Record consent and queue creation in the audit log.
      const consentedAt = new Date().toISOString();

      await tx.insert(auditLog).values({
        clientId: demoClientId,
        userId: null,
        action: "public_demo.consent_and_queued",
        metadata: {
          queueId: queueEntry.id,
          phoneLast4: phoneNumber.slice(-4),
          scenario,
          language,
          consentedAt,
          consentPolicyVersion: "public-demo-2026-11-06-v1",
          source: "foolioo-website",
        },
      });

      return {
        ok: true as const,
        requestId: queueEntry.id,
      };
    });

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        error: result.error,
      });
    }

    return res.status(202).json({
      ok: true,
      requestId: result.requestId,
      message:
        "Your live demo call is queued. Keep your phone nearby. The call will last up to two minutes.",
    });
  } catch (error) {
    console.error(
      "[public-demo] Failed to queue demo call:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        "We could not start your demo call. Please try again later.",
    });
  }
}
