import { jsPDF } from "jspdf";
import type { AnalyticsData } from "@/components/dashboard/analytics-dashboard";
import { formatPhoneNumber } from "@/lib/utils/format-phone";

type Row = Record<string, unknown>;

function num(row: Row | undefined, key: string): number {
  const val = row?.[key];
  return typeof val === "number" && Number.isFinite(val) ? val : 0;
}

function txt(row: Row | undefined, key: string, fallback = "-"): string {
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

function fmtShortDate(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "";
  const parsed = raw.includes("T") ? new Date(raw) : new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return raw.slice(5, 10);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(parsed);
}

function fmtDateLabel(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "-";
  const parsed = raw.includes("T") ? new Date(raw) : new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function fmtDateTimeLabel(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
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

function cleanPdfText(input: string): string {
  return input
    .replaceAll("•", "-")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("…", "...")
    .replaceAll("₹", "INR ")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replace(/[^\x20-\x7E]/g, " ");
}

export function generateAnalyticsPdfDocument(timeframe: string, data: AnalyticsData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth(); // ~595.28
  const pageH = doc.internal.pageSize.getHeight(); // ~841.89
  const marginX = 36;
  const contentW = pageW - marginX * 2;
  const bottomLimit = pageH - 42;

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

  const workspaceName = cleanPdfText(txt(client, "name", "Foolioo Workspace"));
  const planTier = cleanPdfText(txt(client, "planTier", "Trial").toUpperCase());
  const workspaceStatus = cleanPdfText(txt(client, "status", "active").toUpperCase());
  const periodLabel = cleanPdfText(timeframeTitle(timeframe));
  const generatedAt = cleanPdfText(
    new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date()),
  );

  const connectionRate = fmtPct(connectedCalls, totalCalls);
  const highIntentRate = fmtPct(highInterest, interestTotal || connectedCalls);

  let y = 34;

  const addPageWithHeader = () => {
    doc.addPage();
    y = 34;
    doc.setFillColor(248, 247, 242);
    doc.rect(marginX, y - 8, contentW, 24, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 74, 187);
    doc.text(cleanPdfText(`FOOLIOO ANALYTICS  -  ${workspaceName} (${periodLabel})`), marginX + 10, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(116, 120, 120);
    doc.text(cleanPdfText(`Generated ${generatedAt}`), pageW - marginX - 10, y + 7, { align: "right" });
    y += 28;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      addPageWithHeader();
    }
  };

  const drawCardHeading = (title: string, subtitle: string, badge?: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(27, 28, 24);
    doc.text(cleanPdfText(title), marginX + 14, y + 18);

    if (badge) {
      doc.setFillColor(243, 240, 250);
      doc.roundedRect(pageW - marginX - 94, y + 7, 80, 16, 8, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(118, 85, 199);
      doc.text(cleanPdfText(badge), pageW - marginX - 54, y + 17.5, { align: "center" });
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(119, 121, 112);
    doc.text(cleanPdfText(subtitle), marginX + 14, y + 31);
  };

  const drawHorizontalBar = (
    x: number,
    barY: number,
    width: number,
    label: string,
    value: number,
    denom: number,
    fillRgb: [number, number, number],
  ) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(52, 53, 47);
    doc.text(cleanPdfText(label), x, barY);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(27, 28, 24);
    doc.text(cleanPdfText(`${fmtInt(value)} (${fmtPct(value, denom)})`), x + width, barY, {
      align: "right",
    });

    const trackY = barY + 4;
    const trackH = 6;
    doc.setFillColor(240, 239, 233);
    doc.roundedRect(x, trackY, width, trackH, 3, 3, "F");

    const ratio = denom > 0 ? Math.min(1, Math.max(0, value / denom)) : 0;
    const fillW = width * ratio;
    if (fillW > 0) {
      doc.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
      doc.roundedRect(x, trackY, Math.max(4, fillW), trackH, 3, 3, "F");
    }
  };

  // ── TOP BANNER ───────────────────────────────────────────────────────────────
  doc.setFillColor(27, 28, 24);
  doc.roundedRect(marginX, y, contentW, 68, 8, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(214, 198, 255);
  doc.text("FOOLIOO VOICE OPERATIONS  |  VISUAL ANALYTICS REPORT", marginX + 16, y + 19);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text(workspaceName, marginX + 16, y + 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(218, 217, 210);
  doc.text(
    cleanPdfText(`Reporting Window: ${periodLabel}   •   Plan: ${planTier} (${workspaceStatus})`),
    marginX + 16,
    y + 56,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(195, 194, 188);
  doc.text(cleanPdfText(`Generated: ${generatedAt}`), pageW - marginX - 16, y + 56, {
    align: "right",
  });
  y += 80;

  // ── KPI METRIC CARDS (2x2 or 4-column grid) ───────────────────────────────────
  const kpiW = (contentW - 24) / 4;
  const kpiH = 58;
  const kpis = [
    {
      label: "Total Calls",
      value: fmtInt(totalCalls),
      note: `${fmtInt(pendingInQueue)} in queue`,
      accent: [118, 85, 199] as [number, number, number],
    },
    {
      label: "Connection Rate",
      value: connectionRate,
      note: `${fmtInt(connectedCalls)} connected`,
      accent: [77, 148, 105] as [number, number, number],
    },
    {
      label: "Avg. Connected Call",
      value: fmtDuration(avgDuration),
      note: `${fmtDuration(totalDuration)} total talk`,
      accent: [215, 166, 74] as [number, number, number],
    },
    {
      label: "Credits Consumed",
      value: fmtInt(creditsCharged),
      note: `${fmtInt(creditsRemaining)} remaining`,
      accent: [27, 28, 24] as [number, number, number],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const kx = marginX + idx * (kpiW + 8);
    doc.setFillColor(255, 254, 251);
    doc.setDrawColor(236, 235, 229);
    doc.setLineWidth(0.8);
    doc.roundedRect(kx, y, kpiW, kpiH, 6, 6, "FD");

    doc.setFillColor(kpi.accent[0], kpi.accent[1], kpi.accent[2]);
    doc.rect(kx, y, kpiW, 3, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(116, 120, 120);
    doc.text(cleanPdfText(kpi.label), kx + 10, y + 16);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(27, 28, 24);
    doc.text(cleanPdfText(kpi.value), kx + 10, y + 34);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(133, 135, 127);
    doc.text(cleanPdfText(kpi.note), kx + 10, y + 48);
  });
  y += kpiH + 12;

  // ── PLAIN-LANGUAGE EXECUTIVE TAKEAWAYS ────────────────────────────────────────
  const summaryLines: string[] = [];
  if (totalCalls === 0) {
    summaryLines.push(
      "No calls occurred in this date range. Once campaigns or test calls run, pickup, intent, and trend charts populate automatically.",
    );
  } else {
    summaryLines.push(
      `Answer performance: ${fmtInt(connectedCalls)} of ${fmtInt(totalCalls)} calls connected (${connectionRate}), averaging ${fmtDuration(avgDuration)} per connected call.`,
    );
    summaryLines.push(
      `Caller intent: ${fmtInt(highInterest)} high-interest leads (${highIntentRate}) and ${fmtInt(followUpsRequested)} follow-up requests captured.`,
    );
  }
  summaryLines.push(
    `Capacity status: ${fmtInt(creditsRemaining)} of ${fmtInt(monthlyAllowance)} monthly credits left; ${fmtInt(callsRemainingToday)} of ${fmtInt(maxCallsPerDay)} daily calls remaining today.`,
  );

  const wrappedSummary = summaryLines.flatMap((line) => doc.splitTextToSize(cleanPdfText(`• ${line}`), contentW - 28));
  const summaryBoxH = 28 + wrappedSummary.length * 12;
  ensureSpace(summaryBoxH + 10);

  doc.setFillColor(248, 247, 242);
  doc.setDrawColor(233, 232, 225);
  doc.roundedRect(marginX, y, contentW, summaryBoxH, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(119, 121, 112);
  doc.text("AT A GLANCE  -  WHAT THESE NUMBERS MEAN", marginX + 14, y + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(37, 38, 32);
  let sy = y + 28;
  for (const wLine of wrappedSummary) {
    doc.text(wLine, marginX + 14, sy);
    sy += 12;
  }
  y += summaryBoxH + 12;

  // ── CALL ACTIVITY COLUMN CHART + CALL OUTCOMES BAR CHART ──────────────────────
  const chartRowH = 186;
  ensureSpace(chartRowH + 12);

  const leftPanelW = contentW * 0.56;
  const rightPanelW = contentW - leftPanelW - 10;
  const rightPanelX = marginX + leftPanelW + 10;

  // Left: Call Activity Vertical Bar Chart
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(236, 235, 229);
  doc.roundedRect(marginX, y, leftPanelW, chartRowH, 6, 6, "FD");
  drawCardHeading(
    "Call Activity Chart",
    "Daily total vs. connected calls",
    timeframe === "all" ? "ALL TIME" : timeframe.toUpperCase(),
  );

  const trendSlice = (Array.isArray(data.dailyTrend) ? data.dailyTrend : []).slice(-10);
  const plotLeft = marginX + 26;
  const plotRight = marginX + leftPanelW - 14;
  const plotTop = y + 50;
  const plotBottom = y + chartRowH - 34;
  const plotW = plotRight - plotLeft;
  const plotH = Math.max(20, plotBottom - plotTop);

  // Grid & axes
  doc.setDrawColor(235, 234, 228);
  doc.setLineWidth(0.6);
  for (let g = 0; g <= 2; g++) {
    const gy = plotTop + (plotH / 2) * g;
    doc.line(plotLeft, gy, plotRight, gy);
  }
  doc.setDrawColor(180, 178, 170);
  doc.line(plotLeft, plotBottom, plotRight, plotBottom);

  if (trendSlice.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(146, 147, 140);
    doc.text("No daily call activity in this window.", marginX + leftPanelW / 2, plotTop + plotH / 2, {
      align: "center",
    });
  } else {
    const maxVal = Math.max(1, ...trendSlice.map((r) => num(r, "totalCalls")));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(146, 147, 140);
    doc.text(String(maxVal), plotLeft - 4, plotTop + 3, { align: "right" });
    doc.text("0", plotLeft - 4, plotBottom, { align: "right" });

    const slotW = plotW / trendSlice.length;
    const barW = Math.min(20, Math.max(6, slotW * 0.52));

    trendSlice.forEach((row, i) => {
      const dayTotal = num(row, "totalCalls");
      const dayConn = num(row, "connectedCalls");
      const cx = plotLeft + i * slotW + slotW / 2 - barW / 2;

      const totalH = Math.max(2, (dayTotal / maxVal) * plotH);
      const totalY = plotBottom - totalH;
      doc.setFillColor(234, 229, 247);
      doc.roundedRect(cx, totalY, barW, totalH, 2, 2, "F");

      if (dayConn > 0) {
        const connH = Math.max(2, (Math.min(dayTotal, dayConn) / maxVal) * plotH);
        const connY = plotBottom - connH;
        doc.setFillColor(118, 85, 199);
        doc.roundedRect(cx, connY, barW, connH, 2, 2, "F");
      }

      const dShort = fmtShortDate(row.date);
      if (dShort && (trendSlice.length <= 6 || i % 2 === 0)) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        doc.setTextColor(146, 147, 140);
        doc.text(cleanPdfText(dShort), cx + barW / 2, plotBottom + 10, { align: "center" });
      }
    });
  }

  // Legend at bottom of left chart card
  doc.setFillColor(234, 229, 247);
  doc.rect(marginX + 14, y + chartRowH - 15, 8, 8, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(119, 121, 112);
  doc.text("Total calls", marginX + 26, y + chartRowH - 8);

  doc.setFillColor(118, 85, 199);
  doc.rect(marginX + 82, y + chartRowH - 15, 8, 8, "F");
  doc.text("Connected", marginX + 94, y + chartRowH - 8);

  // Right: Call Outcomes Visual Bars
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(236, 235, 229);
  doc.roundedRect(rightPanelX, y, rightPanelW, chartRowH, 6, 6, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(27, 28, 24);
  doc.text("Call Outcomes", rightPanelX + 14, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(119, 121, 112);
  doc.text("How calls concluded", rightPanelX + 14, y + 31);

  const outcomeInnerW = rightPanelW - 28;
  drawHorizontalBar(rightPanelX + 14, y + 52, outcomeInnerW, "Connected", connectedCalls, totalCalls, [77, 148, 105]);
  drawHorizontalBar(rightPanelX + 14, y + 83, outcomeInnerW, "Unanswered / busy", unansweredCalls, totalCalls, [215, 166, 74]);
  drawHorizontalBar(rightPanelX + 14, y + 114, outcomeInnerW, "Dropped early", droppedEarlyCalls, totalCalls, [139, 141, 136]);
  drawHorizontalBar(rightPanelX + 14, y + 145, outcomeInnerW, "Failed", failedCalls, totalCalls, [198, 108, 92]);

  y += chartRowH + 12;

  // ── LEAD INTELLIGENCE & SENTIMENT VISUAL PANEL ────────────────────────────────
  const leadCardH = 192;
  ensureSpace(leadCardH + 12);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(236, 235, 229);
  doc.roundedRect(marginX, y, contentW, leadCardH, 6, 6, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(27, 28, 24);
  doc.text("Lead Interest & Caller Sentiment", marginX + 14, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(119, 121, 112);
  doc.text("Visual breakdown of caller interest and conversation mood", marginX + 14, y + 31);

  const halfW = (contentW - 42) / 2;
  const rightHalfX = marginX + 14 + halfW + 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(146, 147, 140);
  doc.text("INTEREST LEVEL", marginX + 14, y + 48);
  doc.text("CALLER SENTIMENT", rightHalfX, y + 48);

  drawHorizontalBar(marginX + 14, y + 63, halfW, "High interest", highInterest, interestTotal || totalCalls, [77, 148, 105]);
  drawHorizontalBar(marginX + 14, y + 94, halfW, "Medium interest", mediumInterest, interestTotal || totalCalls, [215, 166, 74]);
  drawHorizontalBar(marginX + 14, y + 125, halfW, "Low interest", lowInterest, interestTotal || totalCalls, [139, 141, 136]);

  drawHorizontalBar(rightHalfX, y + 63, halfW, "Positive", positiveSent, totalCalls, [77, 148, 105]);
  drawHorizontalBar(rightHalfX, y + 94, halfW, "Neutral", neutralSent, totalCalls, [155, 157, 150]);
  drawHorizontalBar(rightHalfX, y + 125, halfW, "Negative", negativeSent, totalCalls, [198, 108, 92]);

  doc.setFillColor(248, 247, 242);
  doc.roundedRect(marginX + 14, y + 153, contentW - 28, 28, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(27, 28, 24);
  doc.text(
    cleanPdfText(`Follow-up requests in period: ${fmtInt(followUpsRequested)}`),
    marginX + 24,
    y + 170,
  );
  doc.text(
    cleanPdfText(`Open follow-up tasks: ${fmtInt(openFollowUps)}`),
    pageW - marginX - 24,
    y + 170,
    { align: "right" },
  );

  y += leadCardH + 12;

  // ── QUOTA & CAPACITY PROGRESS GAUGES ──────────────────────────────────────────
  const quotaCardH = 126;
  ensureSpace(quotaCardH + 12);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(236, 235, 229);
  doc.roundedRect(marginX, y, contentW, quotaCardH, 6, 6, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(27, 28, 24);
  doc.text("Credits & Daily Capacity", marginX + 14, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(119, 121, 112);
  doc.text("Cycle allowance consumption and today's calling limit", marginX + 14, y + 31);

  const cycleUsedAndReserved = creditsUsedCycle + creditsReserved;
  drawHorizontalBar(
    marginX + 14,
    y + 50,
    contentW - 28,
    `Monthly voice credits used/reserved (${fmtInt(creditsRemaining)} left)`,
    cycleUsedAndReserved,
    Math.max(1, monthlyAllowance),
    [118, 85, 199],
  );
  drawHorizontalBar(
    marginX + 14,
    y + 83,
    contentW - 28,
    `Calls placed today (${fmtInt(callsRemainingToday)} remaining of daily cap)`,
    callsMadeToday,
    Math.max(1, maxCallsPerDay),
    [77, 148, 105],
  );

  y += quotaCardH + 12;

  // ── CAMPAIGN PERFORMANCE TABLE ────────────────────────────────────────────────
  const campaignsList = Array.isArray(data.campaignPerformance) ? data.campaignPerformance : [];
  ensureSpace(64);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(27, 28, 24);
  doc.text("Campaign Performance", marginX, y + 12);
  y += 22;

  if (campaignsList.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(236, 235, 229);
    doc.roundedRect(marginX, y, contentW, 34, 6, 6, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(146, 147, 140);
    doc.text("No campaign call activity recorded in this period.", marginX + 14, y + 20);
    y += 46;
  } else {
    const colX = [marginX, marginX + 175, marginX + 245, marginX + 305, marginX + 365, marginX + 445];
    const drawCampaignHeader = () => {
      doc.setFillColor(245, 244, 237);
      doc.rect(marginX, y, contentW, 20, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(94, 97, 91);
      doc.text("CAMPAIGN", colX[0] + 6, y + 13);
      doc.text("STATUS", colX[1], y + 13);
      doc.text("CALLS", colX[2], y + 13, { align: "right" });
      doc.text("CONNECTED", colX[3], y + 13, { align: "right" });
      doc.text("RATE", colX[4], y + 13, { align: "right" });
      doc.text("HIGH INTENT", colX[5] + 70, y + 13, { align: "right" });
      y += 22;
    };

    drawCampaignHeader();
    campaignsList.forEach((row, idx) => {
      ensureSpace(22);
      if (idx % 2 === 1) {
        doc.setFillColor(251, 250, 246);
        doc.rect(marginX, y - 3, contentW, 18, "F");
      }
      const cCalls = num(row, "totalCalls");
      const cConn = num(row, "connectedCalls");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(37, 38, 32);
      doc.text(cleanPdfText(txt(row, "campaignName", "Campaign").slice(0, 28)), colX[0] + 6, y + 9);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(119, 121, 112);
      doc.text(cleanPdfText(txt(row, "campaignStatus", "draft")), colX[1], y + 9);

      doc.setTextColor(37, 38, 32);
      doc.text(fmtInt(cCalls), colX[2], y + 9, { align: "right" });
      doc.text(fmtInt(cConn), colX[3], y + 9, { align: "right" });
      doc.text(fmtPct(cConn, cCalls), colX[4], y + 9, { align: "right" });
      doc.text(fmtInt(num(row, "highInterestCalls")), colX[5] + 70, y + 9, { align: "right" });

      doc.setDrawColor(240, 239, 233);
      doc.line(marginX, y + 15, marginX + contentW, y + 15);
      y += 19;
    });
    y += 8;
  }

  // ── RECENT CALL HIGHLIGHTS ───────────────────────────────────────────────────
  const recentList = Array.isArray(data.recentCalls) ? data.recentCalls : [];
  if (recentList.length > 0) {
    ensureSpace(44);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(27, 28, 24);
    doc.text("Recent Call Highlights", marginX, y + 12);
    y += 24;

    for (const row of recentList.slice(0, 8)) {
      const contactName = cleanPdfText(txt(row, "contactName", formatPhoneNumber(txt(row, "phoneNumber", "")) || "Contact"));
      const outcome = cleanPdfText(txt(row, "outcome", "unknown").replaceAll("_", " "));
      const interest = cleanPdfText(txt(row, "interestLevel", "unknown"));
      const sentiment = cleanPdfText(txt(row, "sentiment", "neutral"));
      const dur = fmtDuration(num(row, "durationSeconds"));
      const when = cleanPdfText(fmtDateTimeLabel(row.startedAt));
      const summary = cleanPdfText(txt(row, "summary", "No summary recorded."));
      const summaryLines = doc.splitTextToSize(summary, contentW - 24);
      const itemH = 26 + summaryLines.length * 11;

      ensureSpace(itemH + 8);
      doc.setFillColor(255, 254, 251);
      doc.setDrawColor(236, 235, 229);
      doc.roundedRect(marginX, y, contentW, itemH, 5, 5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(27, 28, 24);
      doc.text(`${contactName}  (${when})`, marginX + 12, y + 13);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(118, 85, 199);
      doc.text(
        `${outcome.toUpperCase()}  •  ${interest.toUpperCase()} INTENT  •  ${sentiment.toUpperCase()}  •  ${dur}`,
        pageW - marginX - 12,
        y + 13,
        { align: "right" },
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(101, 104, 97);
      let ry = y + 25;
      for (const sLine of summaryLines) {
        doc.text(sLine, marginX + 12, ry);
        ry += 11;
      }

      y += itemH + 8;
    }
  }

  // ── PAGE FOOTERS ─────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(233, 232, 225);
    doc.line(marginX, pageH - 28, pageW - marginX, pageH - 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(133, 135, 127);
    doc.text("Foolioo AI Voice Operations - Analytics Report", marginX, pageH - 16);
    doc.text(`Page ${p} of ${totalPages}`, pageW - marginX, pageH - 16, { align: "right" });
  }

  return doc;
}

export function exportAnalyticsToPdf(timeframe: string, data: AnalyticsData): boolean {
  if (typeof window === "undefined") return false;
  try {
    const doc = generateAnalyticsPdfDocument(timeframe, data);
    const safeSlug = timeframe.replace(/[^a-z0-9_-]/gi, "-") || "30d";
    doc.save(`foolioo-analytics-${safeSlug}.pdf`);
    return true;
  } catch (error) {
    console.error("[analytics/export-pdf] Failed to generate PDF:", error);
    return false;
  }
}
