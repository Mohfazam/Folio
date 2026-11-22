import type { Request, Response } from "express";
import { activeCallRegistry } from "../session/ActiveCallRegistry.js";

/**
 * Handles Plivo asynchronous recording completion callback.
 * Plivo posts here when the MP3 audio file has been fully processed and is ready.
 */
export function plivoRecordingRoute(req: Request, res: Response) {
  const data = { ...req.query, ...req.body };
  const callUuid = (data.CallUUID as string) || (data.call_uuid as string) || "";
  const recordingUrl = (data.RecordingUrl as string) || (data.recording_url as string) || "";
  const recordingId = (data.RecordingID as string) || (data.recording_id as string) || "";
  const duration = (data.RecordingDuration as string) || (data.recording_duration as string) || "0";

  console.log(`[plivo-recording] ⏺️ Recording callback received: CallUUID=${callUuid}, ID=${recordingId}, URL=${recordingUrl}, Duration=${duration}s`);

  if (callUuid && recordingUrl) {
    const record = activeCallRegistry.get(callUuid);
    if (record) {
      const durSec = parseInt(duration, 10) || undefined;
      record.sessionState.setRecording({
        available: true,
        storageKey: recordingUrl,
        durationSeconds: durSec,
        mimeType: "audio/mp3",
      });
      console.log(`[plivo-recording] ✅ Attached recording URL to active call ${callUuid}`);
    }
  }

  res.status(200).send("OK");
}
