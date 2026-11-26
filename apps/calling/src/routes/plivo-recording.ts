import type { Request, Response } from "express";
import { activeCallRegistry } from "../session/ActiveCallRegistry.js";
import { dispatchCallRecording } from "../delivery/callDelivery.js";

/**
 * Handles Plivo asynchronous recording completion callback.
 * Plivo posts here when the MP3 audio file has been fully processed and is ready.
 *
 * Plivo sends these field names in the recording callback:
 *   record_url        – the MP3 download URL  (primary field name)
 *   recording_id      – Plivo's internal recording identifier
 *   call_uuid         – the Plivo call UUID
 *   recording_duration        – duration in seconds
 *   recording_duration_ms     – duration in milliseconds
 *
 * Legacy / fallback field names also accepted: RecordingUrl, recording_url, RecordingID
 */
export function plivoRecordingRoute(req: Request, res: Response) {
  const data = { ...req.query, ...req.body };

  // Log every field Plivo sends so we can diagnose field-name mismatches
  console.log(`[plivo-recording] 📥 Raw callback payload:`, JSON.stringify(data));

  // CallUUID – Plivo uses both capitalizations
  const callUuid =
    (data.CallUUID as string) ||
    (data.call_uuid as string) ||
    "";

  // Recording URL – primary Plivo field is "record_url" (all lowercase, underscore)
  const recordingUrl =
    (data.record_url as string) ||
    (data.RecordingUrl as string) ||
    (data.recording_url as string) ||
    "";

  // Recording ID
  const recordingId =
    (data.recording_id as string) ||
    (data.RecordingID as string) ||
    "";

  // Duration
  const duration =
    (data.recording_duration as string) ||
    (data.RecordingDuration as string) ||
    "0";

  console.log(
    `[plivo-recording] 🔍 Parsed: CallUUID="${callUuid}" | RecordingID="${recordingId}" | URL="${recordingUrl}" | Duration="${duration}s"`
  );

  if (!recordingUrl) {
    console.warn(
      `[plivo-recording] ⚠️  No recording URL found in callback. ` +
      `Received keys: [${Object.keys(data).join(", ")}]`
    );
    res.status(200).send("OK");
    return;
  }

  const durSec = parseInt(duration, 10) || undefined;

  // --- Path A: active call still in registry ---
  const record = callUuid ? activeCallRegistry.get(callUuid) : undefined;
  if (record) {
    record.sessionState.setRecording({
      available: true,
      storageKey: recordingUrl,
      durationSeconds: durSec,
      mimeType: "audio/mp3",
    });
    console.log(`[plivo-recording] ✅ Attached recording URL to active call ${callUuid}`);

    void dispatchCallRecording(record.sessionState, recordingUrl, durSec, recordingId).catch((err) => {
      console.error(`[plivo-recording] Error dispatching recording update:`, err?.message ?? err);
    });

    res.status(200).send("OK");
    return;
  }

  // --- Path B: call already cleaned up from registry – dispatch directly to backend ---
  const targetUrl = process.env.CALLBACK_URL || "";
  if (callUuid && targetUrl) {
    console.log(
      `[plivo-recording] ⚠️  Call ${callUuid} not in active registry. ` +
      `Dispatching recording directly to backend.`
    );
    // Derive the recording endpoint from the complete endpoint URL
    const recordingEndpoint = targetUrl.replace(/\/complete\/?$/, "/recording");

    const webhookSecret = process.env.WEBHOOK_SECRET || process.env.CALLING_WEBHOOK_SECRET;
    void fetch(recordingEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Folio-VoiceService/1.0",
        ...(webhookSecret ? { "x-webhook-secret": webhookSecret } : {}),
      },
      body: JSON.stringify({
        // plivoCallId used by backend for LIKE-match against deliveryId column
        plivoCallId: callUuid,
        plivoRecordingId: recordingId,
        recordingUrl,
        durationSeconds: durSec,
      }),
      signal: AbortSignal.timeout(10_000),
    })
      .then((r) =>
        console.log(
          `[plivo-recording] 📤 Direct backend dispatch status: ${r.status} ${r.statusText}`
        )
      )
      .catch((err) =>
        console.error(
          `[plivo-recording] ❌ Direct backend dispatch failed:`,
          err?.message ?? err
        )
      );
  } else {
    console.warn(
      `[plivo-recording] ⚠️  Cannot dispatch: callUuid="${callUuid}", CALLBACK_URL="${targetUrl}"`
    );
  }

  res.status(200).send("OK");
}
