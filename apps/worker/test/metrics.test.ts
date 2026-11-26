import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { workerMetrics } from "../src/metrics/registry.js";

describe("Worker Metrics Registry", () => {
  it("tracks execution cycles and increments correctly", () => {
    const before = workerMetrics.toJSON().totalCycles;
    workerMetrics.recordCycle();
    const after = workerMetrics.toJSON().totalCycles;
    assert.equal(after, before + 1);
  });

  it("records Plivo recording sync metrics", () => {
    workerMetrics.recordRecordingSync(10, 4);
    const json = workerMetrics.toJSON();
    assert.ok(json.recordings.scannedTotal >= 10);
    assert.ok(json.recordings.syncedTotal >= 4);
    assert.equal(json.recordings.lastSyncedCount, 4);
    assert.ok(json.recordings.lastSyncAt !== null);
  });

  it("records queue cleanup metrics", () => {
    workerMetrics.recordQueueCleanup(2, 5);
    const json = workerMetrics.toJSON();
    assert.ok(json.queue.zombiesCleanedTotal >= 2);
    assert.ok(json.queue.completedPurgedTotal >= 5);
    assert.ok(json.queue.lastCleanedAt !== null);
  });

  it("exports valid Prometheus format text", () => {
    const prom = workerMetrics.toPrometheusText();
    assert.ok(prom.includes("worker_uptime_seconds"));
    assert.ok(prom.includes("worker_recordings_synced_total"));
    assert.ok(prom.includes("worker_queue_zombies_cleaned_total"));
  });
});
