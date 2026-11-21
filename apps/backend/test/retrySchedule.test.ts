import assert from "node:assert/strict";
import { test } from "node:test";
import { parseClockTime, nextAllowedCampaignTime } from "../src/utils/retrySchedule.js";

test("parseClockTime parses hour and minute from database clock values", () => {
  assert.deepEqual(parseClockTime("09:00:00"), { hour: 9, minute: 0 });
  assert.deepEqual(parseClockTime("23:59"), { hour: 23, minute: 59 });
});

test("parseClockTime rejects invalid clock values", () => {
  assert.throws(() => parseClockTime("24:00:00"), RangeError);
  assert.throws(() => parseClockTime("09:60:00"), RangeError);
  assert.throws(() => parseClockTime("invalid"), RangeError);
});

test("campaign scheduling uses the provided daily window", () => {
  assert.equal(
    nextAllowedCampaignTime(new Date("2026-11-21T14:00:00.000Z"), "Asia/Kolkata", "20:21", "22:00").toISOString(),
    "2026-11-21T14:51:00.000Z",
  );
  assert.equal(
    nextAllowedCampaignTime(new Date("2026-11-21T16:31:00.000Z"), "Asia/Kolkata", "20:21", "22:00").toISOString(),
    "2026-11-22T14:51:00.000Z",
  );
});

test("campaign scheduling honors an explicit start date", () => {
  const now = new Date("2026-11-21T14:52:00.000Z");
  assert.equal(
    nextAllowedCampaignTime(now, "Asia/Kolkata", "20:21", "22:00", "2026-11-23").toISOString(),
    "2026-11-23T14:51:00.000Z",
  );
});
