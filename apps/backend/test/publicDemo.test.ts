import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request } from "express";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/folio";
process.env.NODE_ENV = "test";

const { isFooliooSystemContact } = await import("../src/services/workspaceConfiguration.js");
const { isLocalPublicDemoDevelopmentRequest } = await import("../src/middleware/publicDemo.js");

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

test("public demo phone cooldown exemption requires a localhost development proxy request", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalProxySecret = process.env.PUBLIC_DEMO_PROXY_SECRET;
  process.env.NODE_ENV = "development";
  process.env.PUBLIC_DEMO_PROXY_SECRET = "local-proxy-secret";

  const request = (headers: Record<string, string>) => ({
    get: (name: string) => headers[name.toLowerCase()],
  }) as Request;

  assert.equal(isLocalPublicDemoDevelopmentRequest(request({
    "x-public-demo-local-development": "true",
    "x-public-demo-proxy-secret": "local-proxy-secret",
  })), true);
  assert.equal(isLocalPublicDemoDevelopmentRequest(request({
    "x-public-demo-proxy-secret": "local-proxy-secret",
  })), false);
  assert.equal(isLocalPublicDemoDevelopmentRequest(request({
    "x-public-demo-local-development": "true",
    "x-public-demo-proxy-secret": "wrong-secret",
  })), false);

  process.env.NODE_ENV = "production";
  assert.equal(isLocalPublicDemoDevelopmentRequest(request({
    "x-public-demo-local-development": "true",
    "x-public-demo-proxy-secret": "local-proxy-secret",
  })), false);

  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalProxySecret === undefined) delete process.env.PUBLIC_DEMO_PROXY_SECRET;
  else process.env.PUBLIC_DEMO_PROXY_SECRET = originalProxySecret;
});
