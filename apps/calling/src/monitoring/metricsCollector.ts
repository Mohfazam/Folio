import os from "node:os";
import { performance } from "node:perf_hooks";
import { activeCallRegistry } from "../session/ActiveCallRegistry.js";
import type { CallAnalysisResult, CallResult, CallStatus } from "../types/callTypes.js";

function formatSeconds(sec: number): string {
  if (sec <= 0) return "0s";
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = Math.floor(sec % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

function maskPhone(phone: string): string {
  if (!phone) return "unknown";
  const cleaned = phone.trim();
  if (cleaned.length <= 6) return cleaned;
  const start = cleaned.slice(0, cleaned.startsWith("+") ? 4 : 3);
  const end = cleaned.slice(-3);
  return `${start}****${end}`;
}

export interface RecentCallSummary {
  requestId: string;
  phoneNumber: string;
  status: string;
  durationSeconds: number;
  turns: number;
  sentiment?: string;
  interestLevel?: string;
  endedAt: string;
}

export class MetricsCollector {
  private readonly startedAt = new Date();

  // Call volumes
  private totalInitiated = 0;
  private totalConnected = 0;
  private totalCompleted = 0;
  private totalFailed = 0;
  private totalNoAnswer = 0;
  private totalInterrupted = 0;

  // Termination reasons
  private aiAutoHangup = 0;
  private maxDurationExceeded = 0;
  private interruptedOnShutdown = 0;

  // Duration tracking
  private totalDurationSeconds = 0;
  private longestDurationSeconds = 0;
  private shortestDurationSeconds = Number.MAX_SAFE_INTEGER;
  private durationBrackets = {
    under30s: 0,
    from30sTo2m: 0,
    from2mTo5m: 0,
    over5m: 0,
  };

  // Turn and latency tracking
  private totalTurns = 0;
  private firstSentenceLatencies: number[] = [];
  private firstAudioLatencies: number[] = [];
  private sttReconnects = 0;
  private emptyReplyFallbacks = 0;

  // Analytics & feedback
  private sentimentCounts = {
    positive: 0,
    neutral: 0,
    negative: 0,
    unknown: 0,
  };
  private interestCounts = {
    high: 0,
    medium: 0,
    low: 0,
    notInterested: 0,
    unknown: 0,
  };
  private followUpsRequested = 0;

  // Webhooks
  private webhooksDelivered = 0;
  private webhooksFailed = 0;

  // Recent call buffer (last 20 calls)
  private readonly recentCalls: RecentCallSummary[] = [];

  // Timestamps
  private lastCallInitiatedAt?: Date;
  private lastCallCompletedAt?: Date;

  // ── Recording Methods ─────────────────────────────────────────────

  recordCallInitiated(_phoneNumber?: string) {
    this.totalInitiated++;
    this.lastCallInitiatedAt = new Date();
  }

  recordCallConnected() {
    this.totalConnected++;
  }

  recordCallEnded(
    status: CallStatus,
    durationSeconds: number,
    terminationReason?: string,
    requestId?: string,
    phoneNumber?: string,
    turns = 0
  ) {
    this.lastCallCompletedAt = new Date();

    if (status === "completed") {
      this.totalCompleted++;
    } else if (status === "no_answer") {
      this.totalNoAnswer++;
    } else if (status === "interrupted") {
      this.totalInterrupted++;
      this.interruptedOnShutdown++;
    } else {
      this.totalFailed++;
    }

    // Check specific termination triggers
    const reasonLower = (terminationReason ?? "").toLowerCase();
    if (reasonLower.includes("auto-hangup") || reasonLower.includes("hangup signal")) {
      this.aiAutoHangup++;
    } else if (reasonLower.includes("max call duration") || reasonLower.includes("safety net")) {
      this.maxDurationExceeded++;
    }

    // Record duration if > 0
    if (durationSeconds > 0) {
      this.totalDurationSeconds += durationSeconds;
      if (durationSeconds > this.longestDurationSeconds) {
        this.longestDurationSeconds = durationSeconds;
      }
      if (durationSeconds < this.shortestDurationSeconds) {
        this.shortestDurationSeconds = durationSeconds;
      }

      if (durationSeconds < 30) {
        this.durationBrackets.under30s++;
      } else if (durationSeconds <= 120) {
        this.durationBrackets.from30sTo2m++;
      } else if (durationSeconds <= 300) {
        this.durationBrackets.from2mTo5m++;
      } else {
        this.durationBrackets.over5m++;
      }
    }

    if (turns > 0) {
      this.totalTurns += turns;
    }

    // Add to recent buffer
    if (requestId) {
      this.recentCalls.unshift({
        requestId,
        phoneNumber: maskPhone(phoneNumber ?? "unknown"),
        status,
        durationSeconds,
        turns,
        endedAt: new Date().toISOString(),
      });
      if (this.recentCalls.length > 20) {
        this.recentCalls.pop();
      }
    }
  }

  recordTurnLatency(firstSentenceMs?: number, firstAudioMs?: number) {
    if (firstSentenceMs && firstSentenceMs > 0) {
      this.firstSentenceLatencies.push(firstSentenceMs);
      if (this.firstSentenceLatencies.length > 100) this.firstSentenceLatencies.shift();
    }
    if (firstAudioMs && firstAudioMs > 0) {
      this.firstAudioLatencies.push(firstAudioMs);
      if (this.firstAudioLatencies.length > 100) this.firstAudioLatencies.shift();
    }
  }

  recordSttReconnect() {
    this.sttReconnects++;
  }

  recordEmptyReplyFallback() {
    this.emptyReplyFallbacks++;
  }

  recordAutoHangup() {
    this.aiAutoHangup++;
  }

  recordMaxDurationHangup() {
    this.maxDurationExceeded++;
  }

  recordCallAnalysis(requestId: string, analysis?: CallAnalysisResult) {
    if (!analysis) return;

    // Update recent call record if present
    const recent = this.recentCalls.find((c) => c.requestId === requestId);
    if (recent) {
      recent.sentiment = analysis.sentiment;
      recent.interestLevel = analysis.interestLevel;
    }

    // Sentiment
    const s = analysis.sentiment?.toLowerCase();
    if (s === "positive") this.sentimentCounts.positive++;
    else if (s === "negative") this.sentimentCounts.negative++;
    else if (s === "neutral") this.sentimentCounts.neutral++;
    else this.sentimentCounts.unknown++;

    // Interest level
    const i = analysis.interestLevel?.toLowerCase();
    if (i === "high") this.interestCounts.high++;
    else if (i === "medium") this.interestCounts.medium++;
    else if (i === "low") this.interestCounts.low++;
    else if (i === "not_interested" || i === "not interested") this.interestCounts.notInterested++;
    else this.interestCounts.unknown++;

    if (analysis.followUpRequested) {
      this.followUpsRequested++;
    }
  }

  recordWebhookResult(success: boolean) {
    if (success) {
      this.webhooksDelivered++;
    } else {
      this.webhooksFailed++;
    }
  }

  // ── Snapshot Computation ──────────────────────────────────────────

  getSnapshot() {
    const uptimeSec = process.uptime();
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const activeRecords = activeCallRegistry.getAllActive();
    const activeInitiating = activeRecords.filter((r) => r.phase === "initiating").length;
    const activeInProgress = activeRecords.filter((r) => r.phase === "in-progress").length;

    // Latency computations
    const avgFirstSentence =
      this.firstSentenceLatencies.length > 0
        ? Math.round(this.firstSentenceLatencies.reduce((a, b) => a + b, 0) / this.firstSentenceLatencies.length)
        : null;

    const minFirstSentence =
      this.firstSentenceLatencies.length > 0 ? Math.min(...this.firstSentenceLatencies) : null;

    const maxFirstSentence =
      this.firstSentenceLatencies.length > 0 ? Math.max(...this.firstSentenceLatencies) : null;

    const avgFirstAudio =
      this.firstAudioLatencies.length > 0
        ? Math.round(this.firstAudioLatencies.reduce((a, b) => a + b, 0) / this.firstAudioLatencies.length)
        : null;

    // Rates
    const connRate = this.totalInitiated > 0 ? ((this.totalConnected / this.totalInitiated) * 100).toFixed(1) : "0.0";
    const compRate = this.totalInitiated > 0 ? ((this.totalCompleted / this.totalInitiated) * 100).toFixed(1) : "0.0";
    const totalWebhooks = this.webhooksDelivered + this.webhooksFailed;
    const webhookDeliveryRate = totalWebhooks > 0 ? ((this.webhooksDelivered / totalWebhooks) * 100).toFixed(1) : "100.0";
    const completedCallsForAvg = this.totalCompleted + this.totalFailed + this.totalInterrupted;
    const avgDuration = completedCallsForAvg > 0 ? Math.round(this.totalDurationSeconds / completedCallsForAvg) : 0;
    const avgTurns = completedCallsForAvg > 0 ? +(this.totalTurns / completedCallsForAvg).toFixed(1) : 0;
    const shortestSec = this.shortestDurationSeconds === Number.MAX_SAFE_INTEGER ? 0 : this.shortestDurationSeconds;

    return {
      service: {
        name: "calling",
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
        status: activeInProgress > 50 ? "high_load" : "healthy",
        startedAt: this.startedAt.toISOString(),
        currentTime: new Date().toISOString(),
        uptimeSeconds: Math.floor(uptimeSec),
        uptimeFormatted: formatSeconds(uptimeSec),
        nodeVersion: process.version,
        platform: `${process.platform} (${process.arch})`,
        pid: process.pid,
      },
      system: {
        memory: {
          rssMb: +(mem.rss / (1024 * 1024)).toFixed(2),
          heapTotalMb: +(mem.heapTotal / (1024 * 1024)).toFixed(2),
          heapUsedMb: +(mem.heapUsed / (1024 * 1024)).toFixed(2),
          heapUsedPercent: `${((mem.heapUsed / mem.heapTotal) * 100).toFixed(1)}%`,
          externalMb: +(mem.external / (1024 * 1024)).toFixed(2),
          arrayBuffersMb: +(mem.arrayBuffers / (1024 * 1024)).toFixed(2),
        },
        os: {
          totalMemoryMb: +(os.totalmem() / (1024 * 1024)).toFixed(0),
          freeMemoryMb: +(os.freemem() / (1024 * 1024)).toFixed(0),
          memoryUsagePercent: `${(((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(1)}%`,
          cpuCount: os.cpus().length,
          loadAverage: os.loadavg().map((l) => +l.toFixed(2)),
        },
        cpu: {
          userMs: Math.round(cpu.user / 1000),
          systemMs: Math.round(cpu.system / 1000),
        },
      },
      calls: {
        summary: {
          totalInitiated: this.totalInitiated,
          totalConnected: this.totalConnected,
          totalCompleted: this.totalCompleted,
          totalFailed: this.totalFailed,
          totalNoAnswer: this.totalNoAnswer,
          totalInterrupted: this.totalInterrupted,
          connectionRatePercent: `${connRate}%`,
          completionRatePercent: `${compRate}%`,
        },
        terminationReasons: {
          aiAutoHangup: this.aiAutoHangup,
          maxDurationExceeded: this.maxDurationExceeded,
          interruptedOnShutdown: this.interruptedOnShutdown,
          userOrCarrierHangup: Math.max(0, this.totalCompleted - this.aiAutoHangup - this.maxDurationExceeded),
          timeoutOrNoAnswer: this.totalNoAnswer,
          errorOrFailed: this.totalFailed,
        },
        active: {
          totalActive: activeRecords.length,
          initiating: activeInitiating,
          inProgress: activeInProgress,
          activeCalls: activeRecords.map((r) => ({
            requestId: r.requestId,
            plivoCallId: r.plivoCallId ?? "pending",
            phoneNumber: maskPhone(r.phoneNumber),
            phase: r.phase,
            elapsedSeconds: Math.floor((Date.now() - r.startedAt.getTime()) / 1000),
            startedAt: r.startedAt.toISOString(),
          })),
        },
      },
      duration: {
        totalSeconds: this.totalDurationSeconds,
        totalFormatted: formatSeconds(this.totalDurationSeconds),
        averageSeconds: avgDuration,
        longestSeconds: this.longestDurationSeconds,
        shortestSeconds: shortestSec,
        brackets: this.durationBrackets,
      },
      performanceAndAi: {
        turns: {
          totalTurns: this.totalTurns,
          averageTurnsPerCall: avgTurns,
        },
        latency: {
          avgFirstSentenceMs: avgFirstSentence,
          minFirstSentenceMs: minFirstSentence,
          maxFirstSentenceMs: maxFirstSentence,
          avgFirstAudioMs: avgFirstAudio,
          sampleCount: this.firstSentenceLatencies.length,
        },
        speech: {
          sttReconnects: this.sttReconnects,
          emptyReplyFallbacks: this.emptyReplyFallbacks,
        },
      },
      analytics: {
        sentiment: this.sentimentCounts,
        interestLevel: this.interestCounts,
        followUpsRequested: this.followUpsRequested,
      },
      webhooks: {
        delivered: this.webhooksDelivered,
        failed: this.webhooksFailed,
        deliveryRatePercent: `${webhookDeliveryRate}%`,
      },
      timestamps: {
        lastCallInitiatedAt: this.lastCallInitiatedAt ? this.lastCallInitiatedAt.toISOString() : null,
        lastCallCompletedAt: this.lastCallCompletedAt ? this.lastCallCompletedAt.toISOString() : null,
      },
      recentCalls: this.recentCalls,
    };
  }

  // ── Prometheus Exporter Format ───────────────────────────────────

  toPrometheusFormat(): string {
    const snap = this.getSnapshot();
    const lines: string[] = [
      "# HELP calling_uptime_seconds Total time the service has been running in seconds",
      "# TYPE calling_uptime_seconds counter",
      `calling_uptime_seconds ${snap.service.uptimeSeconds}`,

      "# HELP calling_memory_heap_used_bytes V8 heap used in bytes",
      "# TYPE calling_memory_heap_used_bytes gauge",
      `calling_memory_heap_used_bytes ${process.memoryUsage().heapUsed}`,

      "# HELP calling_calls_initiated_total Total number of outbound call attempts initiated",
      "# TYPE calling_calls_initiated_total counter",
      `calling_calls_initiated_total ${this.totalInitiated}`,

      "# HELP calling_calls_connected_total Total number of calls that reached active media stream",
      "# TYPE calling_calls_connected_total counter",
      `calling_calls_connected_total ${this.totalConnected}`,

      "# HELP calling_calls_completed_total Total number of calls successfully completed",
      "# TYPE calling_calls_completed_total counter",
      `calling_calls_completed_total ${this.totalCompleted}`,

      "# HELP calling_calls_failed_total Total number of calls that failed",
      "# TYPE calling_calls_failed_total counter",
      `calling_calls_failed_total ${this.totalFailed}`,

      "# HELP calling_active_calls Current number of in-flight active calls",
      "# TYPE calling_active_calls gauge",
      `calling_active_calls ${snap.calls.active.totalActive}`,

      "# HELP calling_duration_seconds_total Total cumulative duration of all calls in seconds",
      "# TYPE calling_duration_seconds_total counter",
      `calling_duration_seconds_total ${this.totalDurationSeconds}`,

      "# HELP calling_ai_auto_hangups_total Number of calls terminated automatically by AI conclusion",
      "# TYPE calling_ai_auto_hangups_total counter",
      `calling_ai_auto_hangups_total ${this.aiAutoHangup}`,

      "# HELP calling_webhooks_delivered_total Total webhooks delivered successfully",
      "# TYPE calling_webhooks_delivered_total counter",
      `calling_webhooks_delivered_total ${this.webhooksDelivered}`,
    ];

    if (snap.performanceAndAi.latency.avgFirstSentenceMs !== null) {
      lines.push(
        "# HELP calling_ai_latency_first_sentence_ms Average LLM response latency to first sentence",
        "# TYPE calling_ai_latency_first_sentence_ms gauge",
        `calling_ai_latency_first_sentence_ms ${snap.performanceAndAi.latency.avgFirstSentenceMs}`
      );
    }

    return lines.join("\n") + "\n";
  }
}

export const metricsCollector = new MetricsCollector();
