import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthDestination } from "../../../lib/auth/backend";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const authError = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");
  const requestedNext = searchParams.get("next");

  if (authError || errorCode) {
    const errorUrl = new URL("/auth-code-error", origin);
    errorUrl.searchParams.set("error", errorDescription || "Authentication failed");
    return NextResponse.redirect(errorUrl);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/auth-code-error", origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const errorUrl = new URL("/auth-code-error", origin);
    errorUrl.searchParams.set("error", "Authentication could not be completed. Please try again.");
    return NextResponse.redirect(errorUrl);
  }

  // Password-reset links are the only callback that bypasses workspace routing.
  if (requestedNext === "/reset-password") {
    return NextResponse.redirect(new URL("/reset-password", origin));
  }

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    const errorUrl = new URL("/auth-code-error", origin);
    errorUrl.searchParams.set("error", "Your session was not created. Please sign in again.");
    return NextResponse.redirect(errorUrl);
  }

  try {
    const destination = await resolvePostAuthDestination(accessToken);
    const safeNext =
      requestedNext &&
      requestedNext.trim().startsWith("/") &&
      !requestedNext.trim().startsWith("//") &&
      !requestedNext.trim().startsWith("/\\")
        ? requestedNext.trim()
        : null;
    const finalTarget = destination === "/dashboard" && safeNext ? safeNext : destination;
    return NextResponse.redirect(new URL(finalTarget, origin));
  } catch (err) {
    console.error("[auth/callback] Workspace provisioning failed:", err);
    const errorUrl = new URL("/auth-code-error", origin);
    errorUrl.searchParams.set("error", "Your account is signed in, but your workspace could not be loaded.");
    return NextResponse.redirect(errorUrl);
  }
}
