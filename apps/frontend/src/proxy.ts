import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  const hasFooliooSession = Boolean(request.cookies.get("foolioo_session")?.value);
  const authenticated = hasFooliooSession || (!error && typeof claims?.sub === "string");

  if ((request.nextUrl.pathname === "/sign-in" || request.nextUrl.pathname === "/sign-up") && authenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  // Refresh sessions on protected application routes without adding an
  // authentication lookup to unrelated public pages or static assets.
  matcher: ["/dashboard/:path*", "/onboarding", "/sign-in", "/auth/callback"],
};
