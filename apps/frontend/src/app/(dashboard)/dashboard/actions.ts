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
    revalidatePath("/dashboard/campaigns");
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

/** Cancel a call that is still waiting in the workspace queue. In-progress calls cannot be cancelled through this endpoint. */
export async function cancelQueuedCallAction(queueEntryId: string): Promise<ActionResult> {
  if (!queueEntryId || queueEntryId.length > 128) {
    return { ok: false, error: "A valid queue entry is required." };
  }
  return backendRequest(`/api/queue/${encodeURIComponent(queueEntryId)}`, "DELETE");
}

/** Fetch only changing queue/call state. Unlike backendRequest, this read-only
 * action deliberately does not revalidate dashboard routes. */
export async function getLiveCallStatusAction(): Promise<ActionResult> {
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

    const response = await fetch(`${baseUrl}/api/calls/live`, {
      method: "GET",
      headers: { Authorization: `Bearer ${session.access_token}` },
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

    return { ok: true, data: record };
  } catch (error) {
    console.error("[dashboard/action] GET /api/calls/live failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Live call status could not be loaded." };
  }
}

export async function saveRoutingRulesAction(clientId: string, input: Record<string, unknown>): Promise<ActionResult> {
  if (!clientId) return { ok: false, status: 400, error: "Workspace ID is missing. Refresh and try again." };
  return backendRequest(`/api/clients/${encodeURIComponent(clientId)}`, "PATCH", input);
}

export async function getLaunchEligibleContactsAction(): Promise<ActionResult> {
  return backendRequest("/api/workspace-setup/eligible-contacts?limit=5000", "GET");
}

export async function launchCampaignAction(
  campaignId: string,
  contactIds: string[],
  schedule: { startAt: string; dailyStart: string; dailyEnd: string },
): Promise<ActionResult> {
  return backendRequest(`/api/campaigns/${encodeURIComponent(campaignId)}/launch`, "POST", {
    contactIds,
    confirm: true,
    schedule,
  });
}


/**
 * Queue one explicitly confirmed outbound call to an eligible CRM contact.
 * The active campaign supplies the agent's approved conversation context.
 * The backend queue worker remains responsible for calling hours, workspace
 * status, daily limits, credit reservations and the final dial attempt.
 */
export async function enqueueSingleContactCallAction(
  contactId: string,
  campaignId: string,
  confirm: boolean,
): Promise<ActionResult> {
  if (!contactId || !campaignId) {
    return { ok: false, status: 400, error: "Choose a contact and an active campaign." };
  }
  if (confirm !== true) {
    return { ok: false, status: 400, error: "Confirm that this contact can be called before continuing." };
  }

  const result = await backendRequest("/api/queue/enqueue", "POST", {
    contactIds: [contactId],
    campaignId,
    maxAttempts: 1,
    priority: 100,
    manualCall: true,
    confirm: true,
  });

  if (result.ok) {
    revalidatePath("/dashboard/calls");
  }

  return result;
}

export async function updateCampaignStatusAction(campaignId: string, status: "active" | "paused"): Promise<ActionResult> {
  return backendRequest(`/api/campaigns/${encodeURIComponent(campaignId)}`, "PATCH", { status });
}

export async function createFollowUpAction(input: {
  contactId: string;
  callId?: string;
  type: string;
  priority: string;
  dueDate?: string;
  requestedCallbackTime?: string;
  notes?: string;
}): Promise<ActionResult> {
  if (!input.contactId) return { ok: false, status: 400, error: "Choose a contact for this follow-up." };
  const result = await backendRequest("/api/follow-ups", "POST", input);
  if (result.ok) revalidatePath("/dashboard/follow-ups");
  return result;
}

export async function updateFollowUpAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  if (!id) return { ok: false, status: 400, error: "Follow-up ID is missing." };
  const result = await backendRequest(`/api/follow-ups/${encodeURIComponent(id)}`, "PATCH", input);
  if (result.ok) revalidatePath("/dashboard/follow-ups");
  return result;
}

export async function deleteFollowUpAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, status: 400, error: "Follow-up ID is missing." };
  const result = await backendRequest(`/api/follow-ups/${encodeURIComponent(id)}`, "DELETE");
  if (result.ok) revalidatePath("/dashboard/follow-ups");
  return result;
}

export async function createKnowledgeEntryAction(input: Record<string, unknown>): Promise<ActionResult> {
  return backendRequest("/api/knowledge-base", "POST", input);
}

export async function updateKnowledgeEntryAction(id: string, input: Record<string, unknown>): Promise<ActionResult> {
  if (!id) return { ok: false, status: 400, error: "Knowledge entry ID is missing." };
  return backendRequest(`/api/knowledge-base/${encodeURIComponent(id)}`, "PATCH", input);
}

export async function deleteKnowledgeEntryAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, status: 400, error: "Knowledge entry ID is missing." };
  return backendRequest(`/api/knowledge-base/${encodeURIComponent(id)}`, "DELETE");
}

export async function getWorkspaceSettingsAction(): Promise<ActionResult> {
  const [profile, agent] = await Promise.all([
    backendRequest("/api/business-profile", "GET"),
    backendRequest("/api/agent-settings", "GET"),
  ]);
  if (!profile.ok && profile.status !== 404) return profile;
  if (!agent.ok) return agent;
  return {
    ok: true,
    data: {
      businessProfile: profile.ok ? profile.data?.businessProfile ?? null : null,
      agentSettings: agent.data?.agentSettings ?? null,
      availableVoices: agent.data?.availableVoices ?? [],
      availableLanguages: agent.data?.availableLanguages ?? [],
    },
  };
}

export async function saveWorkspaceSettingsAction(input: Record<string, unknown>): Promise<ActionResult> {
  const result = await backendRequest("/api/business-profile", "PUT", input);
  if (result.ok) revalidatePath("/dashboard/settings");
  return result;
}
