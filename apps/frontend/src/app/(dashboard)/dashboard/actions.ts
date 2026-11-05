"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult =
  | { ok: true; data?: Record<string, unknown> }
  | { ok: false; error: string; status?: number };

async function backendRequest(
  path: string,
  method: string,
  body?: unknown,
  multipart = false,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { ok: false, status: 401, error: "Your session has expired. Sign in again." };
    }

    const baseUrl = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, "");
    if (!baseUrl) {
      return { ok: false, error: "BACKEND_API_URL is not configured on the server." };
    }

    const headers: Record<string, string> = { Authorization: `Bearer ${session.access_token}` };
    if (body !== undefined && !multipart) headers["Content-Type"] = "application/json";

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : multipart ? body as FormData : JSON.stringify(body),
      cache: "no-store",
    });

    const payload: unknown = await response.json().catch(() => null);
    const record = typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};

    if (!response.ok || record.ok === false) {
      return {
        ok: false,
        status: response.status,
        error: typeof record.error === "string" ? record.error : `The request failed (${response.status}).`,
      };
    }

    revalidatePath("/dashboard");
    return { ok: true, data: record };
  } catch (error) {
    console.error(`[dashboard/action] ${method} ${path} failed:`, error);
    return { ok: false, error: error instanceof Error ? error.message : "The request could not be completed." };
  }
}

export async function saveAgentSettingsAction(input: Record<string, unknown>): Promise<ActionResult> {
  const { industry, displayName, description, agentName, tone, language, speechRate, voiceId, greeting, primaryObjective, handoffInstructions, pronunciationNotes, complianceNotes, guardrails } = input;
  return backendRequest("/api/business-profile", "PUT", {
    industry, displayName, description, aiPersonaName: agentName, toneOfVoice: tone, guardrails, complianceNotes,
    agentSettings: { agentName, tone, language, speechRate, voiceId, greeting, primaryObjective, handoffInstructions, pronunciationNotes },
  });
}

export async function importContactsAction(file: File): Promise<ActionResult> {
  const formData = new FormData();
  formData.set("file", file, file.name);
  return backendRequest("/api/contacts/import", "POST", formData, true);
}

export async function createCampaignAction(input: Record<string, unknown>): Promise<ActionResult> {
  return backendRequest("/api/campaigns", "POST", input);
}

export async function createTestCallAction(phoneNumber: string, confirmRealCall: boolean): Promise<ActionResult> {
  return backendRequest("/api/test-calls", "POST", { phoneNumber, confirmRealCall });
}

export async function getTestCallStatusAction(testCallId: string): Promise<ActionResult> {
  return backendRequest(`/api/test-calls/${encodeURIComponent(testCallId)}`, "GET");
}

export async function saveRoutingRulesAction(clientId: string, input: Record<string, unknown>): Promise<ActionResult> {
  if (!clientId) return { ok: false, status: 400, error: "Workspace ID is missing. Refresh and try again." };
  return backendRequest(`/api/clients/${encodeURIComponent(clientId)}`, "PATCH", input);
}

export async function launchCampaignAction(
  campaignId: string,
  contactIds: string[],
): Promise<ActionResult> {
  return backendRequest(`/api/campaigns/${encodeURIComponent(campaignId)}/launch`, "POST", {
    contactIds,
    confirm: true,
  });
}
