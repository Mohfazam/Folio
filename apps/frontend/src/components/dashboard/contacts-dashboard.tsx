"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { dashboardKeys } from "@/lib/query/keys";
import { ConfirmDialog } from "@/components/dashboard/accessible-dialog";
import { ToastNotice } from "@/components/dashboard/toast-notice";
import {
  bulkCreateContactsAction,
  previewContactImportAction,
} from "@/app/(dashboard)/dashboard/actions";
import {
  createContactAction,
  deleteContactAction,
  fetchContactsAction,
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
  "mt-1.5 h-10 w-full rounded-[5px] border border-[#DCDDD6] bg-white px-3 font-['Space_Grotesk'] text-[14px] text-[#1B1C18] outline-none transition-colors placeholder:text-[#A0A19A] focus:border-[#7852D6] focus:ring-2 focus:ring-[#7852D6]/10";

const LABEL_CLASS =
  "block font-['Space_Grotesk'] text-[13px] font-semibold text-[#444748]";

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
  const dotColor =
    normalized === "completed" || normalized === "connected"
      ? "bg-[#2F7A4D]"
      : normalized === "in_progress" || normalized === "calling"
        ? "bg-[#644ABB]"
        : normalized === "do_not_call" || normalized === "failed"
          ? "bg-[#C24138]"
          : "bg-[#8E918B]";

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] border border-[#E6E5DD] bg-[#FAF9F5] px-2 py-0.5 font-['Space_Grotesk'] text-[11px] font-medium capitalize text-[#2E302B]">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} aria-hidden="true" />
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
      <p className="font-['Space_Grotesk'] text-[13px] font-medium text-[#747878]">
        {label}
      </p>
      <p className="mt-2 font-['Newsreader'] text-[32px] leading-none tracking-[-0.5px] text-[#1B1C18]">
        {value}
      </p>
      <p className="mt-2 font-['Space_Grotesk'] text-[12px] text-[#92938C]">
        {detail}
      </p>
    </div>
  );
}

