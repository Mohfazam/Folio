import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FollowUpsDashboard, type FollowUpRecord } from "@/components/dashboard/follow-ups-dashboard";

type JsonRecord = Record<string, unknown>;
type SearchParams = Record<string, string | string[] | undefined>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function toFollowUp(value: unknown): FollowUpRecord | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const contact = isRecord(value.contact) ? value.contact : null;
  const call = isRecord(value.call) ? value.call : null;
  return {
    id: value.id,
    contactId: typeof value.contactId === "string" ? value.contactId : "",
    callId: nullableString(value.callId),
    type: typeof value.type === "string" ? value.type : "call_back",
    priority: typeof value.priority === "string" ? value.priority : "medium",
    dueDate: nullableString(value.dueDate),
    requestedCallbackTime: nullableString(value.requestedCallbackTime),
    assignedTo: nullableString(value.assignedTo),
    status: typeof value.status === "string" ? value.status : "open",
    notes: nullableString(value.notes),
    createdAt: nullableString(value.createdAt),
    contact: contact ? {
      id: nullableString(contact.id),
      fullName: nullableString(contact.fullName),
      phoneNumber: nullableString(contact.phoneNumber),
      email: nullableString(contact.email),
      companyName: nullableString(contact.companyName),
      courseOrStream: nullableString(contact.courseOrStream),
    } : null,
    call: call ? {
      id: nullableString(call.id),
      startedAt: nullableString(call.startedAt),
      outcome: nullableString(call.outcome),
      sentiment: nullableString(call.sentiment),
      interestLevel: nullableString(call.interestLevel),
      durationSeconds: typeof call.durationSeconds === "number" ? call.durationSeconds : null,
      summary: nullableString(call.summary),
    } : null,
  };
}

async function FollowUpsPageContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();
  const params = await searchParams;
  const requestedStatus = first(params.status);
  const status = ["open", "done", "not_needed"].includes(requestedStatus) ? requestedStatus : "open";

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/sign-in");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) redirect("/sign-in");

  const baseUrl = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) return <FollowUpsDashboard followUps={[]} total={0} contacts={[]} initialStatus={status} initialError="BACKEND_API_URL is not configured for the Next.js server." />;

  const headers = { Authorization: `Bearer ${session.access_token}` };
  try {
    const [followUpsResponse, contactsResponse] = await Promise.all([
      fetch(`${baseUrl}/api/follow-ups?limit=100&offset=0`, { headers, cache: "no-store" }),
      fetch(`${baseUrl}/api/contacts?limit=100&offset=0`, { headers, cache: "no-store" }),
    ]);
    const [followUpsPayload, contactsPayload] = await Promise.all([
      followUpsResponse.json().catch(() => null) as Promise<unknown>,
      contactsResponse.json().catch(() => null) as Promise<unknown>,
    ]);

    if (!followUpsResponse.ok || !isRecord(followUpsPayload) || followUpsPayload.ok !== true) {
      const message = isRecord(followUpsPayload) && typeof followUpsPayload.error === "string" ? followUpsPayload.error : `Follow-ups request failed (${followUpsResponse.status}).`;
      return <FollowUpsDashboard followUps={[]} total={0} contacts={[]} initialStatus={status} initialError={message} />;
    }

    const rows = Array.isArray(followUpsPayload.followUps) ? followUpsPayload.followUps : [];
    const followUps = rows.map(toFollowUp).filter((item): item is FollowUpRecord => item !== null);
    const contactRows = isRecord(contactsPayload) && Array.isArray(contactsPayload.contacts) ? contactsPayload.contacts : [];
    const contacts = contactRows.filter(isRecord).filter((item) => typeof item.id === "string").map((item) => ({
      id: item.id as string,
      fullName: typeof item.fullName === "string" && item.fullName.trim() ? item.fullName : "Unnamed contact",
      phoneNumber: typeof item.phoneNumber === "string" ? item.phoneNumber : "",
    }));

    return <FollowUpsDashboard followUps={followUps} total={typeof followUpsPayload.total === "number" ? followUpsPayload.total : followUps.length} contacts={contacts} initialStatus={status} initialError={null} />;
  } catch (error) {
    console.error("[dashboard/follow-ups] Unable to load follow-ups:", error);
    return <FollowUpsDashboard followUps={[]} total={0} contacts={[]} initialStatus={status} initialError={error instanceof Error ? error.message : "Unable to load follow-ups."} />;
  }
}

function FollowUpsLoading() {
  return <div className="space-y-6" aria-live="polite" aria-busy="true"><div><div className="h-3 w-36 animate-pulse rounded bg-[#E9E8E1]" /><div className="mt-3 h-10 w-56 animate-pulse rounded bg-[#E9E8E1]" /></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-[8px] bg-[#F0EFE9]" />)}</div><div className="h-80 animate-pulse rounded-[8px] bg-[#F0EFE9]" /></div>;
}

export default function FollowUpsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <Suspense fallback={<FollowUpsLoading />}><FollowUpsPageContent searchParams={searchParams} /></Suspense>;
}
