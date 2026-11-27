import { NextResponse } from "next/server";
import { submitSupportTicket } from "@/lib/auth/backend";
import { sanitizeUserError } from "@/lib/utils/sanitize-error";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "Support ticket payload must be an object." },
      { status: 400 },
    );
  }

  const record = body as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const email = typeof record.email === "string" ? record.email.trim() : "";
  const subject = typeof record.subject === "string" ? record.subject.trim() : "";
  const message = typeof record.message === "string" ? record.message.trim() : "";
  const contactPhone =
    typeof record.contactPhone === "string" && record.contactPhone.trim()
      ? record.contactPhone.trim()
      : undefined;

  if (!email || !subject || !message) {
    return NextResponse.json(
      { ok: false, error: "Email, subject, and message are required." },
      { status: 400 },
    );
  }

  try {
    const result = await submitSupportTicket({
      name: name || email.split("@")[0] || "Customer",
      email,
      subject,
      message,
      contactPhone,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: sanitizeUserError(result.error, "Failed to submit support ticket.") },
        { status: 400 },
      );
    }
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[api/support/ticket] POST failed:", err);
    return NextResponse.json(
      { ok: false, error: sanitizeUserError(err instanceof Error ? err.message : null, "Failed to submit support ticket.") },
      { status: 500 },
    );
  }
}
