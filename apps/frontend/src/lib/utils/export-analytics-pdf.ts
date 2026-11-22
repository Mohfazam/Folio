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

// Sanitize text to WinAnsi / ASCII safe characters so standard PDF Type1 Helvetica renders cleanly
function toPdfText(input: string): string {
  const normalized = input
    .replaceAll("•", "-")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("…", "...")
    .replaceAll("₹", "INR ")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("’", "'")
    .replaceAll("‘", "'");

  let ascii = "";
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    ascii += code >= 32 && code <= 126 ? normalized[i] : " ";
  }
  return ascii.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function wrapLines(text: string, maxChars: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [""];
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Builds a real binary PDF (%PDF-1.4) document with multi-page layout,
 * plain-language takeaways, KPIs, breakdowns, campaign table, daily trend, and recent calls.
 */
export function buildAnalyticsPdfBytes(timeframe: string, data: AnalyticsData): Uint8Array {
  const PAGE_W = 595.28; // A4 width in pt
  const PAGE_H = 841.89; // A4 height in pt
  const MARGIN_X = 42;
  const TOP_Y = PAGE_H - 46;
  const BOTTOM_Y = 48;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

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

  const workspaceName = txt(client, "name", "Foolioo Workspace");
  const planTier = txt(client, "planTier", "Standard").toUpperCase();
  const workspaceStatus = txt(client, "status", "active").toUpperCase();
  const periodLabel = timeframeTitle(timeframe);
  const generatedAt = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  const connectionRate = fmtPct(connectedCalls, totalCalls);
  const highIntentShare = fmtPct(highInterest, interestTotal || connectedCalls);

  const takeaways: string[] = [];
  if (totalCalls === 0) {
    takeaways.push("No calls were recorded during this selected reporting window.");
  } else {
    takeaways.push(
      `${fmtInt(connectedCalls)} out of ${fmtInt(totalCalls)} calls connected (${connectionRate} answer rate) with ${fmtDuration(avgDuration)} average connected call length.`,
    );
    if (highInterest > 0) {
      takeaways.push(
        `${fmtInt(highInterest)} callers (${highIntentShare}) showed high interest, and ${fmtInt(followUpsRequested)} requested follow-ups.`,
      );
    }
    if (unansweredCalls > connectedCalls) {
      takeaways.push(
        `${fmtInt(unansweredCalls)} calls went unanswered or busy - consider reviewing calling hours or retry windows.`,
      );
    }
  }
  if (monthlyAllowance > 0) {
    takeaways.push(
      `${fmtInt(creditsRemaining)} of ${fmtInt(monthlyAllowance)} monthly credits remain (${fmtInt(callsRemainingToday)} of ${fmtInt(maxCallsPerDay)} daily calls left today).`,
    );
  }

  const pages: string[][] = [];
  let ops: string[] = [];
  let y = TOP_Y;

  const startNewPage = () => {
    if (ops.length > 0) {
      pages.push(ops);
    }
    ops = [];
    y = TOP_Y;
    // Page header bar
    ops.push("0.39 0.29 0.73 rg");
    ops.push(`BT /F2 8.5 Tf ${MARGIN_X} ${y} Td (${toPdfText("FOOLIOO ANALYTICS REPORT")} - ${toPdfText(workspaceName)} - ${toPdfText(periodLabel)}) Tj ET`);
    y -= 10;
    ops.push("0.88 0.87 0.83 RG 0.75 w");
    ops.push(`${MARGIN_X} ${y} m ${MARGIN_X + CONTENT_W} ${y} l S`);
    y -= 18;
  };

  const ensureSpace = (neededHeight: number) => {
    if (y - neededHeight < BOTTOM_Y) {
      startNewPage();
    }
  };

  const drawSectionTitle = (title: string, subtitle?: string) => {
    ensureSpace(subtitle ? 38 : 26);
    ops.push("0.11 0.11 0.09 rg");
    ops.push(`BT /F2 12.5 Tf ${MARGIN_X} ${y} Td (${toPdfText(title)}) Tj ET`);
    y -= 14;
    if (subtitle) {
      ops.push("0.45 0.47 0.47 rg");
      ops.push(`BT /F1 9 Tf ${MARGIN_X} ${y} Td (${toPdfText(subtitle)}) Tj ET`);
      y -= 14;
    }
  };

  const drawBarRow = (label: string, count: number, denom: number, rgb: [number, number, number]) => {
    ensureSpace(22);
    const pctText = `${fmtInt(count)} (${fmtPct(count, denom)})`;
    ops.push("0.20 0.21 0.18 rg");
    ops.push(`BT /F1 9.5 Tf ${MARGIN_X} ${y} Td (${toPdfText(label)}) Tj ET`);
    ops.push(`BT /F2 9.5 Tf ${MARGIN_X + CONTENT_W - 95} ${y} Td (${toPdfText(pctText)}) Tj ET`);
    y -= 5;

    const barW = CONTENT_W;
    const barH = 5.5;
    ops.push("0.94 0.94 0.91 rg");
    ops.push(`${MARGIN_X} ${y - barH} ${barW.toFixed(1)} ${barH} re f`);

    const fillRatio = denom > 0 ? Math.min(1, Math.max(0, count / denom)) : 0;
    const fillW = barW * fillRatio;
    if (fillW > 0) {
      ops.push(`${rgb[0]} ${rgb[1]} ${rgb[2]} rg`);
      ops.push(`${MARGIN_X} ${y - barH} ${fillW.toFixed(1)} ${barH} re f`);
    }
    y -= 16;
  };

  const drawKeyValueTable = (rows: Array<[string, string]>) => {
    for (const [k, v] of rows) {
      ensureSpace(17);
      ops.push("0.32 0.33 0.30 rg");
      ops.push(`BT /F1 9.5 Tf ${MARGIN_X} ${y} Td (${toPdfText(k)}) Tj ET`);
      ops.push("0.11 0.11 0.09 rg");
      ops.push(`BT /F2 9.5 Tf ${MARGIN_X + CONTENT_W - 140} ${y} Td (${toPdfText(v)}) Tj ET`);
      y -= 4;
      ops.push("0.95 0.95 0.92 RG 0.5 w");
      ops.push(`${MARGIN_X} ${y} m ${MARGIN_X + CONTENT_W} ${y} l S`);
      y -= 12;
    }
  };

  // Start Page 1 with Title Block
  ops.push("0.39 0.29 0.73 rg");
  ops.push(`BT /F2 9 Tf ${MARGIN_X} ${y} Td (FOOLIOO VOICE OPERATIONS - DETAILED ANALYTICS REPORT) Tj ET`);
  y -= 20;
  ops.push("0.11 0.11 0.09 rg");
  ops.push(`BT /F2 20 Tf ${MARGIN_X} ${y} Td (${toPdfText(workspaceName)}) Tj ET`);
  y -= 15;
  ops.push("0.45 0.47 0.47 rg");
  ops.push(`BT /F1 9.5 Tf ${MARGIN_X} ${y} Td (Period: ${toPdfText(periodLabel)}  |  Plan: ${toPdfText(planTier)} (${toPdfText(workspaceStatus)})  |  Generated: ${toPdfText(generatedAt)}) Tj ET`);
  y -= 12;
  ops.push("0.11 0.11 0.09 RG 1.2 w");
  ops.push(`${MARGIN_X} ${y} m ${MARGIN_X + CONTENT_W} ${y} l S`);
  y -= 18;

  // Plain-Language Takeaways Box
  drawSectionTitle("Executive Takeaways", "Plain-language summary of performance, caller intent, and workspace capacity.");
  for (const item of takeaways) {
    const wrapped = wrapLines(`- ${item}`, 92);
    for (const line of wrapped) {
      ensureSpace(14);
      ops.push("0.16 0.16 0.14 rg");
      ops.push(`BT /F1 9.5 Tf ${MARGIN_X + 6} ${y} Td (${toPdfText(line)}) Tj ET`);
      y -= 13;
    }
  }
  y -= 8;

  // Key Metrics Summary
  drawSectionTitle("Key Performance Metrics");
  drawKeyValueTable([
    ["Total calls attempted", `${fmtInt(totalCalls)} (${fmtInt(pendingInQueue)} waiting in queue)`],
    ["Connection rate", `${connectionRate} (${fmtInt(connectedCalls)} connected calls)`],
    ["Average connected call duration", `${fmtDuration(avgDuration)} (${fmtDuration(totalDuration)} total talk time)`],
    ["Credits consumed / remaining", `${fmtInt(creditsCharged)} used / ${fmtInt(creditsRemaining)} available`],
  ]);
  y -= 8;

  // Call Outcomes
  drawSectionTitle("Call Outcomes Breakdown", "How calls ended during the selected date range.");
  drawBarRow("Connected", connectedCalls, totalCalls, [0.30, 0.58, 0.41]);
  drawBarRow("Unanswered or busy", unansweredCalls, totalCalls, [0.84, 0.65, 0.29]);
  drawBarRow("Dropped early", droppedEarlyCalls, totalCalls, [0.55, 0.55, 0.53]);
  drawBarRow("Failed", failedCalls, totalCalls, [0.78, 0.42, 0.36]);
  y -= 6;

  // Lead Intelligence & Sentiment
  drawSectionTitle("Lead Intelligence & Caller Sentiment", "Interest levels and sentiment captured from completed calls.");
  drawBarRow("High interest", highInterest, interestTotal || totalCalls, [0.30, 0.58, 0.41]);
  drawBarRow("Medium interest", mediumInterest, interestTotal || totalCalls, [0.84, 0.65, 0.29]);
  drawBarRow("Low interest", lowInterest, interestTotal || totalCalls, [0.55, 0.55, 0.53]);
  drawBarRow("Positive sentiment", positiveSent, totalCalls, [0.39, 0.29, 0.73]);
  drawBarRow("Neutral sentiment", neutralSent, totalCalls, [0.61, 0.62, 0.59]);
  drawBarRow("Negative sentiment", negativeSent, totalCalls, [0.78, 0.42, 0.36]);
  drawKeyValueTable([
    ["Follow-up requests in period", fmtInt(followUpsRequested)],
    ["Open follow-up tasks", fmtInt(openFollowUps)],
  ]);
  y -= 6;

  // Quota & Capacity
  drawSectionTitle("Quota, Credits & Daily Capacity");
  const quotaRows: Array<[string, string]> = [
    ["Monthly credits allowance", `${fmtInt(monthlyAllowance)} credits`],
    ["Credits used this billing cycle", `${fmtInt(creditsUsedCycle)} credits`],
    ["Credits reserved in active queue", `${fmtInt(creditsReserved)} credits`],
    ["Credits remaining", `${fmtInt(creditsRemaining)} credits`],
    ["Calls made today / daily limit", `${fmtInt(callsMadeToday)} / ${fmtInt(maxCallsPerDay)} (${fmtInt(callsRemainingToday)} left)`],
    ["Calls currently in progress", fmtInt(inProgress)],
  ];
  if (typeof quota.nextBillingResetAt === "string" && quota.nextBillingResetAt) {
    quotaRows.push(["Next billing cycle reset", fmtDateLabel(quota.nextBillingResetAt)]);
  }
  drawKeyValueTable(quotaRows);
  y -= 6;

  // Campaign Performance
  const campaignRows = Array.isArray(data.campaignPerformance) ? data.campaignPerformance : [];
  drawSectionTitle("Campaign Performance", "Call volume, pickup rate, and high-intent leads by campaign.");
  if (campaignRows.length === 0) {
    ensureSpace(18);
    ops.push("0.45 0.47 0.47 rg");
    ops.push(`BT /F1 9.5 Tf ${MARGIN_X} ${y} Td (No campaign call activity recorded in this period.) Tj ET`);
    y -= 18;
  } else {
    for (const row of campaignRows) {
      const cName = txt(row, "campaignName", "Campaign");
      const cStatus = txt(row, "campaignStatus", "draft");
      const cTotal = num(row, "totalCalls");
      const cConn = num(row, "connectedCalls");
      const cHigh = num(row, "highInterestCalls");
      const cDur = num(row, "totalDurationSeconds");
      drawKeyValueTable([
        [
          `${cName} (${cStatus})`,
          `${fmtInt(cTotal)} calls | ${fmtInt(cConn)} conn (${fmtPct(cConn, cTotal)}) | ${fmtInt(cHigh)} high intent | ${fmtDuration(cDur)}`,
        ],
      ]);
    }
  }
  y -= 6;

  // Daily Trend
  const dailyTrend = Array.isArray(data.dailyTrend) ? data.dailyTrend : [];
  if (dailyTrend.length > 0) {
    drawSectionTitle("Daily Call Activity", "Day-by-day call attempts, connected calls, and failures.");
    for (const row of dailyTrend) {
      const dLabel = fmtDateLabel(row.date);
      const dTotal = num(row, "totalCalls");
      const dConn = num(row, "connectedCalls");
      const dFail = num(row, "failedCalls");
      drawKeyValueTable([
        [
          dLabel,
          `${fmtInt(dTotal)} total | ${fmtInt(dConn)} connected (${fmtPct(dConn, dTotal)}) | ${fmtInt(dFail)} failed`,
        ],
      ]);
    }
    y -= 6;
  }

  // Recent Calls
  const recentCalls = Array.isArray(data.recentCalls) ? data.recentCalls : [];
  if (recentCalls.length > 0) {
    drawSectionTitle("Recent Call Highlights", "Latest calls, outcomes, caller intent, and summaries.");
    for (const row of recentCalls) {
      const contact = txt(row, "contactName", txt(row, "phoneNumber", "Contact"));
      const when = fmtDateTimeLabel(row.startedAt);
      const outcome = txt(row, "outcome", "unknown").replaceAll("_", " ");
      const interest = txt(row, "interestLevel", "unknown");
      const sentiment = txt(row, "sentiment", "neutral");
      const dur = fmtDuration(num(row, "durationSeconds"));
      const summary = txt(row, "summary", "No summary recorded.");
      const lines = wrapLines(
        `${contact} (${when}) - ${outcome}, ${interest} interest, ${sentiment} sentiment, ${dur}. Summary: ${summary}`,
        94,
      );
      for (const line of lines) {
        ensureSpace(14);
        ops.push("0.20 0.21 0.18 rg");
        ops.push(`BT /F1 9 Tf ${MARGIN_X} ${y} Td (${toPdfText(line)}) Tj ET`);
        y -= 13;
      }
      y -= 4;
    }
  }

  pages.push(ops);

  // Assemble valid PDF 1.4 binary document with cross-reference table
  // Objects:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica)
  // 4: Font F2 (Helvetica-Bold)
  // For each page i: Page object (5 + i*2) and Content stream object (6 + i*2)
  const totalPages = pages.length;
  const pageObjIds: number[] = [];
  const pdfObjects: Array<{ id: number; body: string }> = [];

  for (let i = 0; i < totalPages; i++) {
    const pageObjId = 5 + i * 2;
    const contentObjId = 6 + i * 2;
    pageObjIds.push(pageObjId);

    const footerLine = `Page ${i + 1} of ${totalPages}  -  Foolioo Analytics`;
    const pageContentOps = [
      ...pages[i],
      "0.48 0.49 0.47 rg",
      `BT /F1 8.5 Tf ${MARGIN_X} 28 Td (${toPdfText(footerLine)}) Tj ET`,
    ];
    const streamData = pageContentOps.join("\n");
    const streamByteLen = new TextEncoder().encode(streamData).length;

    pdfObjects.push({
      id: pageObjId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId} 0 R >>`,
    });

    pdfObjects.push({
      id: contentObjId,
      body: `<< /Length ${streamByteLen} >>\nstream\n${streamData}\nendstream`,
    });
  }

  const catalogObj = { id: 1, body: `<< /Type /Catalog /Pages 2 0 R >>` };
  const pagesObj = {
    id: 2,
    body: `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${totalPages} >>`,
  };
  const font1Obj = {
    id: 3,
    body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
  };
  const font2Obj = {
    id: 4,
    body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`,
  };

  const allObjects = [catalogObj, pagesObj, font1Obj, font2Obj, ...pdfObjects].sort(
    (a, b) => a.id - b.id,
  );

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteOffset = 0;

  const pushStr = (s: string) => {
    const encoded = encoder.encode(s);
    chunks.push(encoded);
    byteOffset += encoded.length;
  };

  pushStr("%PDF-1.4\n");

  for (const obj of allObjects) {
    offsets[obj.id] = byteOffset;
    pushStr(`${obj.id} 0 obj\n${obj.body}\nendobj\n`);
  }

  const xrefOffset = byteOffset;
  const maxObjId = allObjects[allObjects.length - 1]?.id ?? 4;
  pushStr(`xref\n0 ${maxObjId + 1}\n`);
  pushStr("0000000000 65535 f \n");
  for (let id = 1; id <= maxObjId; id++) {
    const off = String(offsets[id] ?? 0).padStart(10, "0");
    pushStr(`${off} 00000 n \n`);
  }

  pushStr(`trailer\n<< /Size ${maxObjId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const totalLen = chunks.reduce((sum, arr) => sum + arr.length, 0);
  const output = new Uint8Array(totalLen);
  let pos = 0;
  for (const arr of chunks) {
    output.set(arr, pos);
    pos += arr.length;
  }
  return output;
}

/**
 * Triggers a direct client-side `.pdf` file download in the browser.
 */
export function exportAnalyticsToPdf(timeframe: string, data: AnalyticsData): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const pdfBytes = buildAnalyticsPdfBytes(timeframe, data);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeSlug = timeframe.replace(/[^a-z0-9_-]/gi, "-") || "30d";
    link.href = url;
    link.download = `foolioo-analytics-${safeSlug}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (error) {
    console.error("[analytics/export-pdf] Failed to generate PDF:", error);
    return false;
  }
}
