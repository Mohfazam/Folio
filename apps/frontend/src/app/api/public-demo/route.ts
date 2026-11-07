import { NextRequest, NextResponse } from "next/server";

const allowedScenarios = new Set(["admissions", "student-support", "general-enquiry"]);
const allowedLanguages = new Set(["en-IN", "hi-IN", "te-IN", "ta-IN", "kn-IN", "ml-IN"]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return jsonError("Invalid request origin.", 403);
    } catch {
      return jsonError("Invalid request origin.", 403);
    }
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return jsonError("Invalid request.", 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
  const scenario = typeof body.scenario === "string" ? body.scenario : "";
  const language = typeof body.language === "string" ? body.language : "";
  const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : "";

  if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) return jsonError("Enter a valid international phone number.", 400);
  if (!allowedScenarios.has(scenario)) return jsonError("Choose a valid demo scenario.", 400);
  if (!allowedLanguages.has(language)) return jsonError("Choose a supported conversation language.", 400);
  if (body.consent !== true) return jsonError("Explicit consent is required before requesting a demo call.", 400);
  if (!captchaToken || captchaToken.length > 4096) return jsonError("Complete the security check and try again.", 400);

  const proxySecret = process.env.PUBLIC_DEMO_PROXY_SECRET;
  const upstreamUrl = process.env.PUBLIC_DEMO_API_URL;
  if (!proxySecret || !upstreamUrl) {
    return jsonError("The public demo service is not configured yet. Please try again later.", 503);
  }

  const hostname = request.nextUrl.hostname.toLowerCase().replace(/\.$/, "");
  const isLocalDevelopmentHost =
    process.env.NODE_ENV === "development" &&
    ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);

  try {
    const upstream = new URL(upstreamUrl);
    if (upstream.protocol !== "https:" && process.env.NODE_ENV === "production") {
      return jsonError("The public demo service must use HTTPS.", 500);
    }

    const upstreamResponse = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Public-Demo-Proxy-Secret": proxySecret,
        "X-Public-Demo-IP": request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "",
        ...(isLocalDevelopmentHost ? { "X-Public-Demo-Local-Development": "true" } : {}),
      },
      body: JSON.stringify({ phoneNumber, scenario, language, consent: true, captchaToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const result: unknown = await upstreamResponse.json().catch(() => null);
    const payload = result && typeof result === "object" && !Array.isArray(result) ? result as Record<string, unknown> : {};
    if (!upstreamResponse.ok || payload.ok === false) {
      const safeMessage = typeof payload.error === "string" ? payload.error.slice(0, 240) : "We could not start your demo call. Please try again.";
      return jsonError(safeMessage, upstreamResponse.status >= 400 && upstreamResponse.status < 500 ? upstreamResponse.status : 502);
    }
    return NextResponse.json({ ok: true, requestId: typeof payload.requestId === "string" ? payload.requestId.slice(0, 100) : undefined, message: typeof payload.message === "string" ? payload.message.slice(0, 240) : "Your demo call request has been accepted. Keep your phone nearby." });
  } catch (error) {
    console.error("[public-demo] Request failed:", error);
    return jsonError("The demo calling service is temporarily unavailable. Please try again later.", 502);
  }
}
