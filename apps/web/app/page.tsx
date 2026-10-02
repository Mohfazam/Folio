"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./page.module.css";

interface Preset {
  id: string;
  name: string;
  businessName: string;
  industry: string;
  personaName: string;
  contactName: string;
  tone: string;
  campaignName: string;
  hook: string;
  talkingPoints: string;
  callToAction: string;
  greetingText: string;
}

const PRESETS: Preset[] = [
  {
    id: "real-estate",
    name: "🏡 Real Estate Luxury",
    businessName: "Apex Luxury Living",
    industry: "real_estate",
    personaName: "Priya",
    contactName: "Mohammed Mustafa",
    tone: "Warm, professional, respectful, and articulate",
    campaignName: "Palm Villa Pre-Launch VIP Outreach",
    hook: "Hi Mohammed, this is Priya calling from Apex Luxury Living. I noticed you recently downloaded the floor plans for our Palm Villa estate in Bangalore.",
    talkingPoints: "4-bedroom standalone villas, Private pool and landscaped gardens, Completion by end of 2026, Exclusive 7% inaugural pricing for first 10 buyers",
    callToAction: "Would you like me to book a complimentary VIP site visit with our senior architect this Saturday morning?",
    greetingText: "Hi Mohammed, this is Priya from Apex Luxury Living. Hope I'm not catching you at a bad time!",
  },
  {
    id: "edtech",
    name: "🎓 EdTech Counseling",
    businessName: "NextGen Tech Institute",
    industry: "education",
    personaName: "Aman",
    contactName: "Mohammed Mustafa",
    tone: "Encouraging, knowledgeable, friendly, and motivating",
    campaignName: "AI & Full Stack Fellowship Counseling",
    hook: "Hey Mohammed! Aman here from NextGen Tech Institute. I saw you took our AI engineering aptitude assessment yesterday.",
    talkingPoints: "Live weekend mentorship from Google & Microsoft engineers, 100% placement track record, Hands-on capstone projects in GenAI, ₹15,000 early bird scholarship expiring in 48 hours",
    callToAction: "Would you be interested in having our admissions director review your portfolio for the scholarship seat?",
    greetingText: "Hey Mohammed! This is Aman from NextGen Tech Institute. How are you doing today?",
  },
  {
    id: "healthcare",
    name: "🩺 Healthcare Dental",
    businessName: "Aura Dental Care",
    industry: "healthcare",
    personaName: "Sneha",
    contactName: "Mohammed Mustafa",
    tone: "Empathetic, caring, clear, and reassuring",
    campaignName: "Bi-Annual Wellness Checkup Reminder",
    hook: "Hello Mohammed, this is Sneha from Aura Dental Care. It's been about six months since your last routine dental checkup and cleaning.",
    talkingPoints: "Comprehensive digital 3D scans included, Pain-free laser hygiene protocols, 20-minute slot with Dr. Sharma, Insurance cashless network available",
    callToAction: "We have an open slot this Thursday at 4 PM or Friday at 11 AM — which works better for you?",
    greetingText: "Hello Mohammed, this is Sneha from Aura Dental Care. I hope you're having a pleasant day.",
  },
];

