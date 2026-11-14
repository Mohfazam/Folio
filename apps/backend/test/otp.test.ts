import test from "node:test";
import assert from "node:assert/strict";
import { generateNumericOtp, hashOtp, verifyOtpHash } from "../src/utils/otp.js";
import { sendAuthOtpEmail, sendSupportOtpEmail } from "../src/services/email.js";

test("generateNumericOtp produces valid 6-digit numeric codes", () => {
  for (let i = 0; i < 20; i++) {
    const otp = generateNumericOtp();
    assert.match(otp, /^\d{6}$/);
    const num = parseInt(otp, 10);
    assert.ok(num >= 100000 && num <= 999999);
  }
});

test("hashOtp produces consistent SHA-256 hashes", () => {
  const otp1 = "123456";
  const otp2 = "654321";

  const hash1 = hashOtp(otp1);
  const hash1Again = hashOtp(otp1);
  const hash2 = hashOtp(otp2);

  assert.equal(hash1, hash1Again);
  assert.notEqual(hash1, hash2);
  assert.equal(typeof hash1, "string");
  assert.equal(hash1.length, 64);
});

test("verifyOtpHash correctly verifies matching codes and rejects mismatches", () => {
  const otp = "849201";
  const hashed = hashOtp(otp);

  assert.equal(verifyOtpHash(otp, hashed), true);
  assert.equal(verifyOtpHash("849202", hashed), false);
  assert.equal(verifyOtpHash("000000", hashed), false);
  assert.equal(verifyOtpHash("", hashed), false);
  assert.equal(verifyOtpHash(otp, ""), false);
});

test("email service fallback simulates send gracefully when SMTP is unconfigured", async () => {
  const authResult = await sendAuthOtpEmail({
    to: "test@example.com",
    otp: "123456",
  });
  assert.equal(authResult.ok, true);

  const supportResult = await sendSupportOtpEmail({
    to: "test@example.com",
    otp: "654321",
  });
  assert.equal(supportResult.ok, true);
});
