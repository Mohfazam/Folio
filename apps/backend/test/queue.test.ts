import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/folio";
process.env.NODE_ENV = "test";

const {
  normalizeTime,
  isWithinCallingHours,
  getClientLocalTimeAndDate,
} = await import("../src/worker/processQueue.js");

test("normalizeTime standardizes time strings to HH:MM:SS", () => {
  assert.equal(normalizeTime("09:00", "00:00:00"), "09:00:00");
  assert.equal(normalizeTime("14:35:45", "00:00:00"), "14:35:45");
  assert.equal(normalizeTime("  10:15  ", "00:00:00"), "10:15:00");
  assert.equal(normalizeTime(null, "09:00:00"), "09:00:00");
  assert.equal(normalizeTime(undefined, "16:00:00"), "16:00:00");
  assert.equal(normalizeTime("", "09:00:00"), "09:00:00");
});

test("isWithinCallingHours accurately evaluates business hour constraints", () => {
  // Inside explicit window
  assert.equal(isWithinCallingHours("10:00:00", "09:00:00", "17:00:00"), true);
  assert.equal(isWithinCallingHours("09:00:00", "09:00", "17:00"), true);
  assert.equal(isWithinCallingHours("17:00:00", "09:00", "17:00"), true);

  // Outside explicit window
  assert.equal(isWithinCallingHours("08:59:59", "09:00:00", "17:00:00"), false);
  assert.equal(isWithinCallingHours("17:00:01", "09:00:00", "17:00:00"), false);
  assert.equal(isWithinCallingHours("22:00:00", "09:00:00", "17:00:00"), false);

  // Default fallback window (09:00:00 to 16:00:00) when start/end are null
  assert.equal(isWithinCallingHours("12:00:00", null, null), true);
  assert.equal(isWithinCallingHours("08:00:00", null, null), false);
  assert.equal(isWithinCallingHours("18:00:00", null, null), false);
});

test("getClientLocalTimeAndDate parses timezone offsets accurately", () => {
  const instant = new Date("2026-06-15T12:00:00.000Z");

  const utc = getClientLocalTimeAndDate("UTC", instant);
  assert.equal(utc.date, "2026-06-15");
  assert.equal(utc.time, "12:00:00");

  const newYork = getClientLocalTimeAndDate("America/New_York", instant);
  assert.equal(newYork.date, "2026-06-15");
  assert.equal(newYork.time, "08:00:00"); // EDT is UTC-4

  const kolkata = getClientLocalTimeAndDate("Asia/Kolkata", instant);
  assert.equal(kolkata.date, "2026-06-15");
  assert.equal(kolkata.time, "17:30:00"); // IST is UTC+5:30

  // Gracefully handles invalid timezone without throwing
  const fallback = getClientLocalTimeAndDate("Invalid/Timezone", instant);
  assert.equal(fallback.date, "2026-06-15");
  assert.equal(fallback.time, "12:00:00");
});
