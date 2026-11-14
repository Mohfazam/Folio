import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ContactsDashboard,
  type ContactRecord,
  type ContactFilters,
} from "@/components/dashboard/contacts-dashboard";

type JsonRecord = Record<string, unknown>;
type SearchParams = Record<string, string | string[] | undefined>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function numberParam(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function toContact(value: unknown): ContactRecord | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;

  const tags = Array.isArray(value.tags)
    ? value.tags.filter((tag): tag is string => typeof tag === "string")
    : [];

  return {
    id: value.id,
    fullName: typeof value.fullName === "string" ? value.fullName : "",
    secondaryName: typeof value.secondaryName === "string" ? value.secondaryName : "",
    phoneNumber: typeof value.phoneNumber === "string" ? value.phoneNumber : "",
    phoneNumberRaw: typeof value.phoneNumberRaw === "string" ? value.phoneNumberRaw : "",
    email: typeof value.email === "string" ? value.email : "",
    companyName: typeof value.companyName === "string" ? value.companyName : "",
    jobTitle: typeof value.jobTitle === "string" ? value.jobTitle : "",
    department: typeof value.department === "string" ? value.department : "",
    industry: typeof value.industry === "string" ? value.industry : "",
    city: typeof value.city === "string" ? value.city : "",
    state: typeof value.state === "string" ? value.state : "",
    country: typeof value.country === "string" ? value.country : "",
    timezone: typeof value.timezone === "string" ? value.timezone : "",
    leadScore: typeof value.leadScore === "number" ? value.leadScore : null,
    lifecycleStage: typeof value.lifecycleStage === "string" ? value.lifecycleStage : "",
    accountTier: typeof value.accountTier === "string" ? value.accountTier : "",
    tags,
    parentName: typeof value.parentName === "string" ? value.parentName : "",
    studentName: typeof value.studentName === "string" ? value.studentName : "",
    courseOrStream: typeof value.courseOrStream === "string" ? value.courseOrStream : "",
    status: typeof value.status === "string" ? value.status : "pending",
    optOut: value.optOut === true,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

async function ContactsPageContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();

  const params = await searchParams;
  const requestedStatus = first(params.status);
  const requestedLifecycle = first(params.lifecycleStage);
  const requestedTier = first(params.accountTier);
  const allowedStatuses = new Set([
    "pending",
    "queued",
    "in_progress",
    "completed",
    "do_not_call",
    "invalid",
  ]);
  const allowedLifecycleStages = new Set([
    "lead",
    "prospect",
    "mql",
    "sql",
    "customer",
    "churned",
  ]);
  const allowedAccountTiers = new Set([
    "Enterprise",
    "Mid-Market",
    "SMB",
    "VIP",
  ]);

  const filters: ContactFilters = {
    search: first(params.search).trim().slice(0, 200),
    status: allowedStatuses.has(requestedStatus) ? requestedStatus : "",
    lifecycleStage: allowedLifecycleStages.has(requestedLifecycle) ? requestedLifecycle : "",
    accountTier: allowedAccountTiers.has(requestedTier) ? requestedTier : "",
    limit: numberParam(first(params.limit), 25, 1, 100),
    offset: numberParam(first(params.offset), 0, 0, 1_000_000),
  };
  const startInImportMode = first(params.import) === "1";

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/sign-in");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) redirect("/sign-in");

  const baseUrl = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    return (
      <ContactsDashboard
        contacts={[]}
        total={0}
        filters={filters}
        initialError="BACKEND_API_URL is not configured for the Next.js server."
        startInImportMode={startInImportMode}
      />
    );
  }

  const query = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
  });
  if (filters.search) query.set("search", filters.search);
  if (filters.status) query.set("status", filters.status);
  if (filters.lifecycleStage) query.set("lifecycleStage", filters.lifecycleStage);
  if (filters.accountTier) query.set("accountTier", filters.accountTier);

  try {
    const response = await fetch(`${baseUrl}/api/contacts?${query.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const message = isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : `Contacts request failed (${response.status}).`;

      return (
        <ContactsDashboard
          contacts={[]}
          total={0}
          filters={filters}
          initialError={message}
          startInImportMode={startInImportMode}
        />
      );
    }

    const rows = Array.isArray(payload.contacts) ? payload.contacts : [];
    const contacts = rows
      .map(toContact)
      .filter((contact): contact is ContactRecord => contact !== null);
    const total = typeof payload.total === "number" ? payload.total : contacts.length;

    return (
      <ContactsDashboard
        contacts={contacts}
        total={total}
        filters={filters}
        initialError={null}
        startInImportMode={startInImportMode}
      />
    );
  } catch (error) {
    console.error("[dashboard/contacts] Unable to load contacts:", error);

    return (
      <ContactsDashboard
        contacts={[]}
        total={0}
        filters={filters}
        initialError={error instanceof Error ? error.message : "Unable to load contacts."}
        startInImportMode={startInImportMode}
      />
    );
  }
}

function ContactsLoading() {
  return (
    <div className="space-y-6" aria-live="polite" aria-busy="true">
      <div>
        <div className="h-3 w-36 animate-pulse rounded bg-[#E9E8E1]" />
        <div className="mt-3 h-10 w-56 animate-pulse rounded bg-[#E9E8E1]" />
        <div className="mt-3 h-4 w-full max-w-[520px] animate-pulse rounded bg-[#F0EFE9]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-[8px] border border-[#ECEBE5] bg-[#FFFEFB]" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-[8px] border border-[#ECEBE5] bg-[#FFFEFB]" />
      <span className="sr-only">Loading contacts…</span>
    </div>
  );
}

export default function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<ContactsLoading />}>
      <ContactsPageContent searchParams={searchParams} />
    </Suspense>
  );
}
