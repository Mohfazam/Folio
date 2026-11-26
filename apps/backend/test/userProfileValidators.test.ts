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

test("validateAvatarUrl accepts valid http and https URLs and normalizes empty inputs to null", () => {
  assert.deepEqual(validateAvatarUrl(null), { valid: true, value: null });
  assert.deepEqual(validateAvatarUrl(""), { valid: true, value: null });
  assert.deepEqual(validateAvatarUrl("https://example.com/avatar.png"), {
    valid: true,
    value: "https://example.com/avatar.png"
  });
  assert.deepEqual(validateAvatarUrl("http://cdn.foolioo.app/user1.jpg"), {
    valid: true,
    value: "http://cdn.foolioo.app/user1.jpg"
  });
});

test("validateAvatarUrl rejects invalid protocols and malformed URLs", () => {
  assert.equal(validateAvatarUrl("ftp://example.com/avatar.png").valid, false);
  assert.equal(validateAvatarUrl("javascript:alert(1)").valid, false);
  assert.equal(validateAvatarUrl("not-a-valid-url").valid, false);
});

test("guardAgainstPhoneNumberChange strictly rejects payloads containing phone fields", () => {
  assert.equal(guardAgainstPhoneNumberChange({ displayName: "Bob" }).rejected, false);
  assert.equal(guardAgainstPhoneNumberChange({}).rejected, false);

  assert.equal(guardAgainstPhoneNumberChange({ phoneNumber: "+1234567890" }).rejected, true);
  assert.equal(guardAgainstPhoneNumberChange({ phone: "+1234567890" }).rejected, true);
  assert.equal(guardAgainstPhoneNumberChange({ phone_number: "+1234567890" }).rejected, true);
  assert.equal(guardAgainstPhoneNumberChange({ callerIdNumber: "+1234567890" }).rejected, true);
});
