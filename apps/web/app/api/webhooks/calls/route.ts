import { NextRequest, NextResponse } from "next/server";
import { storeCallRecord, getCallRecords } from "../../../../lib/callStore.js";

/**
 * Webhook Receiver for the Calling Service.
 *
 * The calling engine posts the full `CallResult` payload here
 * when an outbound or inbound call terminates.
 */
export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    const payload = await req.json();

    const {
      schemaVersion,
      deliveryId,
      requestId,
      plivoCallId,
      status,
      durationSeconds,
      transcript = [],
      analysis,
      timings,
      failureCategory,
      failureReason,
    } = payload;

    // Log rich summary banner in the console
    console.log(`\n======================================================`);
    console.log(`📞 [WEBHOOK RECEIVED] Call Result Payload`);
    console.log(`   Time:        ${timestamp}`);
    console.log(`   Delivery ID: ${deliveryId ?? "N/A"}`);
    console.log(`   Request ID:  ${requestId ?? "N/A"}`);
    console.log(`   Plivo UUID:  ${plivoCallId ?? "N/A"}`);
    console.log(`   Status:      ${status} (${durationSeconds ?? 0}s)`);
    console.log(`   Turns:       ${transcript.length} dialogue turns`);

    if (analysis) {
      console.log(`   ── AI Analysis ───────────────────────────────────`);
      console.log(`   Interest:    [${analysis.interestLevel?.toUpperCase() ?? "UNKNOWN"}]`);
      console.log(`   Sentiment:   [${analysis.sentiment?.toUpperCase() ?? "NEUTRAL"}]`);
      console.log(`   Summary:     "${analysis.summary ?? ""}"`);
      if (analysis.objectionsRaised?.length > 0) {
        console.log(`   Objections:  ${analysis.objectionsRaised.join(", ")}`);
      }
      if (analysis.followUpRequested) {
        console.log(`   Follow-up:   YES (Time: ${analysis.requestedCallbackTime ?? "Flexible"})`);
      }
    }

    if (timings) {
      console.log(`   ── Latency Metrics ───────────────────────────────`);
      console.log(`   First Sentence: ${timings.avgFirstSentenceMs ?? "N/A"}ms`);
      console.log(`   First Audio:    ${timings.avgFirstAudioMs ?? "N/A"}ms`);
      console.log(`   STT Connect:    ${timings.sttConnectMs ?? "N/A"}ms`);
    }

    if (status === "failed" || failureCategory) {
      console.log(`   ⚠️ Failure:   ${failureCategory} - ${failureReason}`);
    }
    console.log(`======================================================\n`);

    // Store in local test storage
    const stored = await storeCallRecord(payload);

    return NextResponse.json({
      ok: true,
      received: true,
      deliveryId: deliveryId || stored.id,
      timestamp,
      message: "Call result ingested successfully",
    });
  } catch (err: any) {
    console.error("[webhook] Ingestion error:", err?.message ?? err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Malformed webhook payload",
      },
      { status: 400 }
    );
  }
}

/**
 * GET handler for verifying webhook endpoint availability.
 */
export async function GET() {
  const records = await getCallRecords();
  return NextResponse.json({
    ok: true,
    service: "Folio Webhook Receiver",
    endpoint: "/api/webhooks/calls",
    status: "listening",
    totalCallsLogged: records.length,
    timestamp: new Date().toISOString(),
  });
}