const FULL_NAME_MAX_LENGTH = 128;
const EMAIL_MAX_LENGTH = 254;
const STANDARD_FIELD_MAX_LENGTH = 120;
const TAGS_INPUT_MAX_LENGTH = 450;
const MAX_TAGS_COUNT = 10;

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const INDIAN_MOBILE_10_REGEX = /^[6-9]\d{9}$/;
const SQL_INJECTION_PATTERN = /(?:--|;|\/\*|\*\/|\b(?:union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+\w+\s+set|exec\s*\(|xp_cmdshell)\b)/i;

function extractIndianTenDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length > 10) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
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
  onSaved: (message: string, savedContact?: ContactRecord) => void;
}) {
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(contact?.fullName ?? "");
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [phoneDigits, setPhoneDigits] = useState(() =>
    extractIndianTenDigits(contact?.phoneNumber ?? ""),
  );
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [email, setEmail] = useState(contact?.email ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState(contact?.companyName ?? "");
  const [jobTitle, setJobTitle] = useState(contact?.jobTitle ?? "");
  const [department, setDepartment] = useState(contact?.department ?? "");
  const [industry, setIndustry] = useState(contact?.industry ?? "");
  const [lifecycleStage, setLifecycleStage] = useState(contact?.lifecycleStage ?? "lead");
  const [tagsInput, setTagsInput] = useState(() => contact?.tags.join(", ") ?? "");
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [country, setCountry] = useState(contact?.country ?? "India");
  const [state, setState] = useState(contact?.state ?? "");
  const [city, setCity] = useState(contact?.city ?? "");
  const [optOutChecked, setOptOutChecked] = useState<boolean>(contact?.optOut ?? false);

  function handleFullNameChange(value: string) {
    const withoutNumbers = value.replace(/\d+/g, "");
    if (withoutNumbers.length > FULL_NAME_MAX_LENGTH) {
      setFullName(withoutNumbers.slice(0, FULL_NAME_MAX_LENGTH));
      setFullNameError(
        `Full name cannot exceed ${FULL_NAME_MAX_LENGTH} characters (${FULL_NAME_MAX_LENGTH}/${FULL_NAME_MAX_LENGTH}).`,
      );
      return;
    }
    setFullName(withoutNumbers);
    if (value !== withoutNumbers) {
      setFullNameError("Numbers are not allowed in the full name field.");
    } else if (SQL_INJECTION_PATTERN.test(withoutNumbers)) {
      setFullNameError("Full name contains disallowed characters or SQL syntax.");
    } else {
      setFullNameError(null);
    }
  }

  function handlePhoneChange(value: string) {
    const cleanedDigits = extractIndianTenDigits(value);
    setPhoneDigits(cleanedDigits);
    if (!cleanedDigits) {
      setPhoneError(null);
    } else if (cleanedDigits.length < 10) {
      setPhoneError("Phone number must be 10 digits.");
    } else if (!INDIAN_MOBILE_10_REGEX.test(cleanedDigits)) {
      setPhoneError("Enter a valid Indian mobile number starting with 6, 7, 8, or 9.");
    } else {
      setPhoneError(null);
    }
  }

  function handleEmailChange(value: string) {
    const trimmed = value.slice(0, EMAIL_MAX_LENGTH);
    setEmail(trimmed);
    const candidate = trimmed.trim();
    if (!candidate) {
      setEmailError(null);
    } else if (!EMAIL_REGEX.test(candidate)) {
      setEmailError("Enter a valid email address (e.g. name@company.com).");
    } else if (SQL_INJECTION_PATTERN.test(candidate)) {
      setEmailError("Email contains disallowed characters.");
    } else {
      setEmailError(null);
    }
  }

  function handleTagsChange(value: string) {
    const sliced = value.slice(0, TAGS_INPUT_MAX_LENGTH);
    setTagsInput(sliced);
    const parsed = sliced
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (parsed.length > MAX_TAGS_COUNT) {
      setTagsError(`Maximum ${MAX_TAGS_COUNT} tags allowed (${parsed.length}/${MAX_TAGS_COUNT}).`);
    } else if (parsed.some((tag) => SQL_INJECTION_PATTERN.test(tag))) {
      setTagsError("Tags contain disallowed characters or SQL syntax.");
    } else {
      setTagsError(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || busy) return;

    setError(null);

    const cleanName = fullName.trim();
    if (!cleanName) {
      setFullNameError("Full name is required.");
      setError("Please enter a valid full name.");
      return;
    }
    if (/\d/.test(cleanName)) {
      setFullNameError("Numbers are not allowed in the full name field.");
      setError("Full name cannot contain numbers.");
      return;
    }
    if (cleanName.length > FULL_NAME_MAX_LENGTH) {
      setFullNameError(`Full name cannot exceed ${FULL_NAME_MAX_LENGTH} characters.`);
      setError(`Full name cannot exceed ${FULL_NAME_MAX_LENGTH} characters.`);
      return;
    }

    const cleanDigits = extractIndianTenDigits(phoneDigits);
    if (!INDIAN_MOBILE_10_REGEX.test(cleanDigits)) {
      setPhoneError("Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.");
      setError("Please enter a valid 10-digit Indian phone number.");
      return;
    }

    const cleanEmail = email.trim();
    if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
      setEmailError("Enter a valid email address (e.g. name@company.com).");
      setError("Please enter a valid email address.");
      return;
    }

    const parsedTags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (parsedTags.length > MAX_TAGS_COUNT) {
      setTagsError(`Maximum ${MAX_TAGS_COUNT} tags allowed.`);
      setError(`You can add a maximum of ${MAX_TAGS_COUNT} tags.`);
      return;
    }

    const fieldsToInspect = [
      ["Full name", cleanName],
      ["Email", cleanEmail],
      ["Company", companyName.trim()],
      ["Job title", jobTitle.trim()],
      ["Department", department.trim()],
      ["Industry", industry.trim()],
      ["Country", country.trim()],
      ["State", state.trim()],
      ["City", city.trim()],
      ...parsedTags.map((tag): [string, string] => ["Tag", tag]),
    ];

    for (const [label, val] of fieldsToInspect) {
      if (val && SQL_INJECTION_PATTERN.test(val)) {
        setError(`${label} contains disallowed characters or SQL syntax.`);
        return;
      }
    }

    const payload: Record<string, unknown> = {
      fullName: cleanName,
      phoneNumber: `+91${cleanDigits}`,
      email: cleanEmail,
      companyName: companyName.trim().slice(0, STANDARD_FIELD_MAX_LENGTH),
      jobTitle: jobTitle.trim().slice(0, STANDARD_FIELD_MAX_LENGTH),
      department: department.trim().slice(0, STANDARD_FIELD_MAX_LENGTH),
      industry: industry.trim().slice(0, STANDARD_FIELD_MAX_LENGTH),
      country: country.trim().slice(0, STANDARD_FIELD_MAX_LENGTH),
      state: state.trim().slice(0, STANDARD_FIELD_MAX_LENGTH),
      city: city.trim().slice(0, STANDARD_FIELD_MAX_LENGTH),
      lifecycleStage: lifecycleStage.trim(),
      tags: parsedTags,
    };

    if (optOutChecked) payload.optOut = true;

    submittingRef.current = true;
    setBusy(true);

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

      const rawData =
        "data" in result && result.data && typeof result.data === "object"
          ? (result.data as Record<string, unknown>)
          : undefined;
      const serverContact =
        rawData && typeof rawData.contact === "object" && rawData.contact !== null
          ? normalizeFetchedContact(rawData.contact)
          : rawData
            ? normalizeFetchedContact(rawData)
            : null;

      const nowIso = new Date().toISOString();
      const isOptedOut = optOutChecked || contact?.optOut === true;
      const optimisticRecord: ContactRecord = serverContact ?? {
        id: contact?.id ?? `temp-${Date.now()}`,
        fullName: cleanName,
        secondaryName: contact?.secondaryName ?? "",
        phoneNumber: `+91${cleanDigits}`,
        phoneNumberRaw: cleanDigits,
        email: cleanEmail,
        companyName: String(payload.companyName ?? ""),
        jobTitle: String(payload.jobTitle ?? ""),
        department: String(payload.department ?? ""),
        industry: String(payload.industry ?? ""),
        city: String(payload.city ?? ""),
        state: String(payload.state ?? ""),
        country: String(payload.country ?? ""),
        timezone: contact?.timezone ?? "",
        leadScore: contact?.leadScore ?? null,
        lifecycleStage: String(payload.lifecycleStage ?? ""),
        tags: parsedTags,
        parentName: contact?.parentName ?? "",
        studentName: contact?.studentName ?? "",
        courseOrStream: contact?.courseOrStream ?? "",
        status: isOptedOut ? "do_not_call" : (contact?.status ?? "pending"),
        optOut: isOptedOut,
        createdAt: contact?.createdAt ?? nowIso,
        updatedAt: nowIso,
      };

      onSaved(
        mode === "create"
          ? "Contact added to your workspace."
          : "Contact details updated.",
        optimisticRecord,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save this contact.",
      );
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[8px] border border-[#DCD5ED] bg-[#FCFBFF] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-['Space_Grotesk'] text-[12px] font-bold uppercase tracking-[0.1em] text-[#806DB2]">
            {mode === "create" ? "New contact" : "Contact details"}
          </p>
          <h2 className="mt-1 font-['Newsreader'] text-[25px] leading-tight text-[#1B1C18] sm:text-[26px]">
            {mode === "create" ? "Add a contact" : `Edit ${contact ? displayName(contact) : "contact"}`}
          </h2>
          <p className="mt-1 font-['Space_Grotesk'] text-[13px] leading-5 text-[#747878]">
            Fields marked with <span className="font-bold text-[#A33A32]">*</span> are required. Existing opt-out records cannot be opted back in through contact editing.
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-[4px] border border-[#E5E1EC] bg-white px-3 py-2 font-['Space_Grotesk'] text-[13px] font-semibold text-[#565B5B] hover:bg-[#F7F5FB] disabled:opacity-50"
        >
          Close
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className={LABEL_CLASS}>
            <span>
              <span className="text-[#A33A32]" aria-hidden="true">* </span>
              Full name
            </span>
            <input
              name="fullName"
              required
              value={fullName}
              onChange={(event) => handleFullNameChange(event.target.value)}
              className={INPUT_CLASS}
              placeholder="Contact name"
            />
            <span className="mt-1 flex items-center justify-between text-[12px] font-normal text-[#92938C]">
              <span>Letters only · Max {FULL_NAME_MAX_LENGTH} characters</span>
              <span>{fullName.length}/{FULL_NAME_MAX_LENGTH}</span>
            </span>
            {fullNameError ? (
              <span className="mt-1 block text-[12px] font-semibold text-[#A33A32]">
                {fullNameError}
              </span>
            ) : null}
          </label>

          <label className={LABEL_CLASS}>
            <span>
              <span className="text-[#A33A32]" aria-hidden="true">* </span>
              Phone number
            </span>
            <div className="mt-1.5 flex h-10 w-full overflow-hidden rounded-[5px] border border-[#DCDDD6] bg-white transition-colors focus-within:border-[#7852D6] focus-within:ring-2 focus-within:ring-[#7852D6]/10">
              <span className="inline-flex select-none items-center border-r border-[#ECEBE5] bg-[#F8F7F2] px-3 font-['Space_Grotesk'] text-[14px] font-semibold text-[#565B5B]">
                +91
              </span>
              <input
                name="phoneNumber"
                type="tel"
                required
                value={phoneDigits}
                onChange={(event) => handlePhoneChange(event.target.value)}
                maxLength={14}
                className="h-full w-full bg-white px-3 font-['Space_Grotesk'] text-[14px] text-[#1B1C18] outline-none placeholder:text-[#A0A19A]"
                placeholder="9876543210"
                autoComplete="tel-national"
                inputMode="numeric"
              />
            </div>
            <span className="mt-1 flex items-center justify-between text-[12px] font-normal text-[#92938C]">
              <span>10-digit Indian mobile number</span>
              <span>{phoneDigits.length}/10</span>
            </span>
            {phoneError ? (
              <span className="mt-1 block text-[12px] font-semibold text-[#A33A32]">
                {phoneError}
              </span>
            ) : null}
          </label>

          <label className={LABEL_CLASS}>
            Email
            <input
              name="email"
              type="email"
              value={email}
              onChange={(event) => handleEmailChange(event.target.value)}
              maxLength={EMAIL_MAX_LENGTH}
              className={INPUT_CLASS}
              placeholder="name@company.com"
              autoComplete="email"
            />
            {emailError ? (
              <span className="mt-1 block text-[12px] font-semibold text-[#A33A32]">
                {emailError}
              </span>
            ) : null}
          </label>

          <label className={LABEL_CLASS}>
            Company
            <input
              name="companyName"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value.slice(0, STANDARD_FIELD_MAX_LENGTH))}
              maxLength={STANDARD_FIELD_MAX_LENGTH}
              className={INPUT_CLASS}
              placeholder="Company name"
            />
          </label>

          <label className={LABEL_CLASS}>
            Job title
            <input
              name="jobTitle"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value.slice(0, STANDARD_FIELD_MAX_LENGTH))}
              maxLength={STANDARD_FIELD_MAX_LENGTH}
              className={INPUT_CLASS}
              placeholder="Job title"
            />
          </label>

          <label className={LABEL_CLASS}>
            Department
            <input
              name="department"
              value={department}
              onChange={(event) => setDepartment(event.target.value.slice(0, STANDARD_FIELD_MAX_LENGTH))}
              maxLength={STANDARD_FIELD_MAX_LENGTH}
              className={INPUT_CLASS}
              placeholder="Department"
            />
          </label>

          <label className={LABEL_CLASS}>
            Industry
            <input
              name="industry"
              value={industry}
              onChange={(event) => setIndustry(event.target.value.slice(0, STANDARD_FIELD_MAX_LENGTH))}
              maxLength={STANDARD_FIELD_MAX_LENGTH}
              className={INPUT_CLASS}
              placeholder="Industry"
            />
          </label>

          <label className={LABEL_CLASS}>
            Lifecycle stage
            <div className="relative mt-1.5">
              <select
                name="lifecycleStage"
                value={lifecycleStage}
                onChange={(event) => setLifecycleStage(event.target.value)}
                className="h-10 w-full appearance-none rounded-[5px] border border-[#DCDDD6] bg-white pl-3 pr-8 font-['Space_Grotesk'] text-[14px] text-[#1B1C18] outline-none transition-colors hover:border-[#CFCFC7] focus:border-[#7852D6] focus:ring-2 focus:ring-[#7852D6]/10"
              >
                <option value="">Not set</option>
                {LIFECYCLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 20 20"
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#747878]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 8 4 4 4-4" />
              </svg>
            </div>
          </label>
        </div>

        <label className={LABEL_CLASS}>
          Tags
          <input
            name="tags"
            value={tagsInput}
            onChange={(event) => handleTagsChange(event.target.value)}
            maxLength={TAGS_INPUT_MAX_LENGTH}
            className={INPUT_CLASS}
            placeholder="Interested, Website, Referral"
          />
          <span className="mt-1 flex items-center justify-between font-normal text-[#92938C]">
            <span>Separate tags with commas · Maximum {MAX_TAGS_COUNT} tags.</span>
            <span>
              {
                tagsInput
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean).length
              }
              /{MAX_TAGS_COUNT}
            </span>
          </span>
          {tagsError ? (
            <span className="mt-1 block text-[12px] font-semibold text-[#A33A32]">
              {tagsError}
            </span>
          ) : null}
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className={LABEL_CLASS}>
            Country
            <input
              name="country"
              value={country}
              onChange={(event) => setCountry(event.target.value.slice(0, STANDARD_FIELD_MAX_LENGTH))}
              maxLength={STANDARD_FIELD_MAX_LENGTH}
              className={INPUT_CLASS}
              placeholder="Country"
            />
          </label>

          <label className={LABEL_CLASS}>
            State
            <input
              name="state"
              value={state}
              onChange={(event) => setState(event.target.value.slice(0, STANDARD_FIELD_MAX_LENGTH))}
              maxLength={STANDARD_FIELD_MAX_LENGTH}
              className={INPUT_CLASS}
              placeholder="State"
            />
          </label>

          <label className={LABEL_CLASS}>
            City
            <input
              name="city"
              value={city}
              onChange={(event) => setCity(event.target.value.slice(0, STANDARD_FIELD_MAX_LENGTH))}
              maxLength={STANDARD_FIELD_MAX_LENGTH}
              className={INPUT_CLASS}
              placeholder="City"
            />
          </label>
        </div>

        <label className="flex items-start gap-2 rounded-[5px] border border-[#E9E8E1] bg-white p-3 font-['Space_Grotesk'] text-[13px] leading-5 text-[#565B5B]">
          <input
            name="optOut"
            type="checkbox"
            checked={optOutChecked}
            onChange={(event) => setOptOutChecked(event.target.checked)}
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
            className="rounded-[5px] border border-[#F0D8D4] bg-[#FFF8F7] px-3 py-2.5 font-['Space_Grotesk'] text-[13px] leading-5 text-[#A33A32]"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#ECEBE5] pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-[4px] border border-[#DCDDD6] bg-white px-4 py-2.5 font-['Space_Grotesk'] text-[13px] font-semibold text-[#444748] hover:bg-[#F7F6F1] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-[4px] bg-[#1B1C18] px-4 py-2.5 font-['Space_Grotesk'] text-[13px] font-semibold text-white hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving…" : mode === "create" ? "Add contact" : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  );
}

