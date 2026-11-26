import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDisplayName,
  validateAvatarUrl,
  validateBio,
  validateJobTitle,
  validateTimezone,
  validateCallingHoursTime,
  validateUserPreferences,
  validateUserProfileUpdate,
  guardAgainstPhoneNumberChange,
  guardAgainstEmailChange
} from "../src/validators/userProfileValidators.js";

test("validateDisplayName accepts valid non-empty names and trims whitespace", () => {
  const result = validateDisplayName("   Alice Smith   ");
  assert.equal(result.valid, true);
  assert.equal(result.value, "Alice Smith");
});

test("validateDisplayName rejects empty strings, non-strings, and names over 100 characters", () => {
  assert.equal(validateDisplayName("").valid, false);
  assert.equal(validateDisplayName("   ").valid, false);
  assert.equal(validateDisplayName(12345).valid, false);
  assert.equal(validateDisplayName(null).valid, false);
  assert.equal(validateDisplayName("A".repeat(101)).valid, false);
});
