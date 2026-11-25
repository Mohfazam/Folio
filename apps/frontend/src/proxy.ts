import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function hasValidFooliooSession(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return false;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "="));
    const payload = JSON.parse(json) as { userId?: string; exp?: number };
    if (!payload?.userId) return false;
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response = NextResponse.next({ request });
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Run on application routes so refreshed Supabase session cookies are
  // persisted before Server Components read the session. getClaims verifies
  // the JWT without a separate Auth user lookup.
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  const hasFooliooSession = hasValidFooliooSession(request.cookies.get("foolioo_session")?.value);
  const authenticated = hasFooliooSession || (!error && typeof claims?.sub === "string");

  if ((request.nextUrl.pathname === "/sign-in" || request.nextUrl.pathname === "/sign-up") && authenticated) {
    const rawRedirect = request.nextUrl.searchParams.get("redirect")?.trim() ?? "";
    const safeRedirect =
      rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") && !rawRedirect.startsWith("/\\")
        ? rawRedirect
        : "/dashboard";
    return NextResponse.redirect(new URL(safeRedirect, request.url));
  }

  return response;
}

export const config = {
  // Refresh sessions on protected application routes without adding an
  // authentication lookup to unrelated public pages or static assets.
  matcher: ["/dashboard/:path*", "/onboarding", "/sign-in", "/auth/callback"],
};