type ImportPreviewRow = {
  rowNumber: number;
  fullName: string;
  phoneNumber: string;
  normalizedPhone: string;
  email: string;
  companyName: string;
  status: "valid" | "missing_required" | "invalid_phone" | "duplicate_in_file" | "exists_in_db";
  issues: string[];
  rawRow: Record<string, unknown>;
};

function ImportPanel({
  onCancel,
  onImported,
}: {
  onCancel: () => void;
  onImported: (message: string, importedRows?: ImportPreviewRow[], insertedCount?: number) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const importingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(
    () => ({
      valid: rows.filter((r) => r.status === "valid"),
      duplicates: rows.filter((r) => r.status === "duplicate_in_file"),
      existingDb: rows.filter((r) => r.status === "exists_in_db"),
      missingOrInvalid: rows.filter(
        (r) => r.status === "missing_required" || r.status === "invalid_phone",
      ),
    }),
    [rows],
  );

  async function handleFileSelect(selected: File | null) {
    setFile(selected);
    setRows([]);
    setError(null);
    if (!selected) return;

    if (selected.size > 5 * 1024 * 1024) {
      setError("The selected file exceeds the 5 MB upload limit.");
      return;
    }

    const extension = selected.name.toLowerCase().split(".").pop();
    if (extension !== "csv" && extension !== "xlsx") {
      setError("Use a CSV or XLSX file. XLS files are not supported.");
      return;
    }

    setParsing(true);
    try {
      const result = await previewContactImportAction(selected);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const previewRows = Array.isArray(result.data?.rows)
        ? (result.data.rows as ImportPreviewRow[])
        : [];
      setRows(previewRows);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to inspect the selected file.",
      );
    } finally {
      setParsing(false);
    }
  }

  function handleRemoveDuplicates() {
    setRows((prev) => prev.filter((r) => r.status !== "duplicate_in_file"));
  }

  function handleRemoveRow(rowNumber: number) {
    setRows((prev) => prev.filter((r) => r.rowNumber !== rowNumber));
  }

  async function handleImport() {
    if (!file || importingRef.current || busy || parsing || stats.valid.length === 0) return;

    importingRef.current = true;
    setBusy(true);
    setError(null);

    try {
      const validPayload = stats.valid.map((r) => r.rawRow);
      const result = await bulkCreateContactsAction(file.name.slice(0, 255), validPayload);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const data = result.data ?? {};
      const inserted = typeof data.inserted === "number" ? data.inserted : stats.valid.length;
      const skippedParts: string[] = [];
      if (stats.duplicates.length > 0) {
        skippedParts.push(`${formatNumber(stats.duplicates.length)} duplicate${stats.duplicates.length === 1 ? "" : "s"} removed`);
      }
      if (stats.existingDb.length > 0) {
        skippedParts.push(`${formatNumber(stats.existingDb.length)} already in database skipped`);
      }
      if (stats.missingOrInvalid.length > 0) {
        skippedParts.push(`${formatNumber(stats.missingOrInvalid.length)} missing required fields skipped`);
      }

      const summarySuffix = skippedParts.length > 0 ? ` (${skippedParts.join(", ")})` : "";
      onImported(
        `Imported ${formatNumber(inserted)} contact${inserted === 1 ? "" : "s"}${summarySuffix}.`,
        stats.valid,
        inserted,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The contact import failed.",
      );
    } finally {
      importingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[8px] border border-[#DCD5ED] bg-[#FCFBFF] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-['Space_Grotesk'] text-[12px] font-bold uppercase tracking-[0.1em] text-[#806DB2]">
            Contact import
          </p>
          <h2 className="mt-1 font-['Newsreader'] text-[25px] leading-tight text-[#1B1C18] sm:text-[26px]">
            Import a contact list
          </h2>
          <p className="mt-1 max-w-[620px] font-['Space_Grotesk'] text-[13px] leading-5 text-[#747878]">
            Upload up to 500 contacts in CSV or XLSX format. Name and phone number are required; duplicates, existing database records and incomplete rows are flagged and skipped automatically.
          </p>
        </div>

        <a
          href="/contact-import-template.csv"
          download
          className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#644ABB] underline underline-offset-2"
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
        <span className="font-['Space_Grotesk'] text-[15px] font-semibold text-[#1B1C18]">
          {file ? file.name : "Choose your contact file"}
        </span>
        <span className="font-['Space_Grotesk'] text-[12px] text-[#747878]">
          CSV or Excel XLSX · Maximum 5 MB · Up to 500 contact rows
        </span>
        <input
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(event) => {
            void handleFileSelect(event.target.files?.[0] ?? null);
          }}
        />
      </label>

      {file ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[5px] border border-[#E9E8E1] bg-white p-3">
          <div className="min-w-0">
            <p className="truncate font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
              {file.name}
            </p>
            <p className="mt-1 font-['Space_Grotesk'] text-[12px] text-[#747878]">
              {(file.size / 1024).toFixed(1)} KB {parsing ? "· Validating rows…" : rows.length > 0 ? `· ${formatNumber(rows.length)} rows inspected` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              setRows([]);
              setError(null);
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[5px] border border-[#EAD8D5] bg-[#FFF8F7] px-3 py-1.5 font-['Space_Grotesk'] text-[13px] font-semibold text-[#A33A32] transition-colors hover:bg-[#FCECE9]"
          >
            Remove file
          </button>
        </div>
      ) : null}

      <div className="mt-3 rounded-[4px] bg-[#F5F4ED] px-3 py-2.5 font-['Space_Grotesk'] text-[12px] leading-5 text-[#565B5B]">
        Required columns: <strong>Full Name</strong> and <strong>Phone Number</strong>. Optional columns include email, company name, job title, city, state, country. Ten-digit Indian mobile numbers are normalized with +91.
      </div>

      {rows.length > 0 ? (
        <div className="mt-4 space-y-3 rounded-[6px] border border-[#E6E4DC] bg-white p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 font-['Space_Grotesk'] text-[12px] font-semibold">
              <span className="rounded-full border border-[#CDE5D4] bg-[#EFF8F1] px-2.5 py-1 text-[#34734B]">
                {formatNumber(stats.valid.length)} ready to save
              </span>
              {stats.duplicates.length > 0 ? (
                <span className="rounded-full border border-[#F0DFB4] bg-[#FFFBEB] px-2.5 py-1 text-[#8D6418]">
                  {formatNumber(stats.duplicates.length)} duplicate{stats.duplicates.length === 1 ? "" : "s"}
                </span>
              ) : null}
              {stats.existingDb.length > 0 ? (
                <span className="rounded-full border border-[#D9D0EC] bg-[#F3EFFA] px-2.5 py-1 text-[#644ABB]">
                  {formatNumber(stats.existingDb.length)} already in database
                </span>
              ) : null}
              {stats.missingOrInvalid.length > 0 ? (
                <span className="rounded-full border border-[#F0D8D4] bg-[#FFF4F2] px-2.5 py-1 text-[#A33A32]">
                  {formatNumber(stats.missingOrInvalid.length)} missing required / invalid
                </span>
              ) : null}
            </div>

            {stats.duplicates.length > 0 ? (
              <button
                type="button"
                onClick={handleRemoveDuplicates}
                className="rounded-[5px] border border-[#E5C98B] bg-[#FFFBEB] px-3 py-1.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#8D6418] hover:bg-[#FEF3C7]"
              >
                Remove duplicates ({stats.duplicates.length})
              </button>
            ) : null}
          </div>

          <div className="max-h-[300px] overflow-auto rounded-[5px] border border-[#ECEBE5]">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead className="sticky top-0 border-b border-[#ECEBE5] bg-[#FBFAF6]">
                <tr>
                  <th className="px-3 py-2 font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.08em] text-[#85877F]">Row</th>
                  <th className="px-3 py-2 font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.08em] text-[#85877F]">Name</th>
                  <th className="px-3 py-2 font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.08em] text-[#85877F]">Phone number</th>
                  <th className="px-3 py-2 font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.08em] text-[#85877F]">Optional details</th>
                  <th className="px-3 py-2 font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.08em] text-[#85877F]">Validation</th>
                  <th className="px-3 py-2 text-right font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.08em] text-[#85877F]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EFE9]">
                {rows.map((row) => {
                  const isMissing = row.status === "missing_required" || row.status === "invalid_phone";
                  const isDuplicate = row.status === "duplicate_in_file";
                  const isExisting = row.status === "exists_in_db";
                  const rowBg = isMissing
                    ? "bg-[#FFF6F5]"
                    : isDuplicate
                      ? "bg-[#FFFDF5]"
                      : isExisting
                        ? "bg-[#F9F7FD]"
                        : "bg-white";

                  return (
                    <tr key={row.rowNumber} className={rowBg}>
                      <td className="px-3 py-2 font-['Space_Grotesk'] text-[12px] text-[#747878]">
                        #{row.rowNumber}
                      </td>
                      <td className="px-3 py-2 font-['Space_Grotesk'] text-[13px]">
                        {row.fullName ? (
                          <span className="font-semibold text-[#1B1C18]">{row.fullName}</span>
                        ) : (
                          <span className="rounded bg-[#FDE8E6] px-1.5 py-0.5 text-[12px] font-semibold text-[#A33A32]">
                            Missing name
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-['Space_Grotesk'] text-[13px]">
                        {row.phoneNumber ? (
                          <span className="text-[#1B1C18]">{row.normalizedPhone || row.phoneNumber}</span>
                        ) : (
                          <span className="rounded bg-[#FDE8E6] px-1.5 py-0.5 text-[12px] font-semibold text-[#A33A32]">
                            Missing phone
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-['Space_Grotesk'] text-[12px] text-[#747878]">
                        {[row.email, row.companyName].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-3 py-2 font-['Space_Grotesk'] text-[12px]">
                        {row.status === "valid" ? (
                          <span className="font-semibold text-[#34734B]">Ready to import</span>
                        ) : (
                          <span
                            className={`font-semibold ${
                              isMissing
                                ? "text-[#A33A32]"
                                : isDuplicate
                                  ? "text-[#8D6418]"
                                  : "text-[#644ABB]"
                            }`}
                          >
                            {row.issues.join("; ")} · Will skip
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.rowNumber)}
                          className="rounded-[4px] border border-[#EAD8D5] bg-white px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#A33A32] hover:bg-[#FFF8F7]"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-3 rounded-[5px] border border-[#F0D8D4] bg-[#FFF8F7] px-3 py-2.5 font-['Space_Grotesk'] text-[13px] leading-5 text-[#A33A32]"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#ECEBE5] pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-[4px] border border-[#DCDDD6] bg-white px-4 py-2.5 font-['Space_Grotesk'] text-[13px] font-semibold text-[#444748] hover:bg-[#F7F6F1] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={!file || parsing || busy || stats.valid.length === 0}
          className="rounded-[4px] bg-[#1B1C18] px-4 py-2.5 font-['Space_Grotesk'] text-[13px] font-semibold text-white hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? "Importing…"
            : stats.valid.length > 0
              ? `Import ${formatNumber(stats.valid.length)} contact${stats.valid.length === 1 ? "" : "s"}`
              : "Import contacts"}
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
  params.set("limit", String(filters.limit));
  params.set("offset", String(offset));
  return `/dashboard/contacts?${params.toString()}`;
}

function computeLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) matrix[i]![0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0]![j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  return matrix[a.length]![b.length]!;
}

function isSubsequence(query: string, target: string): boolean {
  let qi = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) qi++;
  }
  return qi === query.length;
}

function scoreContactMatch(contact: ContactRecord, rawQuery: string): number {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return 1;

  const name = contact.fullName.toLowerCase();
  const phone = contact.phoneNumber.toLowerCase();
  const phoneDigits = contact.phoneNumber.replace(/\D/g, "");
  const queryDigits = q.replace(/\D/g, "");
  const email = contact.email.toLowerCase();
  const company = contact.companyName.toLowerCase();
  const jobTitle = contact.jobTitle.toLowerCase();
  const city = contact.city.toLowerCase();
  const tags = contact.tags.join(" ").toLowerCase();

  if (
    name === q ||
    email === q ||
    company === q ||
    phone === q ||
    (queryDigits.length >= 4 && phoneDigits === queryDigits)
  ) {
    return 100;
  }

  if (
    name.startsWith(q) ||
    email.startsWith(q) ||
    company.startsWith(q) ||
    phone.startsWith(q)
  ) {
    return 85;
  }

  const words = `${name} ${company} ${email} ${jobTitle} ${city}`.split(/[\s@._-]+/).filter(Boolean);
  if (words.some((w) => w.startsWith(q))) {
    return 75;
  }

  if (
    name.includes(q) ||
    email.includes(q) ||
    company.includes(q) ||
    phone.includes(q) ||
    (queryDigits.length >= 2 && phoneDigits.includes(queryDigits)) ||
    jobTitle.includes(q) ||
    city.includes(q) ||
    tags.includes(q)
  ) {
    return 65;
  }

  const queryTokens = q.split(/\s+/).filter(Boolean);
  let fuzzyScore = 0;

  for (const token of queryTokens) {
    if (token.length < 2) continue;
    let tokenMatched = false;

    for (const word of words) {
      if (word.includes(token)) {
        fuzzyScore += 30;
        tokenMatched = true;
        break;
      }
      const maxEdits = token.length <= 4 ? 1 : 2;
      if (Math.abs(word.length - token.length) <= maxEdits) {
        const dist = computeLevenshtein(token, word);
        if (dist <= maxEdits) {
          fuzzyScore += 25 - dist * 5;
          tokenMatched = true;
          break;
        }
      }
    }

    if (!tokenMatched && token.length >= 3 && (isSubsequence(token, name) || isSubsequence(token, company) || isSubsequence(token, email))) {
      fuzzyScore += 15;
    }
  }

  return fuzzyScore;
}

function normalizeFetchedContact(raw: unknown): ContactRecord | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== "string") return null;

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

export function ContactsDashboard({
  contacts: initialContacts,
  total: initialTotal,
  filters: initialFilters,
  initialError,
  startInImportMode = false,
}: ContactsDashboardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [contactsList, setContactsList] = useState<ContactRecord[]>(initialContacts);
  const [totalCount, setTotalCount] = useState<number>(initialTotal);
  const [activeFilters, setActiveFilters] = useState<ContactFilters>(initialFilters);

  const [searchInput, setSearchInput] = useState(initialFilters.search);
  const [statusInput, setStatusInput] = useState(initialFilters.status);
  const [lifecycleInput, setLifecycleInput] = useState(initialFilters.lifecycleStage);
  const [filtering, setFiltering] = useState(false);

  const [showImport, setShowImport] = useState(startInImportMode);
  const [editor, setEditor] = useState<{
    mode: EditorMode;
    contact: ContactRecord | null;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteContact, setPendingDeleteContact] = useState<{ contact: ContactRecord; confirmationMessage: string } | null>(null);

  const requestCounterRef = useRef(0);
  const isInitialMountRef = useRef(true);
  const skipNextPropSyncRef = useRef(false);

  useEffect(() => {
    if (skipNextPropSyncRef.current) {
      skipNextPropSyncRef.current = false;
      return;
    }
    setContactsList(initialContacts);
    setTotalCount(initialTotal);
  }, [initialContacts, initialTotal]);

  const syncUrlWithoutReload = useCallback((nextFilters: ContactFilters) => {
    if (typeof window === "undefined") return;
    const href = buildPageHref(nextFilters, nextFilters.offset);
    window.history.replaceState(null, "", href);
  }, []);

  const executeQuery = useCallback(
    async (nextFilters: ContactFilters, options?: { silent?: boolean }) => {
      const requestId = ++requestCounterRef.current;
      if (!options?.silent) {
        setFiltering(true);
      }
      setActionError(null);
      syncUrlWithoutReload(nextFilters);

      try {
        const result = await fetchContactsAction({
          search: nextFilters.search,
          status: nextFilters.status,
          lifecycleStage: nextFilters.lifecycleStage,
          limit: nextFilters.limit,
          offset: nextFilters.offset,
        });

        if (requestId !== requestCounterRef.current) return;

        if (!result.ok) {
          setActionError(result.error);
          return;
        }

        const rows = Array.isArray(result.data.contacts) ? result.data.contacts : [];
        const normalized = rows
          .map(normalizeFetchedContact)
          .filter((item): item is ContactRecord => item !== null);
        const nextTotal =
          typeof result.data.total === "number" ? result.data.total : normalized.length;

        setActiveFilters(nextFilters);
        setContactsList(normalized);
        setTotalCount(nextTotal);
      } catch (cause) {
        if (requestId !== requestCounterRef.current) return;
        setActionError(
          cause instanceof Error ? cause.message : "Unable to load contacts.",
        );
      } finally {
        if (requestId === requestCounterRef.current) {
          setFiltering(false);
        }
      }
    },
    [syncUrlWithoutReload],
  );

  useEffect(() => {
    setActiveFilters(initialFilters);
    setSearchInput(initialFilters.search);
    setStatusInput(initialFilters.status);
    setLifecycleInput(initialFilters.lifecycleStage);
  }, [initialFilters]);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    const trimmed = searchInput.trim();
    if (trimmed === activeFilters.search) return;

    const timer = window.setTimeout(() => {
      void executeQuery({
        ...activeFilters,
        search: trimmed,
        offset: 0,
      });
    }, 260);

    return () => window.clearTimeout(timer);
  }, [searchInput, activeFilters, executeQuery]);

  const displayedContacts = useMemo(() => {
    const query = searchInput.trim();
    if (!query) return contactsList;

    const scored = contactsList.map((contact, idx) => ({
      contact,
      idx,
      score: scoreContactMatch(contact, query),
    }));

    return scored
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx))
      .map((entry) => entry.contact);
  }, [contactsList, searchInput]);

  const currentPage = Math.floor(activeFilters.offset / activeFilters.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / activeFilters.limit));
  const rangeStart = totalCount === 0 ? 0 : activeFilters.offset + 1;
  const rangeEnd = Math.min(activeFilters.offset + displayedContacts.length, totalCount);

  const pageStats = useMemo(
    () => ({
      pending: displayedContacts.filter((contact) => contact.status === "pending" && !contact.optOut).length,
      optedOut: displayedContacts.filter((contact) => contact.optOut || contact.status === "do_not_call").length,
      completed: displayedContacts.filter((contact) => contact.status === "completed").length,
    }),
    [displayedContacts],
  );

  const hasPendingFilterInput = Boolean(
    searchInput.trim() || statusInput || lifecycleInput,
  );

  const hasFilterChanges =
    searchInput.trim() !== activeFilters.search ||
    statusInput !== activeFilters.status ||
    lifecycleInput !== activeFilters.lifecycleStage;

  const canApplyFilter = hasPendingFilterInput && hasFilterChanges;

  const hasActiveFilters = Boolean(
    searchInput.trim() || statusInput || lifecycleInput || activeFilters.search || activeFilters.status || activeFilters.lifecycleStage,
  );

  function cleanImportQuery() {
    syncUrlWithoutReload(activeFilters);
  }

  function closeImport() {
    setShowImport(false);
    cleanImportQuery();
  }

  function handleSaved(message: string, savedContact?: ContactRecord) {
    const wasCreating = editor?.mode === "create";
    setEditor(null);
    setShowImport(false);
    setNotice(message);
    setActionError(null);
    skipNextPropSyncRef.current = true;

    if (savedContact) {
      if (wasCreating) {
        setContactsList((prev) => {
          const filtered = prev.filter((item) => item.id !== savedContact.id);
          return [savedContact, ...filtered].slice(0, activeFilters.limit);
        });
        setTotalCount((prev) => prev + 1);
      } else {
        setContactsList((prev) =>
          prev.map((item) => (item.id === savedContact.id ? savedContact : item)),
        );
      }
    }

    void executeQuery(activeFilters, { silent: true });
    router.refresh();
  }

  function handleImported(
    message: string,
    importedRows?: ImportPreviewRow[],
    insertedCount?: number,
  ) {
    setShowImport(false);
    setEditor(null);
    setNotice(message);
    setActionError(null);
    skipNextPropSyncRef.current = true;

    if (importedRows && importedRows.length > 0) {
      const nowIso = new Date().toISOString();
      const newRecords: ContactRecord[] = importedRows.map((row, index) => ({
        id: `temp-import-${Date.now()}-${index}`,
        fullName: row.fullName,
        secondaryName: "",
        phoneNumber: row.normalizedPhone || row.phoneNumber,
        phoneNumberRaw: row.phoneNumber,
        email: row.email,
        companyName: row.companyName,
        jobTitle: typeof row.rawRow.jobTitle === "string" ? row.rawRow.jobTitle : "",
        department: typeof row.rawRow.department === "string" ? row.rawRow.department : "",
        industry: typeof row.rawRow.industry === "string" ? row.rawRow.industry : "",
        city: typeof row.rawRow.city === "string" ? row.rawRow.city : "",
        state: typeof row.rawRow.state === "string" ? row.rawRow.state : "",
        country: typeof row.rawRow.country === "string" ? row.rawRow.country : "",
        timezone: "",
        leadScore: null,
        lifecycleStage:
          typeof row.rawRow.lifecycleStage === "string" ? row.rawRow.lifecycleStage : "lead",
        tags: [],
        parentName: "",
        studentName: "",
        courseOrStream: "",
        status: "pending",
        optOut: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      }));

      setContactsList((prev) => [...newRecords, ...prev].slice(0, activeFilters.limit));
      setTotalCount((prev) => prev + (insertedCount ?? newRecords.length));
    }

    void executeQuery(activeFilters, { silent: true });
    router.refresh();
  }

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void executeQuery({
      ...activeFilters,
      search: searchInput.trim(),
      status: statusInput,
      lifecycleStage: lifecycleInput,
      offset: 0,
    });
  }

  function handleClearFilters() {
    const cleared: ContactFilters = {
      search: "",
      status: "",
      lifecycleStage: "",
      limit: activeFilters.limit,
      offset: 0,
    };
    setSearchInput("");
    setStatusInput("");
    setLifecycleInput("");
    setActiveFilters(cleared);
    void executeQuery(cleared);
  }

  function handleDelete(contact: ContactRecord) {
    if (deletingId || pendingDeleteContact) return;
    const confirmationMessage = contact.optOut
      ? `Delete ${displayName(contact)} from this workspace? This also removes the contact's do-not-call suppression record. Proceed only if your retention policy allows it. This cannot be undone.`
      : `Delete ${displayName(contact)} from this workspace? This cannot be undone.`;
    setPendingDeleteContact({ contact, confirmationMessage });
  }

  async function confirmDeleteContact() {
    const contact = pendingDeleteContact?.contact;
    if (!contact || deletingId) return;

    const previousContacts = contactsList;
    const previousTotal = totalCount;

    setDeletingId(contact.id);
    setActionError(null);
    skipNextPropSyncRef.current = true;
    setContactsList((prev) => prev.filter((item) => item.id !== contact.id));
    setTotalCount((prev) => Math.max(0, prev - 1));

    const evictContactFromCache = (targetId: string) => {
      setContactsList((prev) => prev.filter((item) => item.id !== targetId));
      queryClient.setQueriesData<Record<string, unknown>>(
        { queryKey: ["dashboard", "contacts"] },
        (cached) => {
          if (!cached || !Array.isArray(cached.contacts)) return cached;
          const filtered = cached.contacts.filter(
            (item) =>
              !(
                typeof item === "object" &&
                item !== null &&
                "id" in item &&
                (item as { id?: unknown }).id === targetId
              ),
          );
          if (filtered.length === cached.contacts.length) return cached;
          return {
            ...cached,
            contacts: filtered,
            total: typeof cached.total === "number" ? Math.max(0, cached.total - 1) : filtered.length,
          };
        },
      );
    };

    try {
      const result = await deleteContactAction(contact.id);
      const alreadyGone =
        !result.ok &&
        (result.status === 404 || /not found/i.test(result.error));
      if (!result.ok && !alreadyGone) {
        setContactsList(previousContacts);
        setTotalCount(previousTotal);
        setActionError(result.error);
        return;
      }
      evictContactFromCache(contact.id);
      setNotice(
        alreadyGone
          ? `${displayName(contact)} was already removed. Synced contact list.`
          : `${displayName(contact)} was deleted.`,
      );
      setPendingDeleteContact(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard", "contacts"] }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.workspaceSetup() }),
      ]);
      void executeQuery(activeFilters, { silent: true });
      router.refresh();
    } catch (cause) {
      setContactsList(previousContacts);
      setTotalCount(previousTotal);
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
          <h1 className="font-['Newsreader'] text-[36px] leading-tight tracking-[-0.8px] text-[#1B1C18] sm:text-[42px]">
            Contacts
          </h1>
          <p className="mt-2 max-w-[620px] font-['Space_Grotesk'] text-[14px] leading-[1.55] text-[#747878]">
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
            className="inline-flex h-10 items-center gap-2 rounded-[5px] border border-[#DCDDD6] bg-white px-4 font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] transition-colors hover:bg-[#F7F6F1]"
          >
            <span aria-hidden="true">↓</span>
            Import contacts
          </button>
          <button
            type="button"
            onClick={() => {
              setShowImport(false);
              setEditor({ mode: "create", contact: null });
            }}
            className="inline-flex h-10 items-center gap-2 rounded-[5px] bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[13px] font-semibold text-white transition-colors hover:bg-[#34352F]"
          >
            <span className="text-[16px] leading-none" aria-hidden="true">+</span>
            Add contact
          </button>
        </div>
      </header>

      <ToastNotice message={notice} onDismiss={() => setNotice(null)} />

      {actionError ? (
        <div
          role="alert"
          className="rounded-[6px] border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3 font-['Space_Grotesk'] text-[13px] leading-5 text-[#A33A32]"
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
          onImported={handleImported}
        />
      ) : null}

      {initialError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3">
          <p className="font-['Space_Grotesk'] text-[13px] leading-5 text-[#A33A32]">
            Contacts could not be loaded: {initialError}
          </p>
          <button
            type="button"
            onClick={() => void executeQuery(activeFilters)}
            className="rounded-[4px] border border-[#E5C7C3] bg-white px-3 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-[#8D3028]"
          >
            Try again
          </button>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Contact metrics">
        <MetricCard
          label="Workspace contacts"
          value={formatNumber(totalCount)}
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
              <h2 className="font-['Space_Grotesk'] text-[15px] font-semibold text-[#1B1C18] sm:text-[16px]">
                Contact directory
              </h2>
              <p className="mt-1 font-['Space_Grotesk'] text-[12px] text-[#85877F]">
                Search by name, phone number, email, or company, or filter by status and lifecycle stage.
              </p>
            </div>
            <a
              href="/contact-import-template.csv"
              download
              className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#644ABB] underline underline-offset-2"
            >
              Download CSV template
            </a>
          </div>

          <form
            onSubmit={handleApplyFilters}
            className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.5fr)_repeat(2,minmax(160px,0.85fr))_auto]"
          >
            <div className="relative sm:col-span-2 xl:col-span-1">
              <label className="sr-only" htmlFor="contact-search">Search contacts</label>
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#85877F]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                id="contact-search"
                name="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search name, phone, email or company"
                className="h-10 w-full min-w-0 rounded-[5px] border border-[#DCDDD6] bg-[#FFFEFB] pl-9 pr-8 font-['Space_Grotesk'] text-[13px] text-[#1B1C18] outline-none transition-colors placeholder:text-[#A0A19A] focus:border-[#7852D6] focus:ring-2 focus:ring-[#7852D6]/10"
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded px-1 font-['Space_Grotesk'] text-[13px] text-[#85877F] hover:text-[#1B1C18]"
                >
                  ×
                </button>
              ) : null}
            </div>

            <div className="relative">
              <label className="sr-only" htmlFor="contact-status">Contact status</label>
              <select
                id="contact-status"
                name="status"
                value={statusInput}
                onChange={(event) => setStatusInput(event.target.value)}
                className="h-10 w-full appearance-none rounded-[5px] border border-[#DCDDD6] bg-white pl-3 pr-8 font-['Space_Grotesk'] text-[13px] font-medium text-[#1B1C18] outline-none transition-colors hover:border-[#CFCFC7] focus:border-[#7852D6] focus:ring-2 focus:ring-[#7852D6]/10"
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="queued">Queued</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="do_not_call">Do not call</option>
                <option value="invalid">Invalid</option>
              </select>
              <svg
                viewBox="0 0 20 20"
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#747878]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 8 4 4 4-4" />
              </svg>
            </div>

            <div className="relative">
              <label className="sr-only" htmlFor="contact-lifecycle">Lifecycle stage</label>
              <select
                id="contact-lifecycle"
                name="lifecycleStage"
                value={lifecycleInput}
                onChange={(event) => setLifecycleInput(event.target.value)}
                className="h-10 w-full appearance-none rounded-[5px] border border-[#DCDDD6] bg-white pl-3 pr-8 font-['Space_Grotesk'] text-[13px] font-medium text-[#1B1C18] outline-none transition-colors hover:border-[#CFCFC7] focus:border-[#7852D6] focus:ring-2 focus:ring-[#7852D6]/10"
              >
                <option value="">All lifecycle stages</option>
                {LIFECYCLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <svg
                viewBox="0 0 20 20"
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#747878]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 8 4 4 4-4" />
              </svg>
            </div>

            <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
              <button
                type="submit"
                disabled={filtering || !canApplyFilter}
                className="h-10 flex-1 rounded-[5px] bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[13px] font-semibold text-white transition-colors hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {filtering ? "Filtering…" : "Apply filter"}
              </button>
              <button
                type="button"
                onClick={handleClearFilters}
                disabled={filtering || !hasActiveFilters}
                className="inline-flex h-10 items-center justify-center rounded-[5px] border border-[#DCDDD6] bg-white px-3.5 font-['Space_Grotesk'] text-[13px] font-semibold text-[#565B5B] transition-colors hover:bg-[#F7F6F1] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Clear filter
              </button>
            </div>
          </form>
        </div>

        {displayedContacts.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#ECEBE5] bg-[#FBFAF6]">
                    <th className="px-4 py-3 font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.08em] text-[#85877F] sm:px-5">Contact</th>
                    <th className="px-4 py-3 font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.08em] text-[#85877F]">Company</th>
                    <th className="px-4 py-3 font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.08em] text-[#85877F]">Lifecycle</th>
                    <th className="px-4 py-3 font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.08em] text-[#85877F]">Status</th>
                    <th className="px-4 py-3 font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.08em] text-[#85877F]">Added</th>
                    <th className="px-4 py-3 text-right font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.08em] text-[#85877F]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EFE9]">
                  {displayedContacts.map((contact) => (
                    <tr key={contact.id} className="align-middle transition-colors hover:bg-[#FFFEFB]">
                      <td className="px-4 py-3.5 sm:px-5">
                        <div className="min-w-0">
                          <p className="max-w-[220px] truncate font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                            {displayName(contact)}
                          </p>
                          <p className="mt-1 font-['Space_Grotesk'] text-[12px] text-[#747878]">
                            {contact.phoneNumber}
                          </p>
                          {contact.email ? (
                            <p className="mt-0.5 max-w-[220px] truncate font-['Space_Grotesk'] text-[11px] text-[#92938C]">
                              {contact.email}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="max-w-[170px] truncate font-['Space_Grotesk'] text-[12px] text-[#444748]">
                          {contact.companyName || "—"}
                        </p>
                        {contact.jobTitle ? (
                          <p className="mt-1 max-w-[170px] truncate font-['Space_Grotesk'] text-[11px] text-[#92938C]">
                            {contact.jobTitle}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-['Space_Grotesk'] text-[12px] capitalize text-[#565B5B]">
                          {contact.lifecycleStage ? contact.lifecycleStage.replaceAll("_", " ") : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={contact.status} />
                      </td>
                      <td className="px-4 py-3.5 font-['Space_Grotesk'] text-[12px] text-[#747878]">
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
                            className="rounded-[4px] border border-[#E5E1EC] bg-white px-2.5 py-1.5 font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB] hover:bg-[#F7F5FB]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(contact)}
                            disabled={deletingId === contact.id}
                            title={contact.optOut ? "Deleting an opted-out contact also removes its suppression record." : "Delete contact"}
                            className="rounded-[4px] border border-[#EAD8D5] bg-white px-2.5 py-1.5 font-['Space_Grotesk'] text-[11px] font-semibold text-[#A33A32] hover:bg-[#FFF8F7] disabled:cursor-not-allowed disabled:opacity-40"
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
              <p className="font-['Space_Grotesk'] text-[12px] text-[#85877F]">
                Showing {rangeStart}–{rangeEnd} of {formatNumber(totalCount)} contacts
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activeFilters.offset <= 0 || filtering}
                  onClick={() =>
                    void executeQuery({
                      ...activeFilters,
                      offset: Math.max(0, activeFilters.offset - activeFilters.limit),
                    })
                  }
                  className="rounded-[4px] border border-[#DCDDD6] bg-white px-3 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748] hover:bg-[#F7F6F1] disabled:pointer-events-none disabled:text-[#B5B6B0]"
                >
                  Previous
                </button>
                <span className="min-w-[76px] text-center font-['Space_Grotesk'] text-[12px] tabular-nums text-[#747878]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages || filtering}
                  onClick={() =>
                    void executeQuery({
                      ...activeFilters,
                      offset: activeFilters.offset + activeFilters.limit,
                    })
                  }
                  className="rounded-[4px] border border-[#DCDDD6] bg-white px-3 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748] hover:bg-[#F7F6F1] disabled:pointer-events-none disabled:text-[#B5B6B0]"
                >
                  Next
                </button>
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
            <h3 className="mt-4 font-['Newsreader'] text-[25px] leading-tight text-[#1B1C18] sm:text-[26px]">
              {!hasActiveFilters ? "Your contacts start here" : "No contacts match these filters"}
            </h3>
            <p className="mt-2 max-w-[400px] font-['Space_Grotesk'] text-[13px] leading-5 text-[#85877F]">
              {!hasActiveFilters
                ? "Add an individual contact or import a CSV/XLSX list. Contacts are not called until they are explicitly added to an approved campaign."
                : "Try clearing one or more filters, or use a different search term."}
            </p>
            {!hasActiveFilters ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditor({ mode: "create", contact: null })}
                  className="rounded-[5px] bg-[#1B1C18] px-4 py-2.5 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#34352F]"
                >
                  Add your first contact
                </button>
                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  className="rounded-[5px] border border-[#DCDDD6] bg-white px-4 py-2.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748] hover:bg-[#F7F6F1]"
                >
                  Import a contact list
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-5 rounded-[5px] border border-[#DCDDD6] bg-white px-4 py-2.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748] hover:bg-[#F7F6F1]"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </section>

      <p className="font-['Space_Grotesk'] text-[12px] leading-5 text-[#92938C]">
        Contacts marked Do not call remain visible for compliance and suppression. They are excluded from outbound calling. Importing contacts never starts a campaign automatically.
      </p>
    </div>
  );
}
