import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/folio";
process.env.NODE_ENV = "test";

const { isFooliooSystemContact } = await import("../src/services/workspaceConfiguration.js");

test("public demo contacts are treated as isolated system calls", () => {
  assert.equal(isFooliooSystemContact({ _fooliooSystem: "public_demo" }), true);
});

test("dashboard test-call contacts remain system calls", () => {
  assert.equal(isFooliooSystemContact({ _fooliooSystem: "test_call" }), true);
});

test("ordinary contacts are not treated as system calls", () => {
  assert.equal(isFooliooSystemContact({}), false);
  assert.equal(isFooliooSystemContact(null), false);
});
