import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export function generateNumericOtp(): string {
  return randomInt(100000, 1000000).toString();
}

export function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

export function verifyOtpHash(otp: string, hashed: string): boolean {
  if (!otp || !hashed) return false;
  const candidateHash = hashOtp(otp);
  const candidateBuf = Buffer.from(candidateHash);
  const hashBuf = Buffer.from(hashed);
  if (candidateBuf.length !== hashBuf.length) return false;
  return timingSafeEqual(candidateBuf, hashBuf);
}
