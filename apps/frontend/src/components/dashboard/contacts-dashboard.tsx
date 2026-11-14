"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { importContactsAction } from "@/app/(dashboard)/dashboard/actions";
import {
  createContactAction,
  deleteContactAction,
  updateContactAction,
} from "@/app/(dashboard)/dashboard/contacts/actions";

export type ContactRecord = {
  id: string;
  fullName: string;
  secondaryName: string;
  phoneNumber: string;
  phoneNumberRaw: string;
  email: string;
  companyName: string;
  jobTitle: string;
  department: string;
  industry: string;
  city: string;
  state: string;
  country: string;
  timezone: string;
  leadScore: number | null;
  lifecycleStage: string;
  accountTier: string;
  tags: string[];
  parentName: string;
  studentName: string;
  courseOrStream: string;
  status: string;
  optOut: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ContactFilters = {
  search: string;
  status: string;
  lifecycleStage: string;
  accountTier: string;
  limit: number;
  offset: number;
};

type ContactsDashboardProps = {
  contacts: ContactRecord[];
  total: number;
  filters: ContactFilters;
  initialError: string | null;
  startInImportMode?: boolean;
};

type EditorMode = "create" | "edit";

const INPUT_CLASS =
  "mt-1.5 h-10 w-full rounded-[5px] border border-[#DCDDD6] bg-white px-3 font-['Space_Grotesk'] text-[12px] text-[#1B1C18] outline-none transition-colors placeholder:text-[#A0A19A] focus:border-[#7852D6] focus:ring-2 focus:ring-[#7852D6]/10";

const LABEL_CLASS =
  "block font-['Space_Grotesk'] text-[11px] font-semibold text-[#444748]";

const STATUS_STYLES: Record<string, string> = {
  pending: "border-[#E6E1D2] bg-[#F8F6EF] text-[#716B58]",
  queued: "border-[#D9D0EC] bg-[#F3EFFA] text-[#705AA8]",
  in_progress: "border-[#C9DDF2] bg-[#EFF6FC] text-[#35658B]",
  completed: "border-[#CDE5D4] bg-[#EFF8F1] text-[#34734B]",
  do_not_call: "border-[#F0D8D4] bg-[#FFF4F2] text-[#A33A32]",
  invalid: "border-[#E5D8D8] bg-[#F8F1F1] text-[#8D5050]",
};

const LIFECYCLE_OPTIONS = [
  { value: "lead", label: "Lead" },
  { value: "prospect", label: "Prospect" },
  { value: "mql", label: "Marketing qualified" },
  { value: "sql", label: "Sales qualified" },
  { value: "customer", label: "Customer" },
  { value: "churned", label: "Churned" },
];

const ACCOUNT_TIER_OPTIONS = [
  { value: "Enterprise", label: "Enterprise" },
  { value: "Mid-Market", label: "Mid-market" },
  { value: "SMB", label: "SMB" },
  { value: "VIP", label: "VIP" },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function displayName(contact: ContactRecord): string {
  return contact.fullName.trim() || contact.phoneNumber || "Unnamed contact";
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className =
    STATUS_STYLES[normalized] ??
    "border-[#E5E1D5] bg-[#F7F5EF] text-[#696B62]";

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 font-['Space_Grotesk'] text-[9px] font-semibold capitalize ${className}`}
    >
      {statusLabel(normalized || "pending")}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[8px] border border-[#ECEBE5] bg-[#FFFEFB] px-4 py-4 sm:px-5">
      <p className="font-['Space_Grotesk'] text-[11px] font-medium text-[#747878]">
        {label}
      </p>
      <p className="mt-2 font-['Newsreader'] text-[29px] leading-none tracking-[-0.5px] text-[#1B1C18]">
        {value}
      </p>
      <p className="mt-2 font-['Space_Grotesk'] text-[10px] text-[#92938C]">
        {detail}
      </p>
    </div>
  );
}

function ContactEditor({
  mode,
  contact,
  onCancel,
  onSaved,
}: {
  mode: EditorMode;
  contact: ContactRecord | null;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    const optOut = form.get("optOut") === "on";
    const tags = String(form.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const payload: Record<string, unknown> = {
      fullName: String(form.get("fullName") ?? "").trim(),
      phoneNumber: String(form.get("phoneNumber") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      companyName: String(form.get("companyName") ?? "").trim(),
      jobTitle: String(form.get("jobTitle") ?? "").trim(),
      department: String(form.get("department") ?? "").trim(),
      industry: String(form.get("industry") ?? "").trim(),
      city: String(form.get("city") ?? "").trim(),
      state: String(form.get("state") ?? "").trim(),
      country: String(form.get("country") ?? "").trim(),
      lifecycleStage: String(form.get("lifecycleStage") ?? "").trim(),
      accountTier: String(form.get("accountTier") ?? "").trim(),
      tags,
    };

    // The API deliberately does not allow an existing opt-out to be reversed.
    // Send optOut only when the user is actively opting this contact out.
    if (optOut) payload.optOut = true;

    setBusy(true);
    setError(null);

    try {
      const result =
        mode === "create"
          ? await createContactAction(payload)
          : contact
            ? await updateContactAction(contact.id, payload)
            : { ok: false as const, error: "The selected contact is unavailable." };

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onSaved(
        mode === "create"
          ? "Contact added to your workspace."
          : "Contact details updated.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save this contact.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[8px] border border-[#DCD5ED] bg-[#FCFBFF] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.1em] text-[#806DB2]">
            {mode === "create" ? "New contact" : "Contact details"}
          </p>
          <h2 className="mt-1 font-['Newsreader'] text-[25px] text-[#1B1C18]">
            {mode === "create" ? "Add a contact" : `Edit ${contact ? displayName(contact) : "contact"}`}
          </h2>
          <p className="mt-1 font-['Space_Grotesk'] text-[11px] leading-5 text-[#747878]">
            Phone number is required. Existing opt-out records cannot be opted back in through contact editing.
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-[4px] border border-[#E5E1EC] bg-white px-3 py-2 font-['Space_Grotesk'] text-[11px] font-semibold text-[#565B5B] hover:bg-[#F7F5FB] disabled:opacity-50"
        >
          Close
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className={LABEL_CLASS}>
            Full name
            <input
              name="fullName"
              defaultValue={contact?.fullName ?? ""}
              maxLength={180}
              className={INPUT_CLASS}
              placeholder="Contact name"
            />
          </label>

          <label className={LABEL_CLASS}>
            Phone number
            <input
              name="phoneNumber"
              type="tel"
              required
              defaultValue={contact?.phoneNumber ?? ""}
              className={INPUT_CLASS}
              placeholder="+919876543210"
              autoComplete="tel"
              inputMode="tel"
            />
          </label>

          <label className={LABEL_CLASS}>
            Email
            <input
              name="email"
              type="email"
              defaultValue={contact?.email ?? ""}
              className={INPUT_CLASS}
              placeholder="name@company.com"
              autoComplete="email"
            />
          </label>

          <label className={LABEL_CLASS}>
            Company
            <input
              name="companyName"
              defaultValue={contact?.companyName ?? ""}
              className={INPUT_CLASS}
              placeholder="Company name"
            />
          </label>

          <label className={LABEL_CLASS}>
            Job title
            <input
              name="jobTitle"
              defaultValue={contact?.jobTitle ?? ""}
              className={INPUT_CLASS}
              placeholder="Job title"
            />
          </label>

          <label className={LABEL_CLASS}>
            Department
            <input
              name="department"
              defaultValue={contact?.department ?? ""}
              className={INPUT_CLASS}
              placeholder="Department"
            />
          </label>

          <label className={LABEL_CLASS}>
            Industry
            <input
              name="industry"
              defaultValue={contact?.industry ?? ""}
              className={INPUT_CLASS}
              placeholder="Industry"
            />
          </label>

          <label className={LABEL_CLASS}>
            City
            <input
              name="city"
              defaultValue={contact?.city ?? ""}
              className={INPUT_CLASS}
              placeholder="City"
            />
          </label>

          <label className={LABEL_CLASS}>
            State
            <input
              name="state"
              defaultValue={contact?.state ?? ""}
              className={INPUT_CLASS}
              placeholder="State"
            />
          </label>

          <label className={LABEL_CLASS}>
            Country
            <input
              name="country"
              defaultValue={contact?.country ?? "India"}
              className={INPUT_CLASS}
              placeholder="Country"
            />
          </label>

          <label className={LABEL_CLASS}>
            Lifecycle stage
            <select
              name="lifecycleStage"
              defaultValue={contact?.lifecycleStage ?? "lead"}
              className={INPUT_CLASS}
            >
              <option value="">Not set</option>
              {LIFECYCLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={LABEL_CLASS}>
            Account tier
            <select
              name="accountTier"
              defaultValue={contact?.accountTier ?? ""}
              className={INPUT_CLASS}
            >
              <option value="">Not set</option>
              {ACCOUNT_TIER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={LABEL_CLASS}>
          Tags
          <input
            name="tags"
            defaultValue={contact?.tags.join(", ") ?? ""}
            className={INPUT_CLASS}
            placeholder="Interested, Website, Referral"
          />
          <span className="mt-1 block font-normal text-[#92938C]">
            Separate tags with commas.
          </span>
        </label>

        <label className="flex items-start gap-2 rounded-[5px] border border-[#E9E8E1] bg-white p-3 font-['Space_Grotesk'] text-[11px] leading-5 text-[#565B5B]">
          <input
            name="optOut"
            type="checkbox"
            defaultChecked={contact?.optOut ?? false}
            disabled={contact?.optOut === true}
            className="mt-1 accent-[#7852D6]"
          />
          <span>
            <strong className="font-semibold text-[#1B1C18]">Do not call.</strong>{" "}
            Mark this contact as opted out. This action also prevents pending calls from being placed and cannot be reversed here.
          </span>
        </label>

        {error ? (
          <div
            role="alert"
            className="rounded-[5px] border border-[#F0D8D4] bg-[#FFF8F7] px-3 py-2.5 font-['Space_Grotesk'] text-[11px] leading-5 text-[#A33A32]"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#ECEBE5] pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-[4px] border border-[#DCDDD6] bg-white px-4 py-2.5 font-['Space_Grotesk'] text-[11px] font-semibold text-[#444748] hover:bg-[#F7F6F1] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-[4px] bg-[#1B1C18] px-4 py-2.5 font-['Space_Grotesk'] text-[11px] font-semibold text-white hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving…" : mode === "create" ? "Add contact" : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  );
}

function ImportPanel({
  onCancel,
  onImported,
}: {
  onCancel: () => void;
  onImported: (message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!file || !confirmed || busy) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("The selected file exceeds the 5 MB upload limit.");
      return;
    }

    const extension = file.name.toLowerCase().split(".").pop();
    if (extension !== "csv" && extension !== "xlsx") {
      setError("Use a CSV or XLSX file. XLS files are not supported.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const result = await importContactsAction(file);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const data = result.data ?? {};
      const inserted = typeof data.inserted === "number" ? data.inserted : 0;
      const failed = typeof data.failed === "number" ? data.failed : 0;
      const duplicates = typeof data.duplicates === "number" ? data.duplicates : 0;
      const total = typeof data.totalReceived === "number" ? data.totalReceived : inserted + failed;

      onImported(
        `Import processed: ${formatNumber(inserted)} added out of ${formatNumber(total)} rows, ${formatNumber(duplicates)} duplicates and ${formatNumber(failed)} rejected.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The contact import failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[8px] border border-[#DCD5ED] bg-[#FCFBFF] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.1em] text-[#806DB2]">
            Contact import
          </p>
          <h2 className="mt-1 font-['Newsreader'] text-[25px] text-[#1B1C18]">
            Import a contact list
          </h2>
          <p className="mt-1 max-w-[620px] font-['Space_Grotesk'] text-[11px] leading-5 text-[#747878]">
            Upload up to 500 contacts in CSV or XLSX format. Foolioo validates phone numbers, skips duplicates and preserves opt-out records.
          </p>
        </div>

        <a
          href="/contact-import-template.csv"
          download
          className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB] underline underline-offset-2"
        >
          Download CSV template
        </a>
      </div>

      <label className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[6px] border border-dashed border-[#CFCFC7] bg-white px-4 py-5 text-center transition-colors hover:border-[#7852D6]">
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7 text-[#7852D6]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
        </svg>
        <span className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
          {file ? file.name : "Choose your contact file"}
        </span>
        <span className="font-['Space_Grotesk'] text-[10px] text-[#747878]">
          CSV or Excel XLSX · Maximum 5 MB · Up to 500 contact rows
        </span>
        <input
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setConfirmed(false);
            setError(null);
          }}
        />
      </label>

      {file ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[5px] border border-[#E9E8E1] bg-white p-3">
          <div className="min-w-0">
            <p className="truncate font-['Space_Grotesk'] text-[11px] font-semibold text-[#1B1C18]">
              {file.name}
            </p>
            <p className="mt-1 font-['Space_Grotesk'] text-[10px] text-[#747878]">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              setConfirmed(false);
            }}
            className="shrink-0 font-['Space_Grotesk'] text-[10px] font-semibold text-[#644ABB]"
          >
            Remove
          </button>
        </div>
      ) : null}

      <div className="mt-3 rounded-[4px] bg-[#F5F4ED] px-3 py-2.5 font-['Space_Grotesk'] text-[10px] leading-5 text-[#565B5B]">
        Required column: <strong>phoneNumber</strong>. Optional columns include fullName, email, companyName, jobTitle, city, state, country, lifecycleStage, accountTier, tags and optOut. Ten-digit Indian mobile numbers are normalized with +91.
      </div>

      <label className="mt-3 flex items-start gap-2 rounded-[4px] border border-[#E9E8E1] bg-white p-3 font-['Space_Grotesk'] text-[10px] leading-5 text-[#565B5B]">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1 accent-[#7852D6]"
        />
        <span>
          I confirm that I have permission to contact the people in this file and that opt-out requests are represented correctly.
        </span>
      </label>

      {error ? (
        <div
          role="alert"
          className="mt-3 rounded-[5px] border border-[#F0D8D4] bg-[#FFF8F7] px-3 py-2.5 font-['Space_Grotesk'] text-[11px] leading-5 text-[#A33A32]"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#ECEBE5] pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-[4px] border border-[#DCDDD6] bg-white px-4 py-2.5 font-['Space_Grotesk'] text-[11px] font-semibold text-[#444748] hover:bg-[#F7F6F1] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={!file || !confirmed || busy}
          className="rounded-[4px] bg-[#1B1C18] px-4 py-2.5 font-['Space_Grotesk'] text-[11px] font-semibold text-white hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Importing…" : "Confirm and import"}
        </button>
      </div>
    </section>
  );
}

function buildPageHref(filters: ContactFilters, offset: number): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.lifecycleStage) params.set("lifecycleStage", filters.lifecycleStage);
  if (filters.accountTier) params.set("accountTier", filters.accountTier);
  params.set("limit", String(filters.limit));
  params.set("offset", String(offset));
  return `/dashboard/contacts?${params.toString()}`;
}

