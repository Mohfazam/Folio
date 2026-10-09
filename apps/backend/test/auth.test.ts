import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/folio";
process.env.NODE_ENV = "test";
process.env.WEBHOOK_SECRET = "test-webhook-secret-1234567890";
process.env.BACKEND_WORKER_SECRET = "test-worker-secret-1234567890";

const {
  getBearerToken,
  matchesSecret,
  requireWebhookSecret,
  requireWorkerSecret,
  requireWorkspace,
} = await import("../src/middleware/auth.js");

function createMockResponse() {
  const res: Partial<Response> & { _status?: number; _json?: any } = {
    status(code: number) {
      this._status = code;
      return this as Response;
    },
    json(data: any) {
      this._json = data;
      return this as Response;
    },
  };
  return res as Response & { _status?: number; _json?: any };
}

test("getBearerToken extracts bearer token from authorization header", () => {
  const mockReq1 = { get: (header: string) => (header === "authorization" ? "Bearer token123" : undefined) } as unknown as Request;
  assert.equal(getBearerToken(mockReq1), "token123");

  const mockReq2 = { get: (header: string) => (header === "authorization" ? "bearer   tokenABC  " : undefined) } as unknown as Request;
  assert.equal(getBearerToken(mockReq2), undefined); // malformed whitespace

  const mockReq3 = { get: (_header: string) => "Basic user:pass" } as unknown as Request;
  assert.equal(getBearerToken(mockReq3), undefined);

  const mockReq4 = { get: (_header: string) => undefined } as unknown as Request;
  assert.equal(getBearerToken(mockReq4), undefined);
});

test("matchesSecret performs timing-safe comparison", () => {
  assert.equal(matchesSecret("supersecret", "supersecret"), true);
  assert.equal(matchesSecret("supersecret", "wrongsecret"), false);
  assert.equal(matchesSecret("supersecret", "supersecre"), false); // different length
  assert.equal(matchesSecret(undefined, "supersecret"), false);
  assert.equal(matchesSecret("supersecret", undefined), false);
  assert.equal(matchesSecret("", ""), false);
});

test("requireWebhookSecret rejects missing or invalid webhook secrets", () => {
  const res1 = createMockResponse();
  let calledNext1 = false;
  const req1 = { get: () => undefined } as unknown as Request;
  requireWebhookSecret(req1, res1, () => { calledNext1 = true; });
  assert.equal(res1._status, 401);
  assert.equal(calledNext1, false);

  const res2 = createMockResponse();
  let calledNext2 = false;
  const req2 = { get: () => "invalid-secret" } as unknown as Request;
  requireWebhookSecret(req2, res2, () => { calledNext2 = true; });
  assert.equal(res2._status, 401);
  assert.equal(calledNext2, false);

  const res3 = createMockResponse();
  let calledNext3 = false;
  const req3 = { get: () => "test-webhook-secret-1234567890" } as unknown as Request;
  requireWebhookSecret(req3, res3, () => { calledNext3 = true; });
  assert.equal(calledNext3, true);
});

test("requireWorkerSecret rejects unauthorized worker triggers", () => {
  const res1 = createMockResponse();
  let calledNext1 = false;
  const req1 = { get: () => undefined } as unknown as Request;
  requireWorkerSecret(req1, res1, () => { calledNext1 = true; });
  assert.equal(res1._status, 401);
  assert.equal(calledNext1, false);

  const res2 = createMockResponse();
  let calledNext2 = false;
  const req2 = { get: () => "Bearer wrong-token" } as unknown as Request;
  requireWorkerSecret(req2, res2, () => { calledNext2 = true; });
  assert.equal(res2._status, 401);
  assert.equal(calledNext2, false);

  const res3 = createMockResponse();
  let calledNext3 = false;
  const req3 = { get: () => "Bearer test-worker-secret-1234567890" } as unknown as Request;
  requireWorkerSecret(req3, res3, () => { calledNext3 = true; });
  assert.equal(calledNext3, true);
});

test("requireWorkspace enforces tenant isolation and query/body consistency", () => {
  // Missing user/client
  const res1 = createMockResponse();
  let calledNext1 = false;
  const req1 = { user: undefined, clientId: undefined, query: {}, body: {} } as unknown as Request;
  requireWorkspace(req1, res1, () => { calledNext1 = true; });
  assert.equal(res1._status, 403);
  assert.equal(calledNext1, false);

  // Mismatching requested clientId in query
  const res2 = createMockResponse();
  let calledNext2 = false;
  const req2 = {
    user: { id: "u1" },
    clientId: "client-abc",
    query: { clientId: "client-xyz" },
    body: {},
  } as unknown as Request;
  requireWorkspace(req2, res2, () => { calledNext2 = true; });
  assert.equal(res2._status, 403);
  assert.equal(calledNext2, false);

  // Mismatching requested clientId in body
  const res3 = createMockResponse();
  let calledNext3 = false;
  const req3 = {
    user: { id: "u1" },
    clientId: "client-abc",
    query: {},
    body: { clientId: "client-xyz" },
  } as unknown as Request;
  requireWorkspace(req3, res3, () => { calledNext3 = true; });
  assert.equal(res3._status, 403);
  assert.equal(calledNext3, false);

  // Valid tenant context: injects clientId into body and calls next
  const res4 = createMockResponse();
  let calledNext4 = false;
  const req4 = {
    user: { id: "u1" },
    clientId: "client-abc",
    query: {},
    body: { name: "Test Contact" },
  } as unknown as Request;
  requireWorkspace(req4, res4, () => { calledNext4 = true; });
  assert.equal(calledNext4, true);
  assert.equal(req4.body.clientId, "client-abc");
});
