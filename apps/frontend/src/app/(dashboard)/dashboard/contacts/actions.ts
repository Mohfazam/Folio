"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ContactActionResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string; status?: number };

async function contactBackendRequest(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<ContactActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return {
        ok: false,
        status: 401,
        error: "Your session has expired. Sign in again.",
      };
    }

    const baseUrl = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, "");
    if (!baseUrl) {
      return {
        ok: false,
        error: "BACKEND_API_URL is not configured on the server.",
      };
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });

    const payload: unknown = await response.json().catch(() => null);
    const record =
      typeof payload === "object" && payload !== null && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};

    if (!response.ok || record.ok === false) {
      return {
        ok: false,
        status: response.status,
        error:
          typeof record.error === "string"
            ? record.error
            : `The request failed (${response.status}).`,
      };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/contacts");
    return { ok: true, data: record };
  } catch (error) {
    console.error(`[contacts/action] ${method} ${path} failed:`, error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "The contact request could not be completed.",
    };
  }
}

export async function createContactAction(
  input: Record<string, unknown>,
): Promise<ContactActionResult> {
  return contactBackendRequest("/api/contacts/bulk", "POST", {
    label: "manual-contact-entry",
    autoEnqueue: false,
    contacts: [input],
  });
}

export async function updateContactAction(
  contactId: string,
  input: Record<string, unknown>,
): Promise<ContactActionResult> {
  if (!contactId.trim()) {
    return { ok: false, status: 400, error: "Contact ID is required." };
  }

  return contactBackendRequest(
    `/api/contacts/${encodeURIComponent(contactId)}`,
    "PATCH",
    input,
  );
}

export async function deleteContactAction(
  contactId: string,
): Promise<ContactActionResult> {
  if (!contactId.trim()) {
    return { ok: false, status: 400, error: "Contact ID is required." };
  }

  return contactBackendRequest(
    `/api/contacts/${encodeURIComponent(contactId)}`,
    "DELETE",
  );
}
