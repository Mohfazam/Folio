import type { AnalyticsData } from "@/components/dashboard/analytics-dashboard";

type Row = Record<string, unknown>;

function num(row: Row | undefined, key: string): number {
  const val = row?.[key];
  return typeof val === "number" && Number.isFinite(val) ? val : 0;
}

function txt(row: Row | undefined, key: string, fallback = "—"): string {
  const val = row?.[key];
  return typeof val === "string" && val.trim() ? val.trim() : fallback;
}

function fmtInt(value: number): string {
  return value.toLocaleString("en-IN");
}

function fmtPct(part: number, total: number): string {
  if (!total) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function fmtDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}m ${secs}s`;
}

function fmtDateLabel(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "—";
  const parsed = raw.includes("T") ? new Date(raw) : new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function fmtDateTimeLabel(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "—";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function timeframeTitle(tf: string): string {
  switch (tf) {
    case "today":
      return "Today";
    case "7d":
      return "Last 7 Days";
    case "90d":
      return "Last 90 Days";
    case "all":
      return "All Time";
    default:
      return "Last 30 Days";
  }
}

export function buildAnalyticsReportHtml(
  timeframe: string,
  data: AnalyticsData,
): string {
  const client = data.client ?? {};
  const quota = data.quota ?? {};
  const metrics = data.callMetrics ?? {};
  const leads = data.leadIntelligence ?? {};
  const pipeline = data.pipeline ?? {};
  const sentiments =
    leads.sentiments && typeof leads.sentiments === "object"
      ? (leads.sentiments as Row)
      : {};

  const totalCalls = num(metrics, "totalCalls");
  const connectedCalls = num(metrics, "connectedCalls");
  const unansweredCalls = num(metrics, "unansweredCalls");
  const failedCalls = num(metrics, "failedCalls");
  const droppedEarlyCalls = num(metrics, "droppedEarlyCalls");
  const avgDuration = num(metrics, "avgDurationSeconds");
  const totalDuration = num(metrics, "totalDurationSeconds");
  const creditsCharged = num(metrics, "totalCreditsCharged");

  const monthlyAllowance = num(quota, "monthlyCreditsAllowance");
  const creditsUsedCycle = num(quota, "creditsUsedThisCycle");
  const creditsReserved = num(quota, "creditsReservedThisCycle");
  const creditsRemaining = num(quota, "creditsRemaining");
  const maxCallsPerDay = num(quota, "maxCallsPerDay");
  const callsMadeToday = num(quota, "callsMadeToday");
  const callsRemainingToday = num(quota, "callsRemainingToday");

  const highInterest = num(leads, "highInterestCount");
  const mediumInterest = num(leads, "mediumInterestCount");
  const lowInterest = num(leads, "lowInterestCount");
  const interestTotal = highInterest + mediumInterest + lowInterest;
  const followUpsRequested = num(leads, "followUpsRequestedCount");

  const positiveSent = num(sentiments, "positive");
  const neutralSent = num(sentiments, "neutral");
  const negativeSent = num(sentiments, "negative");

  const pendingInQueue = num(pipeline, "pendingInQueue");
  const inProgress = num(pipeline, "inProgress");
  const openFollowUps = num(pipeline, "openFollowUps");

  const workspaceName = escapeHtml(txt(client, "name", "Foolioo Workspace"));
  const planTier = escapeHtml(txt(client, "planTier", "Standard").toUpperCase());
  const workspaceStatus = escapeHtml(txt(client, "status", "active").toUpperCase());
  const periodLabel = escapeHtml(timeframeTitle(timeframe));
  const generatedAt = escapeHtml(
    new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date()),
  );

  const connectionRate = fmtPct(connectedCalls, totalCalls);
  const highIntentShare = fmtPct(highInterest, interestTotal || connectedCalls);

  const insights: string[] = [];
  if (totalCalls === 0) {
    insights.push(
      "No outbound or inbound calls were recorded during this reporting window.",
    );
  } else {
    insights.push(
      `Out of ${fmtInt(totalCalls)} total call attempts, ${fmtInt(connectedCalls)} connected (${connectionRate} answer rate) with an average conversation length of ${fmtDuration(avgDuration)}.`,
    );
    if (highInterest > 0) {
      insights.push(
        `${fmtInt(highInterest)} callers (${highIntentShare} of qualified conversations) showed high interest and ${fmtInt(followUpsRequested)} requested a follow-up.`,
      );
    }
    if (unansweredCalls > connectedCalls) {
      insights.push(
        `${fmtInt(unansweredCalls)} calls went unanswered or busy — consider adjusting calling hours or retry windows to improve pickup rate.`,
      );
    }
  }
  if (monthlyAllowance > 0) {
    insights.push(
      `${fmtInt(creditsRemaining)} of ${fmtInt(monthlyAllowance)} monthly voice credits remain available (${fmtInt(callsRemainingToday)} of ${fmtInt(maxCallsPerDay)} daily call capacity left today).`,
    );
  }

  const dailyTrend = Array.isArray(data.dailyTrend) ? data.dailyTrend : [];
  const campaignRows = Array.isArray(data.campaignPerformance)
    ? data.campaignPerformance
    : [];
  const recentCalls = Array.isArray(data.recentCalls) ? data.recentCalls : [];

  const barRow = (label: string, count: number, denom: number, color: string) => {
    const pct = denom > 0 ? Math.min(100, Math.round((count / denom) * 100)) : 0;
    return `
      <div class="bar-item">
        <div class="bar-head">
          <span>${escapeHtml(label)}</span>
          <strong>${fmtInt(count)} (${fmtPct(count, denom)})</strong>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${color};"></div>
        </div>
      </div>
    `;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Foolioo Analytics Report — ${workspaceName} (${periodLabel})</title>
  <style>
    @page { size: A4; margin: 14mm 14mm 16mm 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Arial, sans-serif;
      color: #1B1C18;
      background: #FFFFFF;
      font-size: 11.5px;
      line-height: 1.48;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1B1C18;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #644ABB;
    }
    h1 {
      margin: 4px 0 2px;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #1B1C18;
    }
    .subtitle { color: #5E615B; font-size: 11px; }
    .meta { text-align: right; font-size: 10.5px; color: #5E615B; }
    .meta strong { color: #1B1C18; display: block; font-size: 12px; }
    .pill {
      display: inline-block;
      margin-top: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      background: #F3F0FA;
      color: #5737A6;
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
    }
    .summary-box {
      background: #F8F7F2;
      border: 1px solid #E6E4DC;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .summary-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6E6B62;
      margin: 0 0 6px;
    }
    .summary-box ul { margin: 0; padding-left: 16px; }
    .summary-box li { margin-bottom: 3px; color: #262722; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-card {
      border: 1px solid #E6E4DC;
      border-radius: 8px;
      padding: 10px 12px;
      background: #FFFEFB;
    }
    .kpi-label { font-size: 10px; color: #6E6B62; }
    .kpi-val { font-size: 20px; font-weight: 700; margin: 4px 0 2px; color: #1B1C18; }
    .kpi-note { font-size: 9.5px; color: #7C7E77; }
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .panel {
      border: 1px solid #E6E4DC;
      border-radius: 8px;
      padding: 12px 14px;
      break-inside: avoid;
    }
    .panel h2 {
      margin: 0 0 2px;
      font-size: 13px;
      font-weight: 700;
      color: #1B1C18;
    }
    .panel-desc {
      margin: 0 0 10px;
      font-size: 10px;
      color: #747878;
    }
    .bar-item { margin-bottom: 9px; }
    .bar-item:last-child { margin-bottom: 0; }
    .bar-head {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      margin-bottom: 3px;
      color: #34352F;
    }
    .bar-track {
      height: 7px;
      border-radius: 999px;
      background: #F0EFE9;
      overflow: hidden;
    }
    .bar-fill { height: 100%; border-radius: 999px; }
    .stat-list {
      width: 100%;
      border-collapse: collapse;
    }
    .stat-list td {
      padding: 5px 0;
      border-bottom: 1px solid #F2F1EC;
      font-size: 10.5px;
    }
    .stat-list tr:last-child td { border-bottom: none; }
    .stat-list td:last-child { text-align: right; font-weight: 600; }
    .section {
      margin-bottom: 16px;
      break-inside: avoid;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #E6E4DC;
      border-radius: 8px;
      overflow: hidden;
      font-size: 10.5px;
    }
    table.data-table th {
      background: #F5F4ED;
      text-align: left;
      padding: 7px 9px;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #5E615B;
      border-bottom: 1px solid #E6E4DC;
    }
    table.data-table td {
      padding: 6px 9px;
      border-bottom: 1px solid #F1F0EA;
      vertical-align: top;
    }
    table.data-table tr:last-child td { border-bottom: none; }
    .num { text-align: right !important; font-variant-numeric: tabular-nums; }
    .footer {
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px solid #E6E4DC;
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      color: #7C7E77;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Foolioo Voice Operations • Analytics Report</div>
      <h1>${workspaceName}</h1>
      <div class="subtitle">Detailed breakdown of call activity, outcomes, lead quality, pipeline &amp; credit usage</div>
    </div>
    <div class="meta">
      <strong>Period: ${periodLabel}</strong>
      <div>Generated ${generatedAt}</div>
      <span class="pill">${planTier} • ${workspaceStatus}</span>
    </div>
  </div>

  <div class="summary-box">
    <p class="summary-title">Executive Takeaways (Plain-Language Summary)</p>
    <ul>
      ${insights.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
    </ul>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total Calls Attempted</div>
      <div class="kpi-val">${fmtInt(totalCalls)}</div>
      <div class="kpi-note">${fmtInt(pendingInQueue)} waiting in queue</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Connection Rate</div>
      <div class="kpi-val">${connectionRate}</div>
      <div class="kpi-val" style="font-size:11px;font-weight:500;color:#5E615B;">${fmtInt(connectedCalls)} connected calls</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Avg. Connected Duration</div>
      <div class="kpi-val">${fmtDuration(avgDuration)}</div>
      <div class="kpi-note">${fmtDuration(totalDuration)} total talk time</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Credits Consumed</div>
      <div class="kpi-val">${fmtInt(creditsCharged)}</div>
      <div class="kpi-note">${fmtInt(creditsRemaining)} credits remaining</div>
    </div>
  </div>

  <div class="two-col">
    <div class="panel">
      <h2>1. Call Outcomes Breakdown</h2>
      <p class="panel-desc">How every attempted call concluded during ${periodLabel.toLowerCase()}.</p>
      ${barRow("Connected (Answered & Completed)", connectedCalls, totalCalls, "#4D9469")}
      ${barRow("Unanswered or Busy", unansweredCalls, totalCalls, "#D7A64A")}
      ${barRow("Dropped Early (< minimum threshold)", droppedEarlyCalls, totalCalls, "#8B8D88")}
      ${barRow("Failed / Technical Error", failedCalls, totalCalls, "#C66C5C")}
    </div>

    <div class="panel">
      <h2>2. Lead Interest &amp; Caller Sentiment</h2>
      <p class="panel-desc">Intent and emotional tone detected across completed conversations.</p>
      ${barRow("High Interest Leads", highInterest, interestTotal || totalCalls, "#4D9469")}
      ${barRow("Medium Interest Leads", mediumInterest, interestTotal || totalCalls, "#D7A64A")}
      ${barRow("Low Interest Leads", lowInterest, interestTotal || totalCalls, "#8B8D88")}
      <div style="height:8px"></div>
      ${barRow("Positive Sentiment", positiveSent, totalCalls, "#644ABB")}
      ${barRow("Neutral Sentiment", neutralSent, totalCalls, "#9B9D96")}
      ${barRow("Negative Sentiment", negativeSent, totalCalls, "#C66C5C")}
    </div>
  </div>

  <div class="two-col">
    <div class="panel">
      <h2>3. Quota, Capacity &amp; Credit Usage</h2>
      <p class="panel-desc">Current billing cycle allowance and daily operational limits.</p>
      <table class="stat-list">
        <tr><td>Monthly Credits Allowance</td><td>${fmtInt(monthlyAllowance)} credits</td></tr>
        <tr><td>Credits Used This Cycle</td><td>${fmtInt(creditsUsedCycle)} credits</td></tr>
        <tr><td>Credits Reserved (Active Queue)</td><td>${fmtInt(creditsReserved)} credits</td></tr>
        <tr><td>Credits Available</td><td>${fmtInt(creditsRemaining)} credits</td></tr>
        <tr><td>Calls Made Today / Daily Limit</td><td>${fmtInt(callsMadeToday)} / ${fmtInt(maxCallsPerDay)}</td></tr>
        <tr><td>Remaining Daily Call Allowance</td><td>${fmtInt(callsRemainingToday)} calls</td></tr>
        ${quota.nextBillingResetAt ? `<tr><td>Next Billing Cycle Reset</td><td>${escapeHtml(fmtDateLabel(quota.nextBillingResetAt))}</td></tr>` : ""}
      </table>
    </div>

    <div class="panel">
      <h2>4. Live Pipeline &amp; Follow-Up Queue</h2>
      <p class="panel-desc">Real-time operational queue and pending human action items.</p>
      <table class="stat-list">
        <tr><td>Calls Queued (Pending Dial)</td><td>${fmtInt(pendingInQueue)}</td></tr>
        <tr><td>Calls Currently In Progress</td><td>${fmtInt(inProgress)}</td></tr>
        <tr><td>Follow-Ups Requested in Period</td><td>${fmtInt(followUpsRequested)}</td></tr>
        <tr><td>Open Follow-Up Tasks</td><td>${fmtInt(openFollowUps)}</td></tr>
        <tr><td>Total Talk Time Recorded</td><td>${fmtDuration(totalDuration)}</td></tr>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="panel">
      <h2>5. Campaign Performance Comparison</h2>
      <p class="panel-desc">Volume, pickup efficiency, and high-intent conversion by campaign.</p>
      ${
        campaignRows.length
          ? `<table class="data-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th class="num">Total Calls</th>
                  <th class="num">Connected</th>
                  <th class="num">Connection Rate</th>
                  <th class="num">High Interest</th>
                  <th class="num">Talk Time</th>
                </tr>
              </thead>
              <tbody>
                ${campaignRows
                  .map((row) => {
                    const cTotal = num(row, "totalCalls");
                    const cConn = num(row, "connectedCalls");
                    return `<tr>
                      <td><strong>${escapeHtml(txt(row, "campaignName", "Campaign"))}</strong></td>
                      <td style="text-transform:capitalize">${escapeHtml(txt(row, "campaignStatus", "draft"))}</td>
                      <td class="num">${fmtInt(cTotal)}</td>
                      <td class="num">${fmtInt(cConn)}</td>
                      <td class="num">${fmtPct(cConn, cTotal)}</td>
                      <td class="num">${fmtInt(num(row, "highInterestCalls"))}</td>
                      <td class="num">${fmtDuration(num(row, "totalDurationSeconds"))}</td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>`
          : `<p style="margin:0;color:#747878;font-size:11px;">No campaign call activity recorded in this period.</p>`
      }
    </div>
  </div>

  ${
    dailyTrend.length
      ? `<div class="section">
          <div class="panel">
            <h2>6. Daily Call Activity Log</h2>
            <p class="panel-desc">Day-by-day breakdown of call attempts, connected conversations, and failures.</p>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th class="num">Total Calls</th>
                  <th class="num">Connected</th>
                  <th class="num">Failed</th>
                  <th class="num">Connection Rate</th>
                </tr>
              </thead>
              <tbody>
                ${dailyTrend
                  .map((row) => {
                    const dTotal = num(row, "totalCalls");
                    const dConn = num(row, "connectedCalls");
                    const dFail = num(row, "failedCalls");
                    return `<tr>
                      <td>${escapeHtml(fmtDateLabel(row.date))}</td>
                      <td class="num">${fmtInt(dTotal)}</td>
                      <td class="num">${fmtInt(dConn)}</td>
                      <td class="num">${fmtInt(dFail)}</td>
                      <td class="num">${fmtPct(dConn, dTotal)}</td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>`
      : ""
  }

  ${
    recentCalls.length
      ? `<div class="section">
          <div class="panel">
            <h2>7. Recent Call Highlights</h2>
            <p class="panel-desc">Latest recorded calls and AI conversation summaries.</p>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Time</th>
                  <th>Outcome</th>
                  <th>Interest / Sentiment</th>
                  <th class="num">Duration</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                ${recentCalls
                  .map((row) => {
                    const contactLabel = txt(row, "contactName", txt(row, "phoneNumber", "Contact"));
                    const outcomeLabel = txt(row, "outcome", "unknown").replaceAll("_", " ");
                    const interestLabel = txt(row, "interestLevel", "unknown");
                    const sentimentLabel = txt(row, "sentiment", "neutral");
                    return `<tr>
                      <td><strong>${escapeHtml(contactLabel)}</strong></td>
                      <td>${escapeHtml(fmtDateTimeLabel(row.startedAt))}</td>
                      <td style="text-transform:capitalize">${escapeHtml(outcomeLabel)}</td>
                      <td style="text-transform:capitalize">${escapeHtml(interestLabel)} / ${escapeHtml(sentimentLabel)}</td>
                      <td class="num">${fmtDuration(num(row, "durationSeconds"))}</td>
                      <td>${escapeHtml(txt(row, "summary", "No summary recorded."))}</td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>`
      : ""
  }

  <div class="footer">
    <span>Foolioo AI Voice Operations • Confidential Workspace Analytics</span>
    <span>Report Scope: ${periodLabel}</span>
  </div>
</body>
</html>`;
}

export function exportAnalyticsToPdf(timeframe: string, data: AnalyticsData): boolean {
  if (typeof window === "undefined") return false;
  const html = buildAnalyticsReportHtml(timeframe, data);
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1024,height=800");
  if (!printWindow) {
    return false;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
  };

  if (printWindow.document.readyState === "complete") {
    window.setTimeout(triggerPrint, 180);
  } else {
    printWindow.onload = () => window.setTimeout(triggerPrint, 180);
  }
  return true;
}
