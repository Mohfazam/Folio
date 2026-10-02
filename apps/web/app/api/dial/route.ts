import { NextRequest, NextResponse } from "next/server";

const DEFAULT_CALLING_SERVICE =
  process.env.CALLING_SERVICE_URL ||
  process.env.NEXT_PUBLIC_CALLING_SERVICE_URL ||
  "https://folio-calling-production.up.railway.app";

const DEFAULT_WEBHOOK_URL =
  process.env.WEBHOOK_CALLBACK_URL ||
  process.env.NEXT_PUBLIC_WEBHOOK_URL ||
  "https://shavonda-perkier-ruminantly.ngrok-free.dev/api/webhooks/calls";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const targetEngineUrl = (body.callingServiceUrl || DEFAULT_CALLING_SERVICE).replace(/\/$/, "");
    const dialEndpoint = `${targetEngineUrl}/dial`;

    // Ensure callbackUrl is set so calling service posts results back here
    const callbackUrl = body.callbackUrl || DEFAULT_WEBHOOK_URL;

    const payload = {
      ...body,
      callbackUrl,
    };

    console.log(`[dial-proxy] Initiating outbound call via: ${dialEndpoint}`);
    console.log(`[dial-proxy] Destination: ${payload.phoneNumber || payload.to}`);
    console.log(`[dial-proxy] Webhook callback: ${callbackUrl}`);

    const res = await fetch(dialEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("[dial-proxy] Dial request failed:", err?.message ?? err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to connect to calling service",
      },
      { status: 502 }
    );
  }
}
