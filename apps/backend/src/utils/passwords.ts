import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Hashes a plain-text password using native Node.js scrypt with a unique random salt.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

/**
 * Verifies a plain-text password against a stored salt:hash string using constant-time comparison.
 */
export function verifyPassword(password: string, combinedHash: string): boolean {
  if (!password || !combinedHash || !combinedHash.includes(":")) return false;
  const [salt, key] = combinedHash.split(":");
  if (!salt || !key) return false;

  const keyBuffer = Buffer.from(key, "hex");
  const candidateBuffer = scryptSync(password, salt, 64);
  if (keyBuffer.length !== candidateBuffer.length) return false;

  return timingSafeEqual(keyBuffer, candidateBuffer);
}
