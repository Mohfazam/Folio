import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createWorkerDaemon } from "../src/worker/workerDaemon.js";

describe("24/7 Worker Daemon", () => {
  it("initializes worker daemon with custom options", () => {
    const daemon = createWorkerDaemon({
      intervalMs: 5000,
      verbose: false,
    });
    assert.ok(daemon);
    assert.equal(typeof daemon.start, "function");
    assert.equal(typeof daemon.stop, "function");
    assert.equal(typeof daemon.runCycle, "function");
  });
});
