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

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
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

export async function saveVoiceProfileAction(input: Record<string, unknown>): Promise<ActionResult> {
  return backendRequest("/api/business-profile", "PUT", input);
}

export async function importContactsAction(file: File): Promise<ActionResult> {
  const formData = new FormData();
  formData.set("file", file, file.name);
  return backendRequest("/api/contacts/import", "POST", formData, true);
}

export async function createCampaignAction(input: Record<string, unknown>): Promise<ActionResult> {
  return backendRequest("/api/campaigns", "POST", input);
}

export async function activateCampaignAction(campaignId: string): Promise<ActionResult> {
  return backendRequest(`/api/campaigns/${encodeURIComponent(campaignId)}`, "PATCH", { status: "active" });
}
