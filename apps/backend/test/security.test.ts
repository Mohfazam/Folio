import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import type { Server } from "node:http";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/folio";
process.env.NODE_ENV = "test";
process.env.ALLOWED_ORIGINS = "*";

const { createApp } = await import("../src/server.js");

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
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("Helmet sets security headers", async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-download-options"), "noopen");
});

test("CORS allows requests from caller origin and sets credential headers", async () => {
  const res = await fetch(`${baseUrl}/health`, {
    headers: { Origin: "http://frontend.local:3000" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "http://frontend.local:3000");
  assert.equal(res.headers.get("access-control-allow-credentials"), "true");
});

test("CORS preflight OPTIONS returns allowed methods and headers", async () => {
  const res = await fetch(`${baseUrl}/api/contacts`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Authorization, Content-Type",
    },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:3000");
  assert.ok(res.headers.get("access-control-allow-methods")?.includes("POST"));
});

test("Express rejects payload exceeding 1MB limit with 413", async () => {
  // Generate a payload slightly larger than 1MB
  const largeString = "a".repeat(1.2 * 1024 * 1024);
  const res = await fetch(`${baseUrl}/api/calls/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: largeString }),
  });

  assert.equal(res.status, 413);
  const data = await res.json() as { ok: boolean; error: string };
  assert.equal(data.ok, false);
  assert.ok(data.error.includes("large"));
});

test("Express handles malformed JSON body with 400", async () => {
  const res = await fetch(`${baseUrl}/api/calls/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: `{"invalid": `,
  });

  assert.equal(res.status, 400);
  const data = await res.json() as { ok: boolean; error: string };
  assert.equal(data.ok, false);
  assert.ok(data.error.includes("Malformed JSON"));
});

test("Unmapped routes return structured 404 JSON", async () => {
  const res = await fetch(`${baseUrl}/nonexistent-endpoint`);
  assert.equal(res.status, 404);

  const data = await res.json() as { ok: boolean; error: string };
  assert.equal(data.ok, false);
  assert.ok(data.error.includes("Route not found"));
});
