import { analyzeCallTranscript } from "../pipeline/callAnalysis.js";
import { CallSessionState } from "../session/CallSessionState.js";
import { metricsCollector } from "../monitoring/metricsCollector.js";
import type { CallResult } from "../types/callTypes.js";

/**
 * Dispatches final call analysis, computes cost & credit metrics,
 * and posts the CallResult payload to the configured webhook callback URL.
 */
export async function dispatchCallCompleted(
  sessionState: CallSessionState,
  callbackUrlOverride?: string
): Promise<CallResult> {
  const tag = sessionState.tag;

  // 1. Build initial result payload
  const result: CallResult = sessionState.buildResult();

  // 2. Perform AI post-call extraction
  try {
    const analysis = await analyzeCallTranscript(result.transcript, sessionState.context);
    result.analysis = analysis;
    metricsCollector.recordCallAnalysis(result.requestId, analysis);
  } catch (analysisErr: any) {
    console.warn(`${tag} Analysis extraction error:`, analysisErr?.message ?? analysisErr);
  }

  // 2b. Compute credits & provider cost estimates
  const isConnected = result.status === "completed";
  const credits = isConnected ? Math.ceil((result.durationSeconds || 0) / 10) : 0;
  
  // Approximate provider cost estimates
  const telephonyCost = isConnected ? Number(((result.durationSeconds / 60) * 0.015).toFixed(4)) : 0;
  const sttCost = isConnected ? Number((result.durationSeconds * 0.0006).toFixed(4)) : 0;
  
  const assistantChars = result.transcript
    .filter((t) => t.speaker === "assistant")
    .reduce((acc, t) => acc + (t.text?.length || 0), 0);
  const ttsCost = Number((assistantChars * 0.000018).toFixed(4));
  
  const userTurns = result.transcript.filter((t) => t.speaker === "user").length;
  const llmCost = Number((userTurns * 0.0001).toFixed(4));
  const totalEstimatedCost = Number((telephonyCost + sttCost + ttsCost + llmCost).toFixed(4));

  result.costEstimate = {
    credits,
    costTelephony: telephonyCost,
    costStt: sttCost,
    costLlm: llmCost,
    costTts: ttsCost,
    totalEstimatedCost,
  };

  // 3. Deliver to Webhook URL (if configured)
  const targetUrl = callbackUrlOverride || sessionState.callbackUrl || process.env.CALLBACK_URL;
  let deliverySuccess = false;

  if (targetUrl) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Folio-VoiceService/1.0",
            ...(process.env.WEBHOOK_SECRET ? { "x-webhook-secret": process.env.WEBHOOK_SECRET } : {}),
          },
          body: JSON.stringify(result),
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (res.ok) {
          deliverySuccess = true;
          console.log(`${tag} 🚀 Webhook delivery SUCCESS (${res.status} ${res.statusText}) -> ${targetUrl}`);
          break;
        } else {
          console.warn(`${tag} ⚠️ Webhook delivery attempt ${attempt} returned status ${res.status}`);
        }
      } catch (postErr: any) {
        console.warn(`${tag} ⚠️ Webhook delivery attempt ${attempt} failed:`, postErr?.message ?? postErr);
      }

      if (attempt < 3) {
        // Wait 1s, 2s before retrying
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }

    metricsCollector.recordWebhookResult(deliverySuccess);

    if (!deliverySuccess) {
      console.error(`${tag} ❌ All 3 webhook delivery attempts failed for ${targetUrl}.`);
    }
  }

  // 5. Pretty console summary banner
  console.log(`${tag} ══════════════════════════════════════════════════`);
  console.log(`${tag} 📊 Post-Call Report:`);
  console.log(`${tag}    Outcome: ${result.status} | Duration: ${result.durationSeconds}s | Turns: ${result.transcript.length}`);
  console.log(`${tag} 💳 Credits & Costs:`);
  console.log(`${tag}    Credits Charged: ${credits} credit(s) (1 credit / 10s unit)`);
  console.log(`${tag}    Est. Provider Cost: $${totalEstimatedCost.toFixed(4)} (Telephony: $${telephonyCost}, STT: $${sttCost}, LLM: $${llmCost}, TTS: $${ttsCost})`);
  if (result.analysis) {
    console.log(`${tag}    Interest Level: [${result.analysis.interestLevel.toUpperCase()}] | Sentiment: [${result.analysis.sentiment}]`);
    console.log(`${tag}    Summary: "${result.analysis.summary}"`);
    if (result.analysis.objectionsRaised.length > 0) {
      console.log(`${tag}    Objections: ${result.analysis.objectionsRaised.join(", ")}`);
    }
    if (result.analysis.followUpRequested) {
      console.log(`${tag}    Follow-up: Requested (${result.analysis.requestedCallbackTime ?? "Flexible"})`);
    }
  }
  if (targetUrl) {
    console.log(`${tag}    Webhook: ${deliverySuccess ? "Delivered" : "Pending/Failed"} -> ${targetUrl}`);
  }
  console.log(`${tag} ══════════════════════════════════════════════════`);

  return result;
}

/**
 * Dispatches an asynchronous recording update to the webhook once Plivo finishes MP3 processing.
 */
export async function dispatchCallRecording(
  sessionState: CallSessionState,
  recordingUrl: string,
  durationSeconds?: number
): Promise<void> {
  const tag = sessionState.tag;
  sessionState.setRecording({
    available: true,
    storageKey: recordingUrl,
    durationSeconds,
    mimeType: "audio/mp3",
  });

  const targetUrl = sessionState.callbackUrl || process.env.CALLBACK_URL;
  if (!targetUrl) return;

  const deliveryId = `${sessionState.requestId}:${sessionState.plivoCallId || "no-plivo-id"}`;

  // 1. Post to dedicated recording endpoint (/api/calls/recording)
  const recordingEndpoint = targetUrl.replace(/\/complete\/?$/, "/recording");
  try {
    const res = await fetch(recordingEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Folio-VoiceService/1.0",
        ...(process.env.WEBHOOK_SECRET ? { "x-webhook-secret": process.env.WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify({
        deliveryId,
        plivoCallId: sessionState.plivoCallId,
        recordingUrl,
        durationSeconds,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      console.log(`${tag} ⏺️ Recording delivery SUCCESS -> ${recordingEndpoint}`);
      return;
    }
  } catch (err: any) {
    console.warn(`${tag} ⚠️ Recording delivery endpoint error:`, err?.message ?? err);
  }

  // 2. Fallback: Re-send completed result with recording attached
  try {
    const result = sessionState.buildResult();
    await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Folio-VoiceService/1.0",
        ...(process.env.WEBHOOK_SECRET ? { "x-webhook-secret": process.env.WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify(result),
      signal: AbortSignal.timeout(10000),
    });
    console.log(`${tag} ⏺️ Re-dispatched complete call with recording to ${targetUrl}`);
  } catch (err: any) {
    console.warn(`${tag} ⚠️ Fallback call delivery with recording failed:`, err?.message ?? err);
  }
}
