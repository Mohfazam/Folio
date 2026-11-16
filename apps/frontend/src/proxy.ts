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

  // getClaims verifies the JWT signature and uses the cached project JWKS
  // when asymmetric signing keys are configured. Unlike getUser, it avoids an
  // Auth-server user lookup on every dashboard navigation in that case.
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  const authenticated = !error && typeof claims?.sub === "string";
  const pathname = request.nextUrl.pathname;

  if (pathname === "/sign-in" && authenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

// Dashboard routes are verified by the shared request-scoped auth context in
// the dashboard layout. Keep the proxy only for the sign-in redirect guard.
export const config = {
  matcher: ["/sign-in"],
};
