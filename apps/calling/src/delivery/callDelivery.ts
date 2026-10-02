import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { analyzeCallTranscript } from "../pipeline/callAnalysis.js";
import { CallSessionState } from "../session/CallSessionState.js";
import { metricsCollector } from "../monitoring/metricsCollector.js";
import type { CallResult } from "../types/callTypes.js";

const SPOOL_DIR = join(process.cwd(), ".call-results");

// Ensure spool directory exists
let spoolDirReady = false;
async function ensureSpoolDir() {
  if (spoolDirReady) return;
  try {
    await mkdir(SPOOL_DIR, { recursive: true });
    spoolDirReady = true;
  } catch (err: any) {
    console.warn("[delivery] Failed to create local spool dir:", err?.message ?? err);
  }
}

/**
 * Dispatches final call analysis, persists durable local backup,
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

  // 3. Durable local disk backup (so data is never lost)
  try {
    await ensureSpoolDir();
    const filePath = join(SPOOL_DIR, `${result.requestId}.json`);
    await writeFile(filePath, JSON.stringify(result, null, 2), "utf-8");
  } catch (fsErr: any) {
    console.warn(`${tag} Local spool write error:`, fsErr?.message ?? fsErr);
  }

  // 4. Deliver to Webhook URL (if configured)
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
      console.error(`${tag} ❌ All 3 webhook delivery attempts failed for ${targetUrl}. Spooled locally.`);
    }
  }

  // 5. Pretty console summary banner
  console.log(`${tag} ══════════════════════════════════════════════════`);
  console.log(`${tag} 📊 Post-Call Report:`);
  console.log(`${tag}    Outcome: ${result.status} | Duration: ${result.durationSeconds}s | Turns: ${result.transcript.length}`);
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
