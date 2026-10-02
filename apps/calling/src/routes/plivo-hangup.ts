import type { Request, Response } from "express";
import { activeCallRegistry } from "../session/ActiveCallRegistry.js";
import { dispatchCallCompleted } from "../delivery/callDelivery.js";
import { metricsCollector } from "../monitoring/metricsCollector.js";
import type { CallStatus } from "../types/callTypes.js";

function mapHangupCauseToStatus(cause?: string, callStatus?: string): CallStatus {
  const c = (cause ?? "").toLowerCase();
  const s = (callStatus ?? "").toLowerCase();

  if (c.includes("busy") || s.includes("busy")) return "no_answer";
  if (c.includes("no answer") || s.includes("no-answer") || s.includes("timeout")) return "no_answer";
  if (c.includes("cancel") || c.includes("rejected")) return "failed";
  if (c.includes("normal") || s === "completed") return "completed";
  return "completed";
}

export function plivoHangupRoute(req: Request, res: Response) {
  const data = { ...req.query, ...req.body };
  const callUuid = (data.CallUUID as string) || (data.call_uuid as string) || "";
  const hangupCause = (data.HangupCause as string) || (data.hangup_cause as string) || "";
  const callStatus = (data.CallStatus as string) || (data.call_status as string) || "";
  const duration = (data.Duration as string) || (data.duration as string) || "0";
  const recordingUrl = (data.RecordingUrl as string) || (data.recording_url as string) || "";

  console.log(`[plivo-hangup] 📴 Call hangup received: CallUUID=${callUuid}, Status=${callStatus}, Cause=${hangupCause}, Duration=${duration}s`);

  if (callUuid) {
    const status = mapHangupCauseToStatus(hangupCause, callStatus);
    const record = activeCallRegistry.markEnded(callUuid, status, hangupCause || "Hangup received from Plivo");
    if (record) {
      console.log(`[plivo-hangup] 🏁 Call ${callUuid} finalized with status "${status}"`);

      const durSec = parseInt(duration, 10) || 0;
      metricsCollector.recordCallEnded(
        status,
        durSec,
        hangupCause,
        record.requestId,
        record.phoneNumber,
        record.sessionState.transcript.length
      );

      if (recordingUrl) {
        record.sessionState.setRecording({
          available: true,
          storageKey: recordingUrl,
          durationSeconds: durSec || undefined,
          mimeType: "audio/mp3",
        });
      }

      // Asynchronously run post-call AI analysis & webhook delivery
      void dispatchCallCompleted(record.sessionState).catch((err) => {
        console.error(`[plivo-hangup] Post-call delivery error:`, err?.message ?? err);
      });
    }
  }

  res.status(200).send("OK");
}
