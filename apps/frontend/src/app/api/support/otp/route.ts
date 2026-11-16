import { NextResponse } from "next/server";

/**
 * OTP verification is intentionally disabled in the application for now.
 * Keep this compatibility route so stale clients receive an explicit response
 * instead of attempting to call removed verification helpers.
 */
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "OTP verification is currently disabled." },
    { status: 410 },
  );
}
