import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/utils/passwords.js";
import { signAuthToken, verifyAuthToken } from "../src/utils/tokens.js";

test("hashPassword produces valid salt:hash format and verifyPassword validates correctly", () => {
  const password = "SuperSecretPassword123!";
  const hash = hashPassword(password);

  assert.ok(hash.includes(":"));
  const [salt, key] = hash.split(":");
  assert.equal(salt.length, 32);
  assert.equal(key.length, 128);

  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword("WrongPassword", hash), false);
  assert.equal(verifyPassword("", hash), false);
  assert.equal(verifyPassword(password, "invalidhash"), false);
});

test("signAuthToken and verifyAuthToken roundtrip correctly", () => {
  const payload = {
    userId: "00000000-0000-0000-0000-000000000001",
    email: "test@foolioo.app",
    clientId: "00000000-0000-0000-0000-000000000002",
    role: "client_admin",
    authProvider: "email",
  };

  const token = signAuthToken(payload);
  assert.ok(typeof token === "string" && token.length > 20);

  const decoded = verifyAuthToken(token);
  assert.ok(decoded !== null);
  assert.equal(decoded.userId, payload.userId);
  assert.equal(decoded.email, payload.email);
  assert.equal(decoded.clientId, payload.clientId);
  assert.equal(decoded.role, payload.role);
  assert.equal(decoded.authProvider, payload.authProvider);

  assert.equal(verifyAuthToken("malformed.jwt.token"), null);
});
