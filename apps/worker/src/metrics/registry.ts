export interface WorkerMetricsState {
  service: string;
  version: string;
  uptimeSeconds: number;
  startedAt: string;
  totalCycles: number;
  lastCycleAt: string | null;
  recordings: {
    scannedTotal: number;
    syncedTotal: number;
    lastSyncedCount: number;
    lastSyncAt: string | null;
    lastError: string | null;
  };
  queue: {
    zombiesCleanedTotal: number;
    completedPurgedTotal: number;
    lastCleanedAt: string | null;
    lastError: string | null;
  };
  system: {
    memoryUsageMb: number;
    nodeVersion: string;
  };
}

class WorkerMetricsRegistry {
  private readonly startedAt = new Date();
  private totalCycles = 0;
  private lastCycleAt: Date | null = null;

  private recordingsScannedTotal = 0;
  private recordingsSyncedTotal = 0;
  private lastSyncedCount = 0;
  private lastSyncAt: Date | null = null;
  private lastRecordingError: string | null = null;

  private zombiesCleanedTotal = 0;
  private completedPurgedTotal = 0;
  private lastQueueCleanedAt: Date | null = null;
  private lastQueueError: string | null = null;

  public recordCycle(): void {
    this.totalCycles++;
    this.lastCycleAt = new Date();
  }

  public recordRecordingSync(scanned: number, synced: number): void {
    this.recordingsScannedTotal += scanned;
    this.recordingsSyncedTotal += synced;
    this.lastSyncedCount = synced;
    this.lastSyncAt = new Date();
    this.lastRecordingError = null;
  }

  public recordRecordingError(err: string): void {
    this.lastRecordingError = err;
  }

  public recordQueueCleanup(zombies: number, purged: number): void {
    this.zombiesCleanedTotal += zombies;
    this.completedPurgedTotal += purged;
    this.lastQueueCleanedAt = new Date();
    this.lastQueueError = null;
  }

  public recordQueueError(err: string): void {
    this.lastQueueError = err;
  }

  public toJSON(): WorkerMetricsState {
    const mem = process.memoryUsage();
    return {
      service: "folio-worker",
      version: "1.0.0",
      uptimeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      startedAt: this.startedAt.toISOString(),
      totalCycles: this.totalCycles,
      lastCycleAt: this.lastCycleAt?.toISOString() ?? null,
      recordings: {
        scannedTotal: this.recordingsScannedTotal,
        syncedTotal: this.recordingsSyncedTotal,
        lastSyncedCount: this.lastSyncedCount,
        lastSyncAt: this.lastSyncAt?.toISOString() ?? null,
        lastError: this.lastRecordingError,
      },
      queue: {
        zombiesCleanedTotal: this.zombiesCleanedTotal,
        completedPurgedTotal: this.completedPurgedTotal,
        lastCleanedAt: this.lastQueueCleanedAt?.toISOString() ?? null,
        lastError: this.lastQueueError,
      },
      system: {
        memoryUsageMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        nodeVersion: process.version,
      },
    };
  }

  public toPrometheusText(): string {
    const json = this.toJSON();
    const lines = [
      "# HELP worker_uptime_seconds Total seconds the worker process has been running",
      "# TYPE worker_uptime_seconds gauge",
      `worker_uptime_seconds ${json.uptimeSeconds}`,
      "",
      "# HELP worker_cycles_total Total background task cycles executed",
      "# TYPE worker_cycles_total counter",
      `worker_cycles_total ${json.totalCycles}`,
      "",
      "# HELP worker_recordings_scanned_total Total Plivo recordings scanned",
      "# TYPE worker_recordings_scanned_total counter",
      `worker_recordings_scanned_total ${json.recordings.scannedTotal}`,
      "",
      "# HELP worker_recordings_synced_total Total Plivo recordings successfully linked in database",
      "# TYPE worker_recordings_synced_total counter",
      `worker_recordings_synced_total ${json.recordings.syncedTotal}`,
      "",
      "# HELP worker_queue_zombies_cleaned_total Total zombie queue entries cleaned",
      "# TYPE worker_queue_zombies_cleaned_total counter",
      `worker_queue_zombies_cleaned_total ${json.queue.zombiesCleanedTotal}`,
      "",
      "# HELP worker_queue_completed_purged_total Total completed queue entries purged",
      "# TYPE worker_queue_completed_purged_total counter",
      `worker_queue_completed_purged_total ${json.queue.completedPurgedTotal}`,
      "",
      "# HELP worker_memory_heap_mb Memory heap used in megabytes",
      "# TYPE worker_memory_heap_mb gauge",
      `worker_memory_heap_mb ${json.system.memoryUsageMb}`,
    ];
    return lines.join("\n") + "\n";
  }
}

export const workerMetrics = new WorkerMetricsRegistry();