export function ContactsDashboard({
  contacts,
  total,
  filters,
  initialError,
  startInImportMode = false,
}: ContactsDashboardProps) {
  const router = useRouter();
  const [showImport, setShowImport] = useState(startInImportMode);
  const [editor, setEditor] = useState<{
    mode: EditorMode;
    contact: ContactRecord | null;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const currentPage = Math.floor(filters.offset / filters.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const rangeStart = total === 0 ? 0 : filters.offset + 1;
  const rangeEnd = Math.min(filters.offset + contacts.length, total);

  const pageStats = useMemo(
    () => ({
      pending: contacts.filter((contact) => contact.status === "pending" && !contact.optOut).length,
      optedOut: contacts.filter((contact) => contact.optOut || contact.status === "do_not_call").length,
      completed: contacts.filter((contact) => contact.status === "completed").length,
    }),
    [contacts],
  );

  function cleanImportQuery() {
    router.replace(buildPageHref(filters, filters.offset), { scroll: false });
  }

  function closeImport() {
    setShowImport(false);
    cleanImportQuery();
  }

  function handleSaved(message: string) {
    setEditor(null);
    setShowImport(false);
    setNotice(message);
    setActionError(null);
    cleanImportQuery();
    router.refresh();
  }

  async function handleDelete(contact: ContactRecord) {
    if (deletingId) return;
    const confirmationMessage = contact.optOut
      ? `Delete ${displayName(contact)} from this workspace? This also removes the contact's do-not-call suppression record. Proceed only if your retention policy allows it. This cannot be undone.`
      : `Delete ${displayName(contact)} from this workspace? This cannot be undone.`;
    const confirmed = window.confirm(confirmationMessage);
    if (!confirmed) return;

    setDeletingId(contact.id);
    setActionError(null);

    try {
      const result = await deleteContactAction(contact.id);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setNotice(`${displayName(contact)} was deleted.`);
      router.refresh();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Unable to delete this contact.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#9A8ABF]">
            Workspace / Audience
          </p>
          <h1 className="mt-1 font-['Newsreader'] text-[36px] leading-tight tracking-[-0.8px] text-[#1B1C18] sm:text-[42px]">
            Contacts
          </h1>
          <p className="mt-2 max-w-[620px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878]">
            Manage your audience, keep contact details current and respect calling preferences before adding people to campaigns.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEditor(null);
              setShowImport((value) => !value);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-[5px] border border-[#DCDDD6] bg-white px-4 font-['Space_Grotesk'] text-[11px] font-semibold text-[#1B1C18] transition-colors hover:bg-[#F7F6F1]"
          >
            <span aria-hidden="true">↑</span>
            Import contacts
          </button>
          <button
            type="button"
            onClick={() => {
              setShowImport(false);
              setEditor({ mode: "create", contact: null });
            }}
            className="inline-flex h-10 items-center gap-2 rounded-[5px] bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[11px] font-semibold text-white transition-colors hover:bg-[#34352F]"
          >
            <span className="text-[16px] leading-none" aria-hidden="true">+</span>
            Add contact
          </button>
        </div>
      </header>

      {notice ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[#D7E8DA] bg-[#F1F8F2] px-4 py-3 font-['Space_Grotesk'] text-[11px] text-[#397A55]"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="font-semibold"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="rounded-[6px] border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3 font-['Space_Grotesk'] text-[11px] leading-5 text-[#A33A32]"
        >
          {actionError}
        </div>
      ) : null}

      {editor ? (
        <ContactEditor
          key={`${editor.mode}-${editor.contact?.id ?? "new"}`}
          mode={editor.mode}
          contact={editor.contact}
          onCancel={() => setEditor(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {showImport ? (
        <ImportPanel
          onCancel={closeImport}
          onImported={handleSaved}
        />
      ) : null}

      {initialError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3">
          <p className="font-['Space_Grotesk'] text-[11px] leading-5 text-[#A33A32]">
            Contacts could not be loaded: {initialError}
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-[4px] border border-[#E5C7C3] bg-white px-3 py-2 font-['Space_Grotesk'] text-[10px] font-semibold text-[#8D3028]"
          >
            Try again
          </button>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Contact metrics">
        <MetricCard
          label="Workspace contacts"
          value={formatNumber(total)}
          detail="Matching current filters"
        />
        <MetricCard
          label="Pending and callable"
          value={formatNumber(pageStats.pending)}
          detail="On this page only"
        />
        <MetricCard
          label="Completed"
          value={formatNumber(pageStats.completed)}
          detail="On this page only"
        />
        <MetricCard
          label="Do not call"
          value={formatNumber(pageStats.optedOut)}
          detail="On this page only"
        />
      </section>

      <section className="overflow-hidden rounded-[8px] border border-[#ECEBE5] bg-white">
        <div className="border-b border-[#ECEBE5] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">
                Contact directory
              </h2>
              <p className="mt-1 font-['Space_Grotesk'] text-[10px] text-[#85877F]">
                Search and filter your workspace contacts. Results are loaded from the contacts API.
              </p>
            </div>
            <a
              href="/contact-import-template.csv"
              download
              className="font-['Space_Grotesk'] text-[10px] font-semibold text-[#644ABB] underline underline-offset-2"
            >
              CSV template
            </a>
          </div>

          <form
            method="get"
            action="/dashboard/contacts"
            className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(130px,0.8fr))_auto]"
          >
            <input type="hidden" name="limit" value={filters.limit} />
            <label className="sr-only" htmlFor="contact-search">Search contacts</label>
            <input
              id="contact-search"
              name="search"
              defaultValue={filters.search}
              placeholder="Search name, phone, email or company"
              className="h-10 min-w-0 rounded-[5px] border border-[#E5E4DC] bg-[#FFFEFB] px-3 font-['Space_Grotesk'] text-[11px] outline-none focus:border-[#7852D6] sm:col-span-2 xl:col-span-1"
            />

            <label className="sr-only" htmlFor="contact-status">Contact status</label>
            <select
              id="contact-status"
              name="status"
              defaultValue={filters.status}
              className="h-10 rounded-[5px] border border-[#E5E4DC] bg-white px-3 font-['Space_Grotesk'] text-[11px] text-[#444748] outline-none focus:border-[#7852D6]"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="queued">Queued</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="do_not_call">Do not call</option>
              <option value="invalid">Invalid</option>
            </select>

            <label className="sr-only" htmlFor="contact-lifecycle">Lifecycle stage</label>
            <select
              id="contact-lifecycle"
              name="lifecycleStage"
              defaultValue={filters.lifecycleStage}
              className="h-10 rounded-[5px] border border-[#E5E4DC] bg-white px-3 font-['Space_Grotesk'] text-[11px] text-[#444748] outline-none focus:border-[#7852D6]"
            >
              <option value="">All lifecycle stages</option>
              {LIFECYCLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <label className="sr-only" htmlFor="contact-tier">Account tier</label>
            <select
              id="contact-tier"
              name="accountTier"
              defaultValue={filters.accountTier}
              className="h-10 rounded-[5px] border border-[#E5E4DC] bg-white px-3 font-['Space_Grotesk'] text-[11px] text-[#444748] outline-none focus:border-[#7852D6]"
            >
              <option value="">All account tiers</option>
              {ACCOUNT_TIER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
              <button
                type="submit"
                className="h-10 flex-1 rounded-[5px] bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[11px] font-semibold text-white hover:bg-[#34352F]"
              >
                Apply filters
              </button>
              <Link
                href="/dashboard/contacts"
                className="inline-flex h-10 items-center justify-center rounded-[5px] border border-[#DCDDD6] bg-white px-3 font-['Space_Grotesk'] text-[10px] font-semibold text-[#565B5B] hover:bg-[#F7F6F1]"
              >
                Clear
              </Link>
            </div>
          </form>
        </div>

        {contacts.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#ECEBE5] bg-[#FBFAF6]">
                    <th className="px-4 py-3 font-['Space_Grotesk'] text-[9px] font-bold uppercase tracking-[0.08em] text-[#85877F] sm:px-5">Contact</th>
                    <th className="px-4 py-3 font-['Space_Grotesk'] text-[9px] font-bold uppercase tracking-[0.08em] text-[#85877F]">Company</th>
                    <th className="px-4 py-3 font-['Space_Grotesk'] text-[9px] font-bold uppercase tracking-[0.08em] text-[#85877F]">Lifecycle</th>
                    <th className="px-4 py-3 font-['Space_Grotesk'] text-[9px] font-bold uppercase tracking-[0.08em] text-[#85877F]">Status</th>
                    <th className="px-4 py-3 font-['Space_Grotesk'] text-[9px] font-bold uppercase tracking-[0.08em] text-[#85877F]">Added</th>
                    <th className="px-4 py-3 text-right font-['Space_Grotesk'] text-[9px] font-bold uppercase tracking-[0.08em] text-[#85877F]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EFE9]">
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="align-middle transition-colors hover:bg-[#FFFEFB]">
                      <td className="px-4 py-3.5 sm:px-5">
                        <div className="min-w-0">
                          <p className="max-w-[220px] truncate font-['Space_Grotesk'] text-[11px] font-semibold text-[#1B1C18]">
                            {displayName(contact)}
                          </p>
                          <p className="mt-1 font-['Space_Grotesk'] text-[10px] text-[#747878]">
                            {contact.phoneNumber}
                          </p>
                          {contact.email ? (
                            <p className="mt-0.5 max-w-[220px] truncate font-['Space_Grotesk'] text-[9px] text-[#92938C]">
                              {contact.email}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="max-w-[170px] truncate font-['Space_Grotesk'] text-[10px] text-[#444748]">
                          {contact.companyName || "—"}
                        </p>
                        {contact.jobTitle ? (
                          <p className="mt-1 max-w-[170px] truncate font-['Space_Grotesk'] text-[9px] text-[#92938C]">
                            {contact.jobTitle}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-['Space_Grotesk'] text-[10px] capitalize text-[#565B5B]">
                          {contact.lifecycleStage ? contact.lifecycleStage.replaceAll("_", " ") : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={contact.status} />
                      </td>
                      <td className="px-4 py-3.5 font-['Space_Grotesk'] text-[10px] text-[#747878]">
                        {formatDate(contact.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowImport(false);
                              setEditor({ mode: "edit", contact });
                            }}
                            className="rounded-[4px] border border-[#E5E1EC] bg-white px-2.5 py-1.5 font-['Space_Grotesk'] text-[9px] font-semibold text-[#644ABB] hover:bg-[#F7F5FB]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(contact)}
                            disabled={deletingId === contact.id}
                            title={contact.optOut ? "Deleting an opted-out contact also removes its suppression record." : "Delete contact"}
                            className="rounded-[4px] border border-[#EAD8D5] bg-white px-2.5 py-1.5 font-['Space_Grotesk'] text-[9px] font-semibold text-[#A33A32] hover:bg-[#FFF8F7] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {deletingId === contact.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECEBE5] px-4 py-3 sm:px-5">
              <p className="font-['Space_Grotesk'] text-[10px] text-[#85877F]">
                Showing {rangeStart}–{rangeEnd} of {formatNumber(total)} contacts
              </p>
              <div className="flex items-center gap-2">
                <Link
                  aria-disabled={filters.offset <= 0}
                  tabIndex={filters.offset <= 0 ? -1 : 0}
                  href={buildPageHref(filters, Math.max(0, filters.offset - filters.limit))}
                  className={`rounded-[4px] border border-[#DCDDD6] px-3 py-2 font-['Space_Grotesk'] text-[10px] font-semibold ${filters.offset <= 0 ? "pointer-events-none text-[#B5B6B0]" : "text-[#444748] hover:bg-[#F7F6F1]"}`}
                >
                  Previous
                </Link>
                <span className="min-w-[76px] text-center font-['Space_Grotesk'] text-[10px] text-[#747878]">
                  Page {currentPage} of {totalPages}
                </span>
                <Link
                  aria-disabled={currentPage >= totalPages}
                  tabIndex={currentPage >= totalPages ? -1 : 0}
                  href={buildPageHref(filters, filters.offset + filters.limit)}
                  className={`rounded-[4px] border border-[#DCDDD6] px-3 py-2 font-['Space_Grotesk'] text-[10px] font-semibold ${currentPage >= totalPages ? "pointer-events-none text-[#B5B6B0]" : "text-[#444748] hover:bg-[#F7F6F1]"}`}
                >
                  Next
                </Link>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F2EEFA] text-[#705AA8]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="8" r="3" />
                <path d="M3 20c0-3.2 2.6-5 6-5s6 1.8 6 5M17 5a3 3 0 0 1 0 6M18 15c2 .5 3 2 3 4" />
              </svg>
            </span>
            <h3 className="mt-4 font-['Newsreader'] text-[25px] text-[#1B1C18]">
              {total === 0 ? "Your contacts start here" : "No contacts match these filters"}
            </h3>
            <p className="mt-2 max-w-[400px] font-['Space_Grotesk'] text-[11px] leading-5 text-[#85877F]">
              {total === 0
                ? "Add an individual contact or import a CSV/XLSX list. Contacts are not called until they are explicitly added to an approved campaign."
                : "Try clearing one or more filters, or use a different search term."}
            </p>
            {total === 0 ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditor({ mode: "create", contact: null })}
                  className="rounded-[5px] bg-[#1B1C18] px-4 py-2.5 font-['Space_Grotesk'] text-[10px] font-semibold text-white hover:bg-[#34352F]"
                >
                  Add your first contact
                </button>
                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  className="rounded-[5px] border border-[#DCDDD6] bg-white px-4 py-2.5 font-['Space_Grotesk'] text-[10px] font-semibold text-[#444748] hover:bg-[#F7F6F1]"
                >
                  Import a contact list
                </button>
              </div>
            ) : (
              <Link
                href="/dashboard/contacts"
                className="mt-5 rounded-[5px] border border-[#DCDDD6] bg-white px-4 py-2.5 font-['Space_Grotesk'] text-[10px] font-semibold text-[#444748] hover:bg-[#F7F6F1]"
              >
                Clear all filters
              </Link>
            )}
          </div>
        )}
      </section>

      <p className="font-['Space_Grotesk'] text-[10px] leading-5 text-[#92938C]">
        Contacts marked Do not call remain visible for compliance and suppression. They are excluded from outbound calling. Importing contacts never starts a campaign automatically.
      </p>
    </div>
  );
}
