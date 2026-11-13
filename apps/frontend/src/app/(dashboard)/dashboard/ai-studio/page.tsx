import { connection } from "next/server";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AiStudioDashboard } from "@/components/dashboard/ai-studio-dashboard";

type RecordValue = Record<string, unknown>;
function isRecord(value: unknown): value is RecordValue { return typeof value === "object" && value !== null && !Array.isArray(value); }
async function load(path: string, token: string) {
  const base = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, "");
  if (!base) throw new Error("BACKEND_API_URL is not configured on the server.");
  const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(payload) || payload.ok === false) throw new Error(isRecord(payload) && typeof payload.error === "string" ? payload.error : `Request failed (${response.status}).`);
  return payload;
}
async function AiStudioContent() {
  await connection();
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return <div className="rounded-lg border border-[#ECEBE5] bg-white p-6 text-sm">Your session has expired. Sign in again.</div>;
  let entries: RecordValue[] = [];
  let agent: RecordValue = {};
  let profile: RecordValue = {};
  let voices: Array<{id:string;label:string;language?:string}> = [];
  let languages: Array<{code:string;label:string}> = [{code:"en-IN",label:"English (India)"}];
  let error: string | null = null;
  const results = await Promise.allSettled([
    load("/api/knowledge-base?limit=100&offset=0", session.access_token),
    load("/api/agent-settings", session.access_token),
  ]);
  if (results[0].status === "fulfilled") {
    const payload = results[0].value;
    entries = Array.isArray(payload.entries) ? payload.entries.filter(isRecord) : [];
  } else error = results[0].reason instanceof Error ? results[0].reason.message : "Unable to load knowledge base.";
  if (results[1].status === "fulfilled") {
    const payload = results[1].value;
    agent = isRecord(payload.agentSettings) ? payload.agentSettings : {};
    profile = isRecord(payload.businessProfile) ? payload.businessProfile : {};
    voices = Array.isArray(payload.availableVoices) ? payload.availableVoices.filter(isRecord).filter((v): v is RecordValue & {id:string;label:string} => typeof v.id === "string" && typeof v.label === "string") : [];
    languages = Array.isArray(payload.availableLanguages) ? payload.availableLanguages.filter(isRecord).filter((v): v is RecordValue & {code:string;label:string} => typeof v.code === "string" && typeof v.label === "string") : languages;
  } else error = error ?? (results[1].reason instanceof Error ? results[1].reason.message : "Unable to load agent settings.");
  return <AiStudioDashboard entries={entries as never} agent={agent} profile={profile} voices={voices} languages={languages} error={error} />;
}


export default function AiStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-[#ECEBE5] bg-white p-6 text-sm text-[#747878]">
          Loading AI Studio…
        </div>
      }
    >
      <AiStudioContent />
    </Suspense>
  );
}
