import { NextResponse } from "next/server";
import { submitSupportTicket } from "@/lib/auth/backend";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await submitSupportTicket(body);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to submit support ticket";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
