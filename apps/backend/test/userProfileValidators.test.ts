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

test("guardAgainstEmailChange strictly rejects payloads containing email fields", () => {
  assert.equal(guardAgainstEmailChange({ displayName: "Bob" }).rejected, false);
  assert.equal(guardAgainstEmailChange({}).rejected, false);

  assert.equal(guardAgainstEmailChange({ email: "newemail@example.com" }).rejected, true);
  assert.equal(guardAgainstEmailChange({ userEmail: "newemail@example.com" }).rejected, true);
  assert.equal(guardAgainstEmailChange({ user_email: "newemail@example.com" }).rejected, true);
});

test("validateUserPreferences accepts valid themes and preferences", () => {
  const valid = validateUserPreferences({
    theme: "dark",
    emailNotifications: true,
    callAlerts: false,
    audioPlaybackSpeed: 1.5,
    locale: "en-US"
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.value?.theme, "dark");
  assert.equal(valid.value?.emailNotifications, true);
  assert.equal(valid.value?.callAlerts, false);
  assert.equal(valid.value?.audioPlaybackSpeed, 1.5);
});

test("validateUserPreferences rejects invalid types and out-of-range values", () => {
  assert.equal(validateUserPreferences({ theme: "neon-glow" }).valid, false);
  assert.equal(validateUserPreferences({ emailNotifications: "not-a-bool" }).valid, false);
  assert.equal(validateUserPreferences({ audioPlaybackSpeed: 5.0 }).valid, false);
  assert.equal(validateUserPreferences({ audioPlaybackSpeed: 0.1 }).valid, false);
  assert.equal(validateUserPreferences("not-an-object").valid, false);
});

test("validateTimezone accepts valid IANA timezones and rejects invalid identifiers", () => {
  assert.equal(validateTimezone("America/New_York").valid, true);
  assert.equal(validateTimezone("Asia/Kolkata").valid, true);
  assert.equal(validateTimezone("UTC").valid, true);
  assert.equal(validateTimezone("Europe/London").valid, true);

  assert.equal(validateTimezone("Mars/Curiosity").valid, false);
  assert.equal(validateTimezone("").valid, false);
  assert.equal(validateTimezone(null).valid, false);
});

test("validateCallingHoursTime accepts valid 24h clock strings and normalizes format", () => {
  assert.deepEqual(validateCallingHoursTime("09:00"), { valid: true, value: "09:00:00" });
  assert.deepEqual(validateCallingHoursTime("17:30:45"), { valid: true, value: "17:30:45" });
  assert.deepEqual(validateCallingHoursTime("00:00"), { valid: true, value: "00:00:00" });
  assert.deepEqual(validateCallingHoursTime("23:59:59"), { valid: true, value: "23:59:59" });
});

test("validateCallingHoursTime rejects invalid hours and minutes", () => {
  assert.equal(validateCallingHoursTime("25:00").valid, false);
  assert.equal(validateCallingHoursTime("12:60").valid, false);
  assert.equal(validateCallingHoursTime("9am").valid, false);
  assert.equal(validateCallingHoursTime("").valid, false);
  assert.equal(validateCallingHoursTime(null).valid, false);
});

test("validateUserProfileUpdate validates combined fields and enforces unverified restrictions", () => {
  const valid = validateUserProfileUpdate({
    displayName: "Jane Doe",
    avatarUrl: "https://example.com/jane.jpg",
    bio: "Senior Sales Engineer",
    jobTitle: "Team Lead"
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.value?.displayName, "Jane Doe");
  assert.equal(valid.value?.bio, "Senior Sales Engineer");

  // Phone number presence immediately fails
  const withPhone = validateUserProfileUpdate({
    displayName: "Jane Doe",
    phoneNumber: "+19876543210"
  });
  assert.equal(withPhone.valid, false);

  // Email presence immediately fails
  const withEmail = validateUserProfileUpdate({
    displayName: "Jane Doe",
    email: "jane@newdomain.com"
  });
  assert.equal(withEmail.valid, false);
});
