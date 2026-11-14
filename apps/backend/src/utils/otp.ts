import { randomInt, createHash, timingSafeEqual } from "node:crypto";

export const OTP_EXPIRY_MINUTES = 10;
export const MAX_OTP_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

const OTP_PEPPER = process.env.OTP_PEPPER || process.env.WEBHOOK_SECRET || "foolioo_otp_default_salt_2026";

/**
 * Generates a cryptographically strong 6-digit numeric OTP.
 */
export function generateNumericOtp(): string {
  return randomInt(100000, 1000000).toString();
}

/**
 * Computes a salted SHA-256 hash of the OTP for storage.
 */
export function hashOtp(otp: string): string {
  return createHash("sha256")
    .update(`${otp.trim()}:${OTP_PEPPER}`)
    .digest("hex");
}

/**
 * Compares a candidate OTP against the stored hash in constant time.
 */
export function verifyOtpHash(candidateOtp: string, storedHash: string): boolean {
  if (!candidateOtp || !storedHash) return false;
  const candidateHash = hashOtp(candidateOtp);
  const candBuf = Buffer.from(candidateHash, "utf8");
  const storeBuf = Buffer.from(storedHash, "utf8");
  if (candBuf.length !== storeBuf.length) return false;
  return timingSafeEqual(candBuf, storeBuf);
}
