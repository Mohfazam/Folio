import { NextResponse } from "next/server";
import { requestSupportOtp, verifySupportOtp } from "@/lib/auth/backend";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, email, otp } = body;

    if (action === "verify") {
      if (!email || !otp) {
        return NextResponse.json({ ok: false, error: "Email and OTP code are required" }, { status: 400 });
      }
      const result = await verifySupportOtp(email, otp);
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error || "Invalid code" }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    if (!email) {
      return NextResponse.json({ ok: false, error: "Email is required" }, { status: 400 });
    }

    const result = await requestSupportOtp(email);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error || "Failed to send code" }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process support OTP";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
