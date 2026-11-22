"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";

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

    const baseUrl = (process.env.BACKEND_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:4000").replace(/\/+$/, "");

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

    // Read-only requests must not invalidate dashboard routes. Mutations do.
    if (method !== "GET") {
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/campaigns");
    }
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

export async function previewContactImportAction(file: File): Promise<ActionResult> {
  const formData = new FormData();
  formData.set("file", file, file.name);
  return backendRequest("/api/contacts/import/preview", "POST", formData, true);
}

export async function bulkCreateContactsAction(
  label: string,
  contacts: Record<string, unknown>[],
): Promise<ActionResult> {
  return backendRequest("/api/contacts/bulk", "POST", {
    label,
    autoEnqueue: false,
    contacts,
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

    const baseUrl = (process.env.BACKEND_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:4000").replace(/\/+$/, "");

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

/** Persist the user's decision to skip the optional onboarding test call. */
export async function skipTestCallSetupAction(): Promise<ActionResult> {
  return backendRequest("/api/workspace-setup/test-call/skip", "POST", {});
}

/** Fetch only campaign statuses and aggregate counters for lightweight polling. */
export async function getCampaignLiveStatsAction(): Promise<ActionResult> {
  return backendRequest("/api/campaigns/live-stats", "GET");
}

export async function launchCampaignAction(
  campaignId: string,
  contactIds: string[],
  schedule: { startAt: string; startDate?: string; dailyStart: string; dailyEnd: string },
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

export async function updateCampaignDetailsAction(
  campaignId: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  if (!campaignId) return { ok: false, status: 400, error: "Campaign ID is missing." };
  return backendRequest(`/api/campaigns/${encodeURIComponent(campaignId)}`, "PATCH", input);
}

export async function deleteDraftCampaignAction(campaignId: string): Promise<ActionResult> {
  if (!campaignId) return { ok: false, status: 400, error: "Campaign ID is missing." };
  return backendRequest(`/api/campaigns/${encodeURIComponent(campaignId)}`, "DELETE");
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


/**
 * Load the Setup Wizard's supporting data only when the user opens the wizard.
 * One verified session is reused for all parallel workspace-scoped reads.
 */
export async function getSetupWizardDataAction(): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { ok: false, status: 401, error: "Your session has expired. Sign in again." };
    }

    const baseUrl = (process.env.BACKEND_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:4000").replace(/\/+$/, "");
    const headers = { Authorization: `Bearer ${session.access_token}` };
    const paths = [
      "/api/business-profile",
      "/api/agent-settings",
      "/api/team-members",
      "/api/clients",
      "/api/auth/me",
      "/api/campaigns",
      "/api/knowledge-base?limit=100&offset=0",
      "/api/workspace-setup/eligible-contacts?limit=5000",
    ];
    const responses = await Promise.all(paths.map(async (path) => {
      try {
        const response = await fetch(`${baseUrl}${path}`, { headers, cache: "no-store" });
        const payload: unknown = await response.json().catch(() => null);
        const record = typeof payload === "object" && payload !== null && !Array.isArray(payload)
          ? payload as Record<string, unknown>
          : {};
        return { path, status: response.status, ok: response.ok && record.ok !== false, record };
      } catch (error) {
        return { path, status: 0, ok: false, record: { error: error instanceof Error ? error.message : "Request failed." } };
      }
    }));
    const byPath = new Map(responses.map((result) => [result.path, result]));
    const get = (path: string) => byPath.get(path)!;
    const asRecord = (value: unknown): Record<string, unknown> | null =>
      typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
    const snapshot = (path: string, keys: string[]):
      | { state: "ready"; data: { items: Record<string, unknown>[]; total: number | null; itemsKnown: boolean } }
      | { state: "error"; status: number; error: string } => {
      const result = get(path);
      if (!result.ok) {
        return { state: "error", status: result.status, error: typeof result.record.error === "string" ? result.record.error : `Request failed (${result.status}).` };
      }
      const rows = keys.map((key) => result.record[key]).find(Array.isArray) as unknown[] | undefined;
      const data = asRecord(result.record.data) ?? {};
      const total = typeof result.record.total === "number" ? result.record.total : typeof data.total === "number" ? data.total : rows?.length ?? null;
      return { state: "ready", data: { items: (rows ?? []).filter((item): item is Record<string, unknown> => asRecord(item) !== null), total, itemsKnown: rows !== undefined } };
    };
    const profileResult = get("/api/business-profile");
    const agentResult = get("/api/agent-settings");
    const clients = snapshot("/api/clients", ["clients"]);
    const teams = snapshot("/api/team-members", ["members"]);
    const campaigns = snapshot("/api/campaigns", ["campaigns"]);
    const knowledgeBase = snapshot("/api/knowledge-base?limit=100&offset=0", ["entries", "knowledgeBase", "knowledgeBaseEntries"]);
    const launchContacts = snapshot("/api/workspace-setup/eligible-contacts?limit=5000", ["contacts"]);
    const contactSummary = snapshot("/api/workspace-setup/eligible-contacts?limit=5000", ["contacts"]);
    const authProfileResult = get("/api/auth/me");

    const profileRecord = asRecord(profileResult.record.businessProfile);
    const agentRecord = agentResult.ok ? agentResult.record : {};
    const clientRows = clients.state === "ready" ? clients.data.items as Record<string, unknown>[] : [];
    const workspace = clientRows[0] ?? {};
    const metadata = asRecord(workspace.metadata) ?? {};
    const savedRules = asRecord(metadata.routingRules);
    const authPayload = authProfileResult.ok ? authProfileResult.record : {};
    const authUser = asRecord(authPayload.user) ?? {};
    const userId = typeof authUser.id === "string" ? authUser.id : null;
    const defaultRules = {
      callback: { enabled: true, assignToUserId: userId, dueInMinutes: 30 },
      highInterest: { enabled: true, assignToUserId: userId },
      humanRequested: { enabled: true, assignToUserId: userId },
      noAnswer: { enabled: true, retryAfterMinutes: 1440, maxRetries: 2 },
    };

    const setupData = {
      businessProfile: profileResult.ok || profileResult.status === 404
        ? { state: "ready", data: profileResult.status === 404 ? null : profileRecord }
        : { state: "error", status: profileResult.status, error: typeof profileResult.record.error === "string" ? profileResult.record.error : "Business profile request failed." },
      agentSettings: agentResult.ok
        ? { state: "ready", data: agentRecord }
        : { state: "error", status: agentResult.status, error: typeof agentResult.record.error === "string" ? agentResult.record.error : "Agent settings request failed." },
      routingRules: clients.state === "error"
        ? clients
        : { state: "ready", data: { ok: true, configured: savedRules?.configured === true, routingRules: savedRules ?? defaultRules } },
      teamMembers: teams,
      clients,
      contacts: contactSummary,
      campaigns,
      knowledgeBase,
      authProfile: authProfileResult.ok
        ? { state: "ready", data: authPayload }
        : { state: "error", status: authProfileResult.status, error: typeof authProfileResult.record.error === "string" ? authProfileResult.record.error : "Account profile request failed." },
      launchContacts,
    };

    return { ok: true, data: { setupData } };
  } catch (error) {
    console.error("[dashboard/action] setup wizard data failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Unable to load setup details." };
  }
}


/** Fetch Overview analytics after the workspace shell has rendered. */
export type OverviewTimeframe = "7d" | "30d" | "90d" | "all";

export async function getOverviewAnalyticsAction(
  timeframe: OverviewTimeframe = "30d",
): Promise<ActionResult> {
  try {
    const auth = await getDashboardAuthContext();
    if (!auth) return { ok: false, status: 401, error: "Your session has expired. Sign in again." };

    const baseUrl = (process.env.BACKEND_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:4000").replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/api/analytics/overview?timeframe=${timeframe}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      cache: "no-store",
    });
    const payload: unknown = await response.json().catch(() => null);
    const record = typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};

    if (!response.ok || record.ok !== true) {
      return {
        ok: false,
        status: response.status,
        error: typeof record.error === "string" ? record.error : `Analytics request failed (${response.status}).`,
      };
    }

    return { ok: true, data: { analytics: record } };
  } catch (error) {
    console.error("[dashboard/action] Overview analytics failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Unable to load workspace analytics." };
  }
}
