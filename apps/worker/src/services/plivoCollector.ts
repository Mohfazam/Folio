import { env } from "../config/env.js";
import { workerMetrics } from "../metrics/registry.js";

interface PlivoApiRecording {
  recording_id?: string;
  call_uuid?: string;
  recording_url?: string;
  record_url?: string;
  recording_duration?: string;
  recording_duration_ms?: string;
  recording_format?: string;
  add_time?: string;
  from_number?: string;
  to_number?: string;
}

interface PlivoApiResponse {
  objects?: PlivoApiRecording[];
}

export async function collectAndForwardPlivoRecordings(): Promise<{
  scanned: number;
  matched: number;
}> {
  if (!env.plivoAuthId || !env.plivoAuthToken) {
    console.warn("[plivo-collector] ⚠️ PLIVO_AUTH_ID / PLIVO_AUTH_TOKEN not configured. Skipping recording check.");
    return { scanned: 0, matched: 0 };
  }

  try {
    // 1. Fetch latest recordings from Plivo API
    const basicAuth = Buffer.from(`${env.plivoAuthId}:${env.plivoAuthToken}`).toString("base64");
    const plivoUrl = `https://api.plivo.com/v1/Account/${encodeURIComponent(env.plivoAuthId)}/Recording/?limit=50`;

    const plivoRes = await fetch(plivoUrl, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "User-Agent": "Folio-Worker/1.0",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!plivoRes.ok) {
      const errMsg = `Plivo API returned ${plivoRes.status} ${plivoRes.statusText}`;
      console.warn(`[plivo-collector] ⚠️ ${errMsg}`);
      workerMetrics.recordRecordingError(errMsg);
      return { scanned: 0, matched: 0 };
    }

    const data = (await plivoRes.json()) as PlivoApiResponse;
    const items = data.objects || [];
    if (items.length === 0) {
      return { scanned: 0, matched: 0 };
    }

    // 2. Format items for backend ingestion
    const payloadRecordings = items
      .filter((rec) => Boolean(rec.recording_url || rec.record_url))
      .map((rec) => {
        const durSec = rec.recording_duration_ms
          ? Math.round(Number(rec.recording_duration_ms) / 1000)
          : rec.recording_duration
            ? parseInt(rec.recording_duration, 10)
            : undefined;

        return {
          callUuid: rec.call_uuid,
          recordingId: rec.recording_id,
          recordingUrl: rec.recording_url || rec.record_url,
          durationSeconds: durSec,
          fileFormat: rec.recording_format || "mp3",
          toNumber: rec.to_number,
          fromNumber: rec.from_number,
          addTime: rec.add_time,
        };
      });

    // 3. Forward to backend ingestion endpoint (Worker has NO direct DB write access)
    const ingestUrl = `${env.backendUrl}/api/worker/recordings/ingest`;
    const backendRes = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Folio-Worker/1.0",
        ...(env.workerSecret ? { "x-worker-secret": env.workerSecret } : {}),
        ...(env.workerSecret ? { Authorization: `Bearer ${env.workerSecret}` } : {}),
      },
      body: JSON.stringify({ recordings: payloadRecordings }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!backendRes.ok) {
      const errText = await backendRes.text().catch(() => "");
      const errMsg = `Backend ingestion returned ${backendRes.status}: ${errText.slice(0, 100)}`;
      console.error(`[plivo-collector] ❌ ${errMsg}`);
      workerMetrics.recordRecordingError(errMsg);
      return { scanned: items.length, matched: 0 };
    }

    const result = (await backendRes.json()) as { matchedCount?: number };
    const matched = result.matchedCount ?? 0;

    workerMetrics.recordRecordingSync(items.length, matched);

    if (matched > 0) {
      console.log(`[plivo-collector] ⏺️ Successfully linked ${matched} new recording(s) in database!`);
    }

    return { scanned: items.length, matched };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[plivo-collector] Harvesting error:", msg);
    workerMetrics.recordRecordingError(msg);
    return { scanned: 0, matched: 0 };
  }
}
