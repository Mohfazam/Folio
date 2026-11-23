import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FOOLIOO_SESSION_COOKIE } from "@/lib/auth/dashboard-request";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(FOOLIOO_SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
