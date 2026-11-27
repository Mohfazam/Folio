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

function titleCaseLabel(raw: string): string {
  return raw
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function cleanPdfText(input: string): string {
  return input
    .replaceAll("•", "·")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("…", "...")
    .replaceAll("₹", "INR ")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replace(/[^\x20-\x7E\u00B7]/g, " ");
}

export function generateAnalyticsPdfDocument(timeframe: string, data: AnalyticsData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth(); // 595.28
  const pageH = doc.internal.pageSize.getHeight(); // 841.89
  const marginX = 44;
  const contentW = pageW - marginX * 2;
  const bottomLimit = pageH - 44;

  // Minimalist palette (Stripe / Linear inspired)
  const INK: [number, number, number] = [27, 28, 24];
  const MUTED: [number, number, number] = [102, 106, 104];
  const SUBTLE: [number, number, number] = [148, 151, 145];
  const HAIRLINE: [number, number, number] = [230, 228, 220];
  const TINT_BG: [number, number, number] = [250, 249, 245];
  const ACCENT: [number, number, number] = [100, 74, 187];
  const ACCENT_SOFT: [number, number, number] = [236, 231, 249];

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
  const openFollowUps = num(pipeline, "openFollowUps");

  const workspaceName = cleanPdfText(txt(client, "name", "Foolioo Workspace"));
  const planTier = cleanPdfText(titleCaseLabel(txt(client, "planTier", "Trial")));
  const periodLabel = cleanPdfText(timeframeTitle(timeframe));
  const generatedAt = cleanPdfText(
    new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date()),
  );
  const connectionRate = fmtPct(connectedCalls, totalCalls);

  let y = 44;

  const drawHairline = (lineY: number, x1 = marginX, x2 = pageW - marginX) => {
    doc.setDrawColor(HAIRLINE[0], HAIRLINE[1], HAIRLINE[2]);
    doc.setLineWidth(0.6);
    doc.line(x1, lineY, x2, lineY);
  };

  const drawSectionLabel = (label: string, rightNote?: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(SUBTLE[0], SUBTLE[1], SUBTLE[2]);
    doc.text(cleanPdfText(label.toUpperCase()), marginX, y);

    if (rightNote) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(cleanPdfText(rightNote), pageW - marginX, y, { align: "right" });
    }
    y += 12;
  };

  const addPageWithHeader = () => {
    doc.addPage();
    y = 40;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text("FOOLIOO", marginX, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(cleanPdfText(`${workspaceName} · ${periodLabel}`), marginX + 46, y);
    doc.text(cleanPdfText(`Generated ${generatedAt}`), pageW - marginX, y, { align: "right" });
    y += 10;
    drawHairline(y);
    y += 20;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      addPageWithHeader();
    }
  };

  const drawMinimalBar = (
    x: number,
    barY: number,
    width: number,
    label: string,
    value: number,
    denom: number,
    isPrimary = false,
  ) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(cleanPdfText(label), x, barY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(cleanPdfText(`${fmtInt(value)}  (${fmtPct(value, denom)})`), x + width, barY, {
      align: "right",
    });

    const trackY = barY + 5;
    const trackH = 3.5;
    doc.setFillColor(241, 240, 235);
    doc.roundedRect(x, trackY, width, trackH, 1.75, 1.75, "F");

    const ratio = denom > 0 ? Math.min(1, Math.max(0, value / denom)) : 0;
    const fillW = width * ratio;
    if (fillW > 0) {
      const fill = isPrimary ? ACCENT : INK;
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.roundedRect(x, trackY, Math.max(3, fillW), trackH, 1.75, 1.75, "F");
    }
  };

  // ── 1. MINIMAL EDITORIAL HEADER ──────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.text("FOOLIOO  ·  VOICE OPERATIONS REPORT", marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(cleanPdfText(`Plan: ${planTier}`), pageW - marginX, y, { align: "right" });

  y += 20;
  doc.setFont("times", "normal");
  doc.setFontSize(22);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(workspaceName, marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(SUBTLE[0], SUBTLE[1], SUBTLE[2]);
  doc.text(cleanPdfText(`Generated ${generatedAt}`), pageW - marginX, y, { align: "right" });

  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(cleanPdfText(`Reporting Window: ${periodLabel}`), marginX, y);

  y += 14;
  drawHairline(y);
  y += 18;

  // ── 2. 4-COLUMN HAIRLINE KPI STRIP ───────────────────────────────────────────
  const colW = contentW / 4;
  const kpis = [
    {
      label: "TOTAL CALLS",
      value: fmtInt(totalCalls),
      sub: `${fmtInt(pendingInQueue)} queued`,
      highlight: false,
    },
    {
      label: "CONNECTION RATE",
      value: connectionRate,
      sub: `${fmtInt(connectedCalls)} connected`,
      highlight: true,
    },
    {
      label: "AVG. DURATION",
      value: fmtDuration(avgDuration),
      sub: `${fmtDuration(totalDuration)} total talk`,
      highlight: false,
    },
    {
      label: "CREDITS USED",
      value: fmtInt(creditsCharged),
      sub: `${fmtInt(creditsRemaining)} of ${fmtInt(monthlyAllowance)} left`,
      highlight: false,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const kx = marginX + idx * colW;
    const textOffset = idx === 0 ? 0 : 12;

    if (idx > 0) {
      drawHairline(y + 42, kx, kx);
      doc.setDrawColor(HAIRLINE[0], HAIRLINE[1], HAIRLINE[2]);
      doc.setLineWidth(0.5);
      doc.line(kx, y - 2, kx, y + 40);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(SUBTLE[0], SUBTLE[1], SUBTLE[2]);
    doc.text(cleanPdfText(kpi.label), kx + textOffset, y + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    const valColor = kpi.highlight ? ACCENT : INK;
    doc.setTextColor(valColor[0], valColor[1], valColor[2]);
    doc.text(cleanPdfText(kpi.value), kx + textOffset, y + 25);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(cleanPdfText(kpi.sub), kx + textOffset, y + 38);
  });

  y += 52;
  drawHairline(y);
  y += 20;

  // ── 3. CALL ACTIVITY & OUTCOMES (TWO-COLUMN SPLIT) ───────────────────────────
  const splitGap = 24;
  const leftW = contentW * 0.55;
  const rightW = contentW - leftW - splitGap;
  const rightX = marginX + leftW + splitGap;
  const blockH = 136;

  // Left: Daily Activity Chart
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(SUBTLE[0], SUBTLE[1], SUBTLE[2]);
  doc.text("CALL ACTIVITY", marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Total vs. Connected", marginX + leftW, y, { align: "right" });

  // Right: Call Outcomes Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(SUBTLE[0], SUBTLE[1], SUBTLE[2]);
  doc.text("CALL OUTCOMES", rightX, y);

  const chartTop = y + 18;
  const chartBottom = y + blockH - 22;
  const chartLeft = marginX + 18;
  const chartRight = marginX + leftW;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;

  const trendSlice = (Array.isArray(data.dailyTrend) ? data.dailyTrend : []).slice(-12);

  // Subtle horizontal guide lines
  doc.setDrawColor(238, 237, 231);
  doc.setLineWidth(0.5);
  doc.line(chartLeft, chartTop, chartRight, chartTop);
  doc.line(chartLeft, chartTop + chartH / 2, chartRight, chartTop + chartH / 2);
  drawHairline(chartBottom, chartLeft, chartRight);

  if (trendSlice.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(SUBTLE[0], SUBTLE[1], SUBTLE[2]);
    doc.text("No daily call activity in this window.", chartLeft + chartW / 2, chartTop + chartH / 2, {
      align: "center",
    });
  } else {
    const maxVal = Math.max(1, ...trendSlice.map((r) => num(r, "totalCalls")));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(SUBTLE[0], SUBTLE[1], SUBTLE[2]);
    doc.text(String(maxVal), chartLeft - 5, chartTop + 3, { align: "right" });
    doc.text("0", chartLeft - 5, chartBottom, { align: "right" });

    const slotW = chartW / trendSlice.length;
    const barW = Math.min(14, Math.max(5, slotW * 0.34));

    trendSlice.forEach((row, i) => {
      const dayTotal = num(row, "totalCalls");
      const dayConn = num(row, "connectedCalls");
      const cx = chartLeft + i * slotW + slotW / 2 - barW / 2;

      const totalH = Math.max(2, (dayTotal / maxVal) * chartH);
      const totalY = chartBottom - totalH;
      doc.setFillColor(ACCENT_SOFT[0], ACCENT_SOFT[1], ACCENT_SOFT[2]);
      doc.roundedRect(cx, totalY, barW, totalH, 1.5, 1.5, "F");

      if (dayConn > 0) {
        const connH = Math.max(2, (Math.min(dayTotal, dayConn) / maxVal) * chartH);
        const connY = chartBottom - connH;
        doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        doc.roundedRect(cx, connY, barW, connH, 1.5, 1.5, "F");
      }

      if (dayTotal > 0 && trendSlice.length <= 7) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text(String(dayTotal), cx + barW / 2, totalY - 3, { align: "center" });
      }

      const dShort = fmtShortDate(row.date);
      if (dShort && (trendSlice.length <= 7 || i % 2 === 0)) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(SUBTLE[0], SUBTLE[1], SUBTLE[2]);
        doc.text(cleanPdfText(dShort), cx + barW / 2, chartBottom + 11, { align: "center" });
      }
    });
  }

  // Minimal inline legend
  doc.setFillColor(ACCENT_SOFT[0], ACCENT_SOFT[1], ACCENT_SOFT[2]);
  doc.rect(chartLeft, y + blockH - 2, 6, 6, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Total calls", chartLeft + 10, y + blockH + 3.5);

  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(chartLeft + 62, y + blockH - 2, 6, 6, "F");
  doc.text("Connected", chartLeft + 72, y + blockH + 3.5);

  // Right: Call Outcomes Tracks
  drawMinimalBar(rightX, y + 20, rightW, "Connected", connectedCalls, totalCalls, true);
  drawMinimalBar(rightX, y + 48, rightW, "Unanswered / busy", unansweredCalls, totalCalls, false);
  drawMinimalBar(rightX, y + 76, rightW, "Dropped early", droppedEarlyCalls, totalCalls, false);
  drawMinimalBar(rightX, y + 104, rightW, "Failed", failedCalls, totalCalls, false);

  y += blockH + 18;
  drawHairline(y);
  y += 18;

  // ── 4. LEAD INTELLIGENCE & QUOTA CAPACITY (TWO-COLUMN SPLIT) ─────────────────
  const halfW = (contentW - splitGap) / 2;
  const col2X = marginX + halfW + splitGap;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(SUBTLE[0], SUBTLE[1], SUBTLE[2]);
  doc.text("LEAD INTEREST & SENTIMENT", marginX, y);
  doc.text("WORKSPACE CAPACITY", col2X, y);

  // Left: Interest & Sentiment compact rows
  drawMinimalBar(marginX, y + 18, halfW, "High interest", highInterest, interestTotal || totalCalls, true);
  drawMinimalBar(marginX, y + 44, halfW, "Medium interest", mediumInterest, interestTotal || totalCalls, false);
  drawMinimalBar(marginX, y + 70, halfW, "Low interest", lowInterest, interestTotal || totalCalls, false);

  const sentSummary = `Sentiment: ${fmtInt(positiveSent)} Positive · ${fmtInt(neutralSent)} Neutral · ${fmtInt(negativeSent)} Negative`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(cleanPdfText(sentSummary), marginX, y + 96);

  // Right: Cycle Credits, Daily Cap & Follow-ups
  const cycleUsedAndReserved = creditsUsedCycle + creditsReserved;
  drawMinimalBar(
    col2X,
    y + 18,
    halfW,
    `Monthly credits (${fmtInt(creditsRemaining)} left)`,
    cycleUsedAndReserved,
    Math.max(1, monthlyAllowance),
    true,
  );
  drawMinimalBar(
    col2X,
    y + 44,
    halfW,
    `Daily calls (${fmtInt(callsRemainingToday)} remaining)`,
    callsMadeToday,
    Math.max(1, maxCallsPerDay),
    false,
  );

  const followUpLine = `Follow-up requests: ${fmtInt(followUpsRequested)}   ·   Open tasks: ${fmtInt(openFollowUps)}`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(cleanPdfText(followUpLine), col2X, y + 72);

  y += 110;
  drawHairline(y);
  y += 18;

  // ── 5. CAMPAIGN PERFORMANCE (ONLY IF CAMPAIGNS EXIST) ────────────────────────
  const campaignsList = Array.isArray(data.campaignPerformance) ? data.campaignPerformance : [];
  if (campaignsList.length > 0) {
    ensureSpace(58);
    drawSectionLabel("Campaign Performance", `${campaignsList.length} active`);

    const cCol = [marginX, marginX + 185, marginX + 255, marginX + 320, marginX + 385, pageW - marginX];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(SUBTLE[0], SUBTLE[1], SUBTLE[2]);
    doc.text("CAMPAIGN", cCol[0], y);
    doc.text("STATUS", cCol[1], y);
    doc.text("CALLS", cCol[2], y, { align: "right" });
    doc.text("CONNECTED", cCol[3], y, { align: "right" });
    doc.text("RATE", cCol[4], y, { align: "right" });
    doc.text("HIGH INTENT", cCol[5], y, { align: "right" });
    y += 6;
    drawHairline(y);
    y += 12;

    campaignsList.forEach((row) => {
      ensureSpace(20);
      const cCalls = num(row, "totalCalls");
      const cConn = num(row, "connectedCalls");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(cleanPdfText(txt(row, "campaignName", "Campaign").slice(0, 30)), cCol[0], y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(cleanPdfText(titleCaseLabel(txt(row, "campaignStatus", "draft"))), cCol[1], y);

      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(fmtInt(cCalls), cCol[2], y, { align: "right" });
      doc.text(fmtInt(cConn), cCol[3], y, { align: "right" });
      doc.text(fmtPct(cConn, cCalls), cCol[4], y, { align: "right" });
      doc.text(fmtInt(num(row, "highInterestCalls")), cCol[5], y, { align: "right" });

      y += 6;
      drawHairline(y);
      y += 12;
    });

    y += 6;
  }

  // ── 6. RECENT CALL LOG (CLEAN HAIRLINE TABLE) ────────────────────────────────
  const recentList = Array.isArray(data.recentCalls) ? data.recentCalls : [];
  if (recentList.length > 0) {
    ensureSpace(56);
    drawSectionLabel(
      "Recent Calls",
      campaignsList.length === 0 ? "No campaign calls in period" : undefined,
    );

    const rCol = {
      when: marginX,
      contact: marginX + 78,
      outcome: marginX + 188,
      dur: marginX + 264,
      summary: marginX + 308,
    };
    const summaryMaxW = pageW - marginX - rCol.summary;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(SUBTLE[0], SUBTLE[1], SUBTLE[2]);
    doc.text("TIME", rCol.when, y);
    doc.text("CONTACT", rCol.contact, y);
    doc.text("OUTCOME", rCol.outcome, y);
    doc.text("DURATION", rCol.dur, y, { align: "right" });
    doc.text("SUMMARY", rCol.summary, y);
    y += 6;
    drawHairline(y);
    y += 12;

    for (const row of recentList.slice(0, 10)) {
      const contactName = cleanPdfText(
        txt(row, "contactName", formatPhoneNumber(txt(row, "phoneNumber", "")) || "Contact"),
      );
      const outcome = cleanPdfText(titleCaseLabel(txt(row, "outcome", "unknown")));
      const sentiment = cleanPdfText(titleCaseLabel(txt(row, "sentiment", "neutral")));
      const dur = fmtDuration(num(row, "durationSeconds"));
      const when = cleanPdfText(fmtDateTimeLabel(row.startedAt));
      const summary = cleanPdfText(txt(row, "summary", "No summary recorded."));

      const wrappedSummary = doc.splitTextToSize(summary, summaryMaxW).slice(0, 3);
      const rowH = Math.max(22, wrappedSummary.length * 10.5 + 8);

      ensureSpace(rowH + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(when, rCol.when, y);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.2);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(contactName.slice(0, 20), rCol.contact, y);

      const isConn = outcome.toLowerCase() === "connected";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const outColor = isConn ? ACCENT : MUTED;
      doc.setTextColor(outColor[0], outColor[1], outColor[2]);
      doc.text(outcome, rCol.outcome, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(SUBTLE[0], SUBTLE[1], SUBTLE[2]);
      doc.text(sentiment, rCol.outcome, y + 10);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(dur, rCol.dur, y, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      wrappedSummary.forEach((line: string, lineIdx: number) => {
        doc.text(line, rCol.summary, y + lineIdx * 10.5);
      });

      y += rowH - 2;
      drawHairline(y);
      y += 11;
    }
  }

  // ── QUIET FOOTER ─────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawHairline(pageH - 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(SUBTLE[0], SUBTLE[1], SUBTLE[2]);
    doc.text("Foolioo AI Voice Operations", marginX, pageH - 18);
    doc.text(`Page ${p} of ${totalPages}`, pageW - marginX, pageH - 18, { align: "right" });
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