export default function TestConsole() {
  const [selectedPreset, setSelectedPreset] = useState<string>("real-estate");
  const [phoneNumber, setPhoneNumber] = useState("+916302026353");
  const [contactName, setContactName] = useState(PRESETS[0]!.contactName);
  const [businessName, setBusinessName] = useState(PRESETS[0]!.businessName);
  const [industry, setIndustry] = useState(PRESETS[0]!.industry);
  const [personaName, setPersonaName] = useState(PRESETS[0]!.personaName);
  const [tone, setTone] = useState(PRESETS[0]!.tone);
  const [campaignName, setCampaignName] = useState(PRESETS[0]!.campaignName);
  const [hook, setHook] = useState(PRESETS[0]!.hook);
  const [talkingPoints, setTalkingPoints] = useState(PRESETS[0]!.talkingPoints);
  const [callToAction, setCallToAction] = useState(PRESETS[0]!.callToAction);
  const [greetingText, setGreetingText] = useState(PRESETS[0]!.greetingText);
  const [recordCall, setRecordCall] = useState(true);

  // Connection & Endpoints
  const [callingEngineUrl, setCallingEngineUrl] = useState(
    process.env.NEXT_PUBLIC_CALLING_SERVICE_URL || "https://folio-calling-production.up.railway.app"
  );
  const [webhookUrl, setWebhookUrl] = useState(
    process.env.NEXT_PUBLIC_WEBHOOK_URL || "https://shavonda-perkier-ruminantly.ngrok-free.dev/api/webhooks/calls"
  );

  // Live status
  const [isEngineOnline, setIsEngineOnline] = useState<boolean | null>(null);
  const [engineLatency, setEngineLatency] = useState<number | null>(null);
  const [activeCalls, setActiveCalls] = useState<any[]>([]);

  // Dialing state
  const [isDialing, setIsDialing] = useState(false);
  const [dialFeedback, setDialFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Ingested calls feed
  const [calls, setCalls] = useState<any[]>([]);
  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, boolean>>({});
  const [expandedJson, setExpandedJson] = useState<Record<string, boolean>>({});

  // Apply Preset
  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const p = PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    setBusinessName(p.businessName);
    setIndustry(p.industry);
    setPersonaName(p.personaName);
    setContactName(p.contactName);
    setTone(p.tone);
    setCampaignName(p.campaignName);
    setHook(p.hook);
    setTalkingPoints(p.talkingPoints);
    setCallToAction(p.callToAction);
    setGreetingText(p.greetingText);
  };

  // Poll Engine Health & Active Calls
  const checkEngineHealth = useCallback(async () => {
    try {
      const res = await fetch(`/api/engine-status?engineUrl=${encodeURIComponent(callingEngineUrl)}`);
      const data = await res.json();
      setIsEngineOnline(data.ok);
      setEngineLatency(data.latencyMs);
      setActiveCalls(data.activeCalls || []);
    } catch {
      setIsEngineOnline(false);
      setEngineLatency(null);
      setActiveCalls([]);
    }
  }, [callingEngineUrl]);

  // Fetch Received Calls from Local Spool / Webhook Store
  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch("/api/calls");
      const data = await res.json();
      if (data.ok && Array.isArray(data.calls)) {
        setCalls(data.calls);
      }
    } catch (err) {
      console.error("Failed to load calls:", err);
    }
  }, []);

  useEffect(() => {
    checkEngineHealth();
    fetchCalls();

    const healthInterval = setInterval(checkEngineHealth, 4000);
    const callsInterval = setInterval(fetchCalls, 2500);

    return () => {
      clearInterval(healthInterval);
      clearInterval(callsInterval);
    };
  }, [checkEngineHealth, fetchCalls]);

  // Trigger Call
  const handleInitiateCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;

    setIsDialing(true);
    setDialFeedback(null);

    const payload = {
      phoneNumber,
      callingServiceUrl: callingEngineUrl,
      callbackUrl: webhookUrl,
      recordCall,
      greetingText,
      instructions: `Tone: ${tone}. When the customer answers, initiate the conversation smoothly according to the campaign objective.`,
      context: {
        business: {
          name: businessName,
          industry,
          aiPersonaName: personaName,
          toneOfVoice: tone,
        },
        campaign: {
          name: campaignName,
          openingHook: hook,
          keyTalkingPoints: talkingPoints
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean),
          callToAction,
        },
        contact: {
          name: contactName,
          phone: phoneNumber,
        },
      },
    };

    try {
      const res = await fetch("/api/dial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setDialFeedback({
          ok: true,
          msg: `🚀 Call dispatched to ${phoneNumber}! Plivo ID: ${data.plivoCallId ?? "queued"}`,
        });
        // Immediate refresh
        setTimeout(checkEngineHealth, 1000);
      } else {
        setDialFeedback({
          ok: false,
          msg: `Failed to dial: ${data.error || "Unknown error"}`,
        });
      }
    } catch (err: any) {
      setDialFeedback({
        ok: false,
        msg: `Dial error: ${err?.message || "Network issue"}`,
      });
    } finally {
      setIsDialing(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to clear call history?")) return;
    try {
      await fetch("/api/calls", { method: "DELETE" });
      setCalls([]);
    } catch (err) {
      console.error("Failed to clear history:", err);
    }
  };

  const toggleTranscript = (id: string) => {
    setExpandedTranscripts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleJson = (id: string) => {
    setExpandedJson((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Stats calculation
  const totalCallsCount = calls.length;
  const completedCallsCount = calls.filter((c) => c.payload?.status === "completed").length;
  const highInterestCount = calls.filter((c) => c.payload?.analysis?.interestLevel === "high").length;
  const avgDuration =
    totalCallsCount > 0
      ? Math.round(
          calls.reduce((sum, c) => sum + (c.payload?.durationSeconds || 0), 0) / totalCallsCount
        )
      : 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logoIcon}>🎙️</div>
          <div>
            <h1 className={styles.brandTitle}>Folio Voice Engine • Test Console</h1>
            <p className={styles.brandSubtitle}>
              Live Outbound AI Voice Pipeline & Webhook Ingestion Harness
            </p>
          </div>
        </div>

        <div className={styles.statusGroup}>
          <div
            className={`${styles.statusBadge} ${isEngineOnline === false ? styles.offline : ""}`}
          >
            <span
              className={`pulse-dot ${
                isEngineOnline === null ? "warning" : isEngineOnline ? "" : "danger"
              }`}
            />
            {isEngineOnline === null
              ? "Connecting..."
              : isEngineOnline
              ? "Calling Engine Online"
              : "Engine Offline"}
            {engineLatency !== null && <span className={styles.pingTag}>{engineLatency}ms</span>}
          </div>
        </div>
      </header>

      {/* Stats Summary Bar */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Webhooks Ingested</div>
          <div className={styles.statValue}>
            {totalCallsCount}
            <span className={styles.statSub}>calls</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completed Calls</div>
          <div className={styles.statValue} style={{ color: "var(--success)" }}>
            {completedCallsCount}
            <span className={styles.statSub}>
              {totalCallsCount > 0
                ? `${Math.round((completedCallsCount / totalCallsCount) * 100)}%`
                : "0%"}
            </span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>High Interest Leads</div>
          <div className={styles.statValue} style={{ color: "#a855f7" }}>
            {highInterestCount}
            <span className={styles.statSub}>converted</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Avg Call Duration</div>
          <div className={styles.statValue}>
            {avgDuration}
            <span className={styles.statSub}>seconds</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left = Dial Form, Right = Webhook Results Feed */}
      <div className={styles.mainGrid}>
        {/* Left Column: Dial Controller */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <span>⚡</span> Outbound Dial Controller
            </div>
            <span className={styles.tagLabel}>API: /dial</span>
          </div>

          <form onSubmit={handleInitiateCall}>
            {/* Quick Presets */}
            <div className={styles.formSection}>
              <div className={styles.sectionLabel}>Quick Test Presets</div>
              <div className={styles.presetsRow}>
                {PRESETS.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className={`${styles.presetBtn} ${selectedPreset === p.id ? styles.active : ""}`}
                    onClick={() => handleSelectPreset(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Destination */}
            <div className={styles.formSection}>
              <div className={styles.sectionLabel}>Recipient Details</div>
              <div className={styles.inputRow}>
                <div>
                  <label className={styles.label}>Phone Number (E.164)</label>
                  <input
                    type="tel"
                    className={styles.input}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+91XXXXXXXXXX"
                    required
                  />
                </div>
                <div>
                  <label className={styles.label}>Contact Name</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Full name"
                  />
                </div>
              </div>
            </div>

            {/* Business Context */}
            <div className={styles.formSection}>
              <div className={styles.sectionLabel}>Business & AI Persona</div>
              <div className={styles.inputRow}>
                <div>
                  <label className={styles.label}>Business Name</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
                <div>
                  <label className={styles.label}>AI Voice Persona</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={personaName}
                    onChange={(e) => setPersonaName(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Tone of Voice</label>
                <input
                  type="text"
                  className={styles.input}
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                />
              </div>
            </div>

            {/* Campaign Context */}
            <div className={styles.formSection}>
              <div className={styles.sectionLabel}>Campaign & Messaging</div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Campaign Name</label>
                <input
                  type="text"
                  className={styles.input}
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Opening Hook</label>
                <textarea
                  className={styles.textarea}
                  value={hook}
                  onChange={(e) => setHook(e.target.value)}
                  rows={2}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Key Talking Points</label>
                <textarea
                  className={styles.textarea}
                  value={talkingPoints}
                  onChange={(e) => setTalkingPoints(e.target.value)}
                  rows={3}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Call To Action (CTA)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={callToAction}
                  onChange={(e) => setCallToAction(e.target.value)}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Custom Audio Greeting</label>
                <input
                  type="text"
                  className={styles.input}
                  value={greetingText}
                  onChange={(e) => setGreetingText(e.target.value)}
                />
              </div>
            </div>

            {/* Options */}
            <div className={styles.checkboxRow} onClick={() => setRecordCall(!recordCall)}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={recordCall}
                onChange={(e) => setRecordCall(e.target.checked)}
              />
              <span className={styles.checkboxLabel}>Record call audio with Plivo</span>
            </div>

            {/* Advanced URL Overrides */}
            <details style={{ marginBottom: "16px", cursor: "pointer" }}>
              <summary className={styles.label} style={{ color: "var(--accent-primary)" }}>
                ⚙️ Advanced Network Endpoints
              </summary>
              <div style={{ marginTop: "10px" }}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Calling Engine URL</label>
                  <input
                    type="url"
                    className={styles.input}
                    value={callingEngineUrl}
                    onChange={(e) => setCallingEngineUrl(e.target.value)}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Webhook Callback URL</label>
                  <input
                    type="url"
                    className={styles.input}
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                </div>
              </div>
            </details>

            {/* Dial Button */}
            <button
              type="submit"
              className={styles.dialBtn}
              disabled={isDialing || isEngineOnline === false}
            >
              {isDialing ? (
                <>
                  <span className="spinner" /> Dialing {phoneNumber}...
                </>
              ) : (
                <>
                  <span>📞</span> Initiate Outbound Test Call
                </>
              )}
            </button>

            {/* Feedback message */}
            {dialFeedback && (
              <div
                style={{
                  marginTop: "14px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  background: dialFeedback.ok ? "var(--success-bg)" : "var(--danger-bg)",
                  color: dialFeedback.ok ? "var(--success)" : "var(--danger)",
                  border: `1px solid ${
                    dialFeedback.ok ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.3)"
                  }`,
                }}
              >
                {dialFeedback.msg}
              </div>
            )}
          </form>
        </div>

        {/* Right Column: Webhook Results & Live Telemetry Feed */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <span>📡</span> Webhook Ingestion & Analytics Feed
            </div>
            <div className={styles.panelActions}>
              <button type="button" className={styles.btnSecondary} onClick={fetchCalls}>
                🔄 Refresh
              </button>
              {calls.length > 0 && (
                <button type="button" className={styles.btnSecondary} onClick={handleClearHistory}>
                  🗑️ Clear
                </button>
              )}
            </div>
          </div>

          {/* Active Call Alert Banner */}
          {activeCalls.length > 0 && (
            <div className={styles.activeCallAlert}>
              <div className={styles.activeCallInfo}>
                <span className="pulse-dot warning" />
                <div>
                  <div className={styles.activeCallText}>
                    Active Call in Progress ({activeCalls.length})
                  </div>
                  <div className={styles.activeCallSub}>
                    {activeCalls.map((c) => `${c.phoneNumber} • ${c.phase || "active"}`).join(", ")}
                  </div>
                </div>
              </div>
              <span className="spinner" />
            </div>
          )}

          {/* Empty State */}
          {calls.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📬</div>
              <div className={styles.emptyTitle}>No Webhook Payloads Received Yet</div>
              <p className={styles.emptySubtitle}>
                Initiate a test call on the left. When the call ends, the calling engine will post the
                complete CallResult payload to this app&apos;s webhook endpoint.
              </p>
            </div>
          ) : (
            <div className={styles.feedList}>
              {calls.map((record) => {
                const call = record.payload || {};
                const analysis = call.analysis;
                const transcript = call.transcript || [];
                const timings = call.timings || {};
                const id = record.id;
                const isTranscriptOpen = !!expandedTranscripts[id];
                const isJsonOpen = !!expandedJson[id];

                const interestBadge =
                  analysis?.interestLevel === "high"
                    ? styles.badgeSuccess
                    : analysis?.interestLevel === "medium"
                    ? styles.badgeWarning
                    : styles.badgeInfo;

                const statusBadge =
                  call.status === "completed"
                    ? styles.badgeSuccess
                    : call.status === "failed"
                    ? styles.badgeDanger
                    : styles.badgeWarning;

                return (
                  <div key={id} className={styles.callCard}>
                    {/* Header */}
                    <div className={styles.callCardHeader}>
                      <div className={styles.callMeta}>
                        <div className={styles.callTitle}>
                          <span>📞</span> {call.contactId || "Test Call"}
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            ({call.plivoCallId ? `${call.plivoCallId.slice(0, 8)}...` : id})
                          </span>
                        </div>
                        <div className={styles.callTime}>
                          Received: {new Date(record.receivedAt).toLocaleTimeString()} • Duration:{" "}
                          <strong>{call.durationSeconds ?? 0}s</strong> • Turns:{" "}
                          <strong>{transcript.length}</strong>
                        </div>
                      </div>

                      <div className={styles.badgesGroup}>
                        <span className={`${styles.badge} ${statusBadge}`}>
                          {call.status || "UNKNOWN"}
                        </span>
                        {analysis?.interestLevel && (
                          <span className={`${styles.badge} ${interestBadge}`}>
                            {analysis.interestLevel} Interest
                          </span>
                        )}
                        {analysis?.sentiment && (
                          <span className={`${styles.badge} ${styles.badgeInfo}`}>
                            {analysis.sentiment}
                          </span>
                        )}
                        {analysis?.followUpRequested && (
                          <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                            Follow-Up Req
                          </span>
                        )}
                      </div>
                    </div>

                    {/* AI Executive Summary */}
                    {analysis?.summary && (
                      <div className={styles.summaryBox}>
                        <div className={styles.summaryLabel}>AI Post-Call Summary</div>
                        <div className={styles.summaryText}>{analysis.summary}</div>
                      </div>
                    )}

                    {/* Objections */}
                    {analysis?.objectionsRaised && analysis.objectionsRaised.length > 0 && (
                      <div className={styles.objectionsRow}>
                        <span className={styles.tagLabel}>Objections:</span>
                        {analysis.objectionsRaised.map((obj: string, i: number) => (
                          <span key={i} className={styles.objectionTag}>
                            {obj}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Latency & Timings */}
                    <div className={styles.metricsGrid}>
                      <div className={styles.metricItem}>
                        <span className={styles.metricLabel}>1st Sentence</span>
                        <span className={styles.metricValue}>
                          {timings.avgFirstSentenceMs ? `${timings.avgFirstSentenceMs}ms` : "—"}
                        </span>
                      </div>
                      <div className={styles.metricItem}>
                        <span className={styles.metricLabel}>1st Audio (TTS)</span>
                        <span className={styles.metricValue}>
                          {timings.avgFirstAudioMs ? `${timings.avgFirstAudioMs}ms` : "—"}
                        </span>
                      </div>
                      <div className={styles.metricItem}>
                        <span className={styles.metricLabel}>STT Connect</span>
                        <span className={styles.metricValue}>
                          {timings.sttConnectMs ? `${timings.sttConnectMs}ms` : "—"}
                        </span>
                      </div>
                      <div className={styles.metricItem}>
                        <span className={styles.metricLabel}>Audio Playback</span>
                        <span className={styles.metricValue}>
                          {call.recording?.available ? "Recorded 🎧" : "Live stream"}
                        </span>
                      </div>
                    </div>

                    {/* Transcript Dialogue Accordion */}
                    <div className={styles.transcriptContainer}>
                      <button
                        type="button"
                        className={styles.transcriptToggle}
                        onClick={() => toggleTranscript(id)}
                      >
                        {isTranscriptOpen ? "▼ Hide Transcript" : "▶ View Full Dialogue Transcript"} (
                        {transcript.length} turns)
                      </button>

                      {isTranscriptOpen && (
                        <div className={styles.dialogueBox}>
                          {transcript.length === 0 ? (
                            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                              No dialogue recorded.
                            </div>
                          ) : (
                            transcript.map((turn: any, idx: number) => (
                              <div
                                key={idx}
                                className={`${styles.bubble} ${
                                  turn.speaker === "assistant"
                                    ? styles.bubbleAI
                                    : styles.bubbleUser
                                }`}
                              >
                                <div className={styles.bubbleHeader}>
                                  <span>
                                    {turn.speaker === "assistant"
                                      ? `🤖 AI (${personaName || "Assistant"})`
                                      : "👤 Customer"}
                                  </span>
                                  {turn.timestamp && (
                                    <span>
                                      {new Date(turn.timestamp).toLocaleTimeString()}
                                    </span>
                                  )}
                                </div>
                                <div>{turn.text}</div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* JSON Inspector Accordion */}
                    <div style={{ marginTop: "10px" }}>
                      <button
                        type="button"
                        className={styles.transcriptToggle}
                        style={{ color: "var(--text-muted)", fontSize: "11px" }}
                        onClick={() => toggleJson(id)}
                      >
                        {isJsonOpen ? "▼ Hide Raw JSON" : "▶ Inspect Full Webhook Payload (JSON)"}
                      </button>

                      {isJsonOpen && (
                        <pre className={styles.jsonViewer}>
                          {JSON.stringify(call, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
