import assert from "node:assert/strict";
import { test } from "node:test";
import { parseClockTime } from "../src/utils/retrySchedule.js";

test("parseClockTime parses hour and minute from database clock values", () => {
  assert.deepEqual(parseClockTime("09:00:00"), { hour: 9, minute: 0 });
  assert.deepEqual(parseClockTime("23:59"), { hour: 23, minute: 59 });
});

test("parseClockTime rejects invalid clock values", () => {
  assert.throws(() => parseClockTime("24:00:00"), RangeError);
  assert.throws(() => parseClockTime("09:60:00"), RangeError);
  assert.throws(() => parseClockTime("invalid"), RangeError);
});
