import { and, desc, eq, gte, isNull, like, or, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { calls, callRecordings } from "@repo/db";
import { env } from "../config/env.js";

/**
 * Plivo Recording API response object shape
 */
interface PlivoRecordingObject {
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

interface PlivoRecordingsResponse {
  api_id?: string;
  objects?: PlivoRecordingObject[];
}

let isSyncingRecordings = false;

/**
 * 24/7 Background Task:
 * Scans Plivo REST API for call recordings and attaches them to any calls in the database
 * that are missing their recording URL.
 *
 * Matching strategies:
 * 1. Plivo call UUID in calls.deliveryId (format: requestId:plivoCallId)
 * 2. Plivo call UUID in calls.metadata->>'plivoCallId'
 * 3. Matching phone number + timestamp within 10 minutes
 */
export async function syncPendingRecordingsFromPlivo(): Promise<{
  syncedCount: number;
  unresolvedCount: number;
  totalInPlivo: number;
}> {
  if (isSyncingRecordings) {
    return { syncedCount: 0, unresolvedCount: 0, totalInPlivo: 0 };
  }

  if (!env.plivo?.authId || !env.plivo?.authToken) {
    return { syncedCount: 0, unresolvedCount: 0, totalInPlivo: 0 };
  }

  isSyncingRecordings = true;

  try {
    // 1. Find recent calls (last 7 days) that are missing a recordingUrl
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const unrecordedCalls = await db
      .select({
        id: calls.id,
        clientId: calls.clientId,
        deliveryId: calls.deliveryId,
        phoneNumber: calls.phoneNumber,
        metadata: calls.metadata,
        startedAt: calls.startedAt,
        durationSeconds: calls.durationSeconds,
      })
      .from(calls)
      .where(and(isNull(calls.recordingUrl), gte(calls.startedAt, sevenDaysAgo)))
      .orderBy(desc(calls.startedAt))
      .limit(100);

    if (unrecordedCalls.length === 0) {
      return { syncedCount: 0, unresolvedCount: 0, totalInPlivo: 0 };
    }

    // 2. Fetch latest recordings from Plivo API
    const basicAuth = Buffer.from(`${env.plivo.authId}:${env.plivo.authToken}`).toString("base64");
    const plivoUrl = `https://api.plivo.com/v1/Account/${encodeURIComponent(env.plivo.authId)}/Recording/?limit=50`;

    const plivoRes = await fetch(plivoUrl, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "User-Agent": "Folio-RecordingWorker/1.0",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!plivoRes.ok) {
      console.warn(`[recording-sync-worker] ⚠️ Plivo API error: ${plivoRes.status} ${plivoRes.statusText}`);
      return { syncedCount: 0, unresolvedCount: unrecordedCalls.length, totalInPlivo: 0 };
    }

    const payload = (await plivoRes.json()) as PlivoRecordingsResponse;
    const recordings = payload.objects || [];
    if (recordings.length === 0) {
      return { syncedCount: 0, unresolvedCount: unrecordedCalls.length, totalInPlivo: 0 };
    }

    let syncedCount = 0;

    // 3. Match each Plivo recording to unrecorded calls
    for (const rec of recordings) {
      const callUuid = rec.call_uuid;
      const recUrl = rec.recording_url || rec.record_url;
      if (!recUrl) continue;

      const durSec = rec.recording_duration_ms
        ? Math.round(Number(rec.recording_duration_ms) / 1000)
        : rec.recording_duration
          ? parseInt(rec.recording_duration, 10)
          : null;

      // Match against our in-memory list of unrecorded calls
      const matchedCall = unrecordedCalls.find((call) => {
        // Strategy 1: Plivo Call UUID in deliveryId
        if (callUuid && call.deliveryId && call.deliveryId.includes(callUuid)) {
          return true;
        }

        // Strategy 2: Plivo Call UUID in metadata
        if (
          callUuid &&
          call.metadata &&
          typeof call.metadata === "object" &&
          !Array.isArray(call.metadata) &&
          (call.metadata as Record<string, unknown>).plivoCallId === callUuid
        ) {
          return true;
        }

        // Strategy 3: Target phone number + timestamp within 10-minute window
        if (rec.to_number && call.phoneNumber && rec.add_time) {
          const recTime = new Date(rec.add_time).getTime();
          const callTime = new Date(call.startedAt).getTime();
          const cleanRecPhone = rec.to_number.replace(/\D/g, "");
          const cleanCallPhone = call.phoneNumber.replace(/\D/g, "");

          if (
            (cleanRecPhone.endsWith(cleanCallPhone) || cleanCallPhone.endsWith(cleanRecPhone)) &&
            Math.abs(recTime - callTime) <= 10 * 60 * 1000
          ) {
            return true;
          }
        }

        return false;
      });

      if (matchedCall) {
        try {
          // Update calls row
          await db
            .update(calls)
            .set({ recordingUrl: recUrl })
            .where(eq(calls.id, matchedCall.id));

          // Insert into callRecordings table
          await db
            .insert(callRecordings)
            .values({
              callId: matchedCall.id,
              clientId: matchedCall.clientId,
              sourceUrl: recUrl,
              plivoRecordingId: rec.recording_id ?? null,
              durationSeconds: durSec ?? matchedCall.durationSeconds ?? null,
              fileFormat: rec.recording_format || "mp3",
              status: "completed",
              channels: 1,
              metadata: {
                syncedByWorker: true,
                plivoCallId: callUuid,
                plivoRecordingId: rec.recording_id,
                syncedAt: new Date().toISOString(),
              },
            })
            .onConflictDoNothing();

          syncedCount++;
          console.log(
            `[recording-sync-worker] ✅ Successfully linked recording ${rec.recording_id || ""} to call ${matchedCall.id} -> ${recUrl}`
          );

          // Remove matched call from memory list so it isn't matched again
          const idx = unrecordedCalls.indexOf(matchedCall);
          if (idx !== -1) unrecordedCalls.splice(idx, 1);
        } catch (dbErr) {
          console.error(`[recording-sync-worker] Failed to save recording for call ${matchedCall.id}:`, dbErr);
        }
      }
    }

    return {
      syncedCount,
      unresolvedCount: unrecordedCalls.length,
      totalInPlivo: recordings.length,
    };
  } catch (err: unknown) {
    console.error("[recording-sync-worker] Unexpected error in sync cycle:", err);
    return { syncedCount: 0, unresolvedCount: 0, totalInPlivo: 0 };
  } finally {
    isSyncingRecordings = false;
  }
}
