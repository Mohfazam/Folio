import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import type { Server } from "node:http";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/folio";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/server.js");
const { setShuttingDown } = await import("../src/routes/health.js");

let server: Server;
let baseUrl: string;

before(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address) {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  setShuttingDown(false);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("GET /health returns 200 with liveness metadata", async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);

  const data = await res.json() as { status: string; service: string; uptime: number };
  assert.equal(data.status, "healthy");
  assert.equal(data.service, "folio-backend");
  assert.equal(typeof data.uptime, "number");
});

test("GET /health/live returns 200 with identical liveness response", async () => {
  const res = await fetch(`${baseUrl}/health/live`);
  assert.equal(res.status, 200);

  const data = await res.json() as { status: string };
  assert.equal(data.status, "healthy");
});

test("GET /health/ready returns readiness check response with database check", async () => {
  const res = await fetch(`${baseUrl}/health/ready`);
  // Either 200 (if live neon DB reachable) or 503 (if mock DB URL used in isolated env)
  assert.ok(res.status === 200 || res.status === 503);

  const data = await res.json() as { status: string; checks: { database: { status: string } } };
  assert.ok(["ready", "unhealthy"].includes(data.status));
  assert.ok(["connected", "disconnected"].includes(data.checks.database.status));
});

test("GET /health/ready returns 503 when service is draining/shutting down", async () => {
  setShuttingDown(true);

  try {
    const res = await fetch(`${baseUrl}/health/ready`);
    assert.equal(res.status, 503);

    const data = await res.json() as { status: string; error: string };
    assert.equal(data.status, "shutting_down");
  } finally {
    setShuttingDown(false);
  }
});
