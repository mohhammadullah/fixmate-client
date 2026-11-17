"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import ServiceImageUpload from "@/components/dashboard/ServiceImageUpload";
import { roleFromUser } from "@/components/dashboard/DashboardSidebar";
import {
  SERVICE_CATEGORIES,
  type ServiceCategory,
} from "@/components/dashboard/MyBookings";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

/* ================================================================== */
/*  Types — mirror the backend updateServiceSchema (all fields optional). */
/*  PATCH /api/services/:id accepts only client-editable fields; the      */
/*  server derives technicianId from the JWT and resets approvalStatus    */
/*  to "pending". No ownership/system field is ever sent from the client. */
/* ================================================================== */

interface EditFormValues {
  title?: string;
  category?: string;
  description?: string;
  overview?: string;
  hourlyRate?: string;
  securityDeposit?: string;
  maxCapacity?: string;
  location?: string;
  image?: string;
}

interface ServiceData {
  id: string;
  title: string;
  category: string;
  location: string;
  image: string;
  hourlyRate: number;
  securityDeposit: number;
  maxCapacity: number;
  amenities: string[];
  overview: string;
  description?: string;
  approvalStatus: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FieldIssue {
  field: string;
  message: string;
}

type ErrorKind =
  | "unauthorized"
  | "forbidden"
  | "notfound"
  | "conflict"
  | "network"
  | "server"
  | "validation";

class EditServiceError extends Error {
  readonly kind: ErrorKind;
  readonly issues: FieldIssue[];
  constructor(kind: ErrorKind, message: string, issues: FieldIssue[] = []) {
    super(message);
    this.name = "EditServiceError";
    this.kind = kind;
    this.issues = issues;
  }
}

/* ================================================================== */
/*  Helpers                                                             */
/* ================================================================== */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFieldIssues(body: unknown): FieldIssue[] {
  if (!isRecord(body) || !Array.isArray(body.errors)) return [];
  const issues: FieldIssue[] = [];
  for (const entry of body.errors) {
    if (!isRecord(entry)) continue;
    const field = typeof entry.field === "string" ? entry.field : "";
    const message =
      typeof entry.message === "string" && entry.message.length > 0 && entry.message.length <= 200
        ? entry.message
        : "This field is invalid.";
    if (field.length > 0) issues.push({ field, message });
  }
  return issues;
}

function parseFiniteNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function parseIntStrict(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isServiceCategory(value: string): value is ServiceCategory {
  return SERVICE_CATEGORIES.some((category) => category === value);
}

type FieldErrors = Partial<Record<string, string>>;

function validateEditForm(values: EditFormValues): FieldErrors {
  const errors: FieldErrors = {};
  const title = (values.title ?? "").trim();
  if (title.length > 0) {
    if (title.length < 3) errors.title = "Title must be at least 3 characters long.";
    if (title.length > 120) errors.title = "Title must be at most 120 characters long.";
  }
  if (values.category && !isServiceCategory(values.category)) {
    errors.category = `Category must be one of: ${SERVICE_CATEGORIES.join(", ")}.`;
  }
  const description = (values.description ?? "").trim();
  if (description.length > 0) {
    if (description.length < 10) errors.description = "Description must be at least 10 characters long.";
    if (description.length > 2000) errors.description = "Description must be at most 2000 characters long.";
  }
  const overview = (values.overview ?? "").trim();
  if (overview.length > 0) {
    if (overview.length < 10) errors.overview = "Overview must be at least 10 characters long.";
    if (overview.length > 5000) errors.overview = "Overview must be at most 5000 characters long.";
  }
  if (values.hourlyRate) {
    const value = parseFiniteNumber(values.hourlyRate);
    if (value === null) errors.hourlyRate = "Hourly rate must be a number.";
    else if (value <= 0) errors.hourlyRate = "Hourly rate must be greater than 0.";
    else if (value > 100000) errors.hourlyRate = "Hourly rate must be at most 100000.";
  }
  if (values.securityDeposit) {
    const value = parseFiniteNumber(values.securityDeposit);
    if (value === null) errors.securityDeposit = "Security deposit must be a number.";
    else if (value < 0) errors.securityDeposit = "Security deposit cannot be negative.";
    else if (value > 1000000) errors.securityDeposit = "Security deposit must be at most 1000000.";
  }
  if (values.maxCapacity) {
    const value = parseIntStrict(values.maxCapacity);
    if (value === null) errors.maxCapacity = "Max capacity must be a whole number.";
    else if (value < 1) errors.maxCapacity = "Max capacity must be at least 1.";
    else if (value > 1000) errors.maxCapacity = "Max capacity must be at most 1000.";
  }
  const location = (values.location ?? "").trim();
  if (location.length > 0) {
    if (location.length < 2) errors.location = "Location must be at least 2 characters long.";
    if (location.length > 200) errors.location = "Location must be at most 200 characters long.";
  }
  const image = (values.image ?? "").trim();
  if (image.length > 0) {
    if (image.length > 2048) errors.image = "Image must be at most 2048 characters long.";
    else if (!isValidHttpUrl(image)) errors.image = "Image must use http:// or https://.";
  }
  return errors;
}

function validateAmenity(candidate: string, existing: string[]): string | null {
  const trimmed = candidate.trim();
  if (trimmed.length === 0) return "Amenities cannot contain empty strings.";
  if (trimmed.length > 60) return "Each amenity must be at most 60 characters long.";
  if (existing.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
    return "That amenity is already in the list.";
  }
  if (existing.length >= 30) return "Amenities can contain at most 30 entries.";
  return null;
}

/* ================================================================== */
/*  API calls — JWT is retrieved dynamically per request cycle; never    */
/*  stored, logged, hardcoded or persisted.                              */
/* ================================================================== */

async function fetchAccessToken(): Promise<string> {
  let response: {
    data: unknown;
    error: null | ({ status: number } & Record<string, unknown>);
  };
  try {
    response = await authClient.$fetch<{ token: string }>("/token", { method: "GET" });
  } catch {
    throw new EditServiceError(
      "network",
      "Couldn't reach the FixMate server to verify your session. Check your connection and try again."
    );
  }
  if (response.error) {
    if (response.error.status === 401 || response.error.status === 403) {
      throw new EditServiceError("unauthorized", "Your session has expired. Sign in again to edit your service.");
    }
    throw new EditServiceError("server", "We couldn't verify your session with FixMate right now. Please try again.");
  }
  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new EditServiceError("server", "The FixMate server returned an unexpected session-token response.");
  }
  return data.token;
}

function parseService(raw: unknown): ServiceData {
  if (!isRecord(raw)) throw new Error("Unexpected service payload.");
  const requiredString = (key: string): string => {
    const value = raw[key];
    if (typeof value !== "string" || value.length === 0) throw new Error("Unexpected service payload.");
    return value;
  };
  const requiredNumber = (key: string): number => {
    const value = raw[key];
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Unexpected service payload.");
    return value;
  };
  return {
    id: requiredString("id"),
    title: requiredString("title"),
    category: requiredString("category"),
    location: requiredString("location"),
    image: typeof raw.image === "string" ? raw.image : "",
    hourlyRate: requiredNumber("hourlyRate"),
    securityDeposit: typeof raw.securityDeposit === "number" ? raw.securityDeposit : 0,
    maxCapacity: requiredNumber("maxCapacity"),
    amenities: Array.isArray(raw.amenities) ? raw.amenities.filter((a): a is string => typeof a === "string") : [],
    overview: typeof raw.overview === "string" ? raw.overview : "",
    description: typeof raw.description === "string" ? raw.description : undefined,
    approvalStatus: requiredString("approvalStatus"),
    isAvailable: raw.isAvailable === true,
    createdAt: requiredString("createdAt"),
    updatedAt: requiredString("updatedAt"),
  };
}

async function fetchOwnServices(signal: AbortSignal): Promise<ServiceData[]> {
  const token = await fetchAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/services/my?page=1&limit=100`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new EditServiceError("network", "Couldn't reach the FixMate server. Check your connection and try again.");
  }
  if (response.status === 401) {
    throw new EditServiceError("unauthorized", "Your session has expired. Sign in again to edit your service.");
  }
  if (response.status === 403) {
    throw new EditServiceError("forbidden", "Technician access only. This account isn't allowed to edit services.");
  }
  let body: unknown = null;
  try { body = await response.json(); } catch { /* handled below */ }
  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === "string" && body.message.length <= 200
      ? body.message
      : "The server couldn't load your services. Please try again.";
    throw new EditServiceError("server", message);
  }
  if (!isRecord(body) || body.success !== true || !Array.isArray(body.data)) {
    throw new EditServiceError("server", "The server returned an unexpected services payload.");
  }
  return body.data.map(parseService);
}

async function patchService(id: string, payload: Record<string, unknown>): Promise<string> {
  const token = await fetchAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/services/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  } catch {
    throw new EditServiceError("network", "Couldn't reach the FixMate server. Check your connection and try again.");
  }
  if (response.status === 401) {
    throw new EditServiceError("unauthorized", "Your session has expired. Sign in again to edit your service.");
  }
  if (response.status === 403) {
    throw new EditServiceError("forbidden", "Technician access only. This account isn't allowed to edit services.");
  }
  let body: unknown = null;
  try { body = await response.json(); } catch { /* handled below */ }
  const message = isRecord(body) && typeof body.message === "string" && body.message.length > 0 && body.message.length <= 200
    ? body.message
    : null;
  if (response.status === 400) {
    throw new EditServiceError("validation", message ?? "Some details were rejected. Please review the highlighted fields.", parseFieldIssues(body));
  }
  if (response.status === 404) {
    throw new EditServiceError("notfound", message ?? "Service not found. It may have been removed or is no longer available to you.");
  }
  if (response.status === 409) {
    throw new EditServiceError("conflict", message ?? "This service can't be updated right now. Please try again.");
  }
  if (!response.ok) {
    throw new EditServiceError("server", message ?? "The server couldn't update your service. Please try again.");
  }
  if (isRecord(body) && body.success === false) {
    throw new EditServiceError("server", message ?? "The server couldn't update your service. Please try again.");
  }
  return message ?? "Service updated successfully.";
}

/* ================================================================== */
/*  UI building blocks                                                  */
/* ================================================================== */

const inputBase =
  "w-full rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm text-foreground shadow-xs outline-none transition-colors duration-200 placeholder:text-muted hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25 aria-[invalid=true]:border-error/60";
const selectBase = `${inputBase} appearance-none pr-10`;

function Field({
  id,
  label,
  helper,
  error,
  children,
}: {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {helper && !error && <p className="mt-1.5 text-[11px] leading-snug text-muted">{helper}</p>}
      {error && <p role="alert" className="mt-1.5 text-[11px] font-medium leading-snug text-error">{error}</p>}
    </div>
  );
}

function FormSkeleton() {
  return (
    <div role="status" aria-label="Loading service…" className="space-y-6">
      <span className="sr-only">Loading service…</span>
      <div aria-hidden="true" className="h-[34rem] animate-pulse rounded-2xl border border-border bg-surface" />
    </div>
  );
}

function AccessDenied({ role }: { role: "customer" | "admin" | null }) {
  const roleLabel = role === "customer" ? "customer" : role === "admin" ? "admin" : null;
  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl border border-warning/40 bg-warning-soft text-warning">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-heading">This page is for technician accounts</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {roleLabel
          ? `You're signed in with a ${roleLabel} account, so you can't edit services here. Your dashboard only shows the sections your role can use.`
          : "Your account's role isn't recognized, so this section isn't available. Please contact FixMate support if this looks wrong."}
      </p>
      <Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md">
        Back to your dashboard
      </Link>
    </section>
  );
}

function ErrorPanel({ title, message }: { title: string; message: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-error/40 bg-error-soft/60 px-5 py-10 text-center sm:px-8">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mx-auto h-9 w-9 text-error">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <h2 className="mt-3 text-lg font-bold text-heading">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">{message}</p>
      <Link href="/dashboard/my-services" className="mt-5 inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted">
        Back to My Services
      </Link>
    </div>
  );
}

/* ================================================================== */
/*  Pre-filled edit form                                                */
/* ================================================================== */

function EditServiceForm({ serviceId, service }: { serviceId: string; service: ServiceData }) {
  const router = useRouter();
  const submitInFlightRef = useRef(false);

  const [values, setValues] = useState<EditFormValues>(() => ({
    title: service.title,
    category: service.category,
    description: service.description ?? "",
    overview: service.overview,
    hourlyRate: String(service.hourlyRate),
    securityDeposit: String(service.securityDeposit),
    maxCapacity: String(service.maxCapacity),
    location: service.location,
    image: service.image,
  }));
  const [amenities, setAmenities] = useState<string[]>(() => [...service.amenities]);
  const [amenityDraft, setAmenityDraft] = useState("");
  const [amenityError, setAmenityError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<{ kind: "unauthorized" | "forbidden"; message: string } | null>(null);

  useEffect(() => {
    if (updated === null) return;
    const timeout = window.setTimeout(() => router.replace("/dashboard/my-services"), 1800);
    return () => window.clearTimeout(timeout);
  }, [updated, router]);

  function updateField<K extends keyof EditFormValues>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormError(null);
  }

  function addAmenity(raw: string) {
    const mistake = validateAmenity(raw, amenities);
    if (mistake) {
      setAmenityError(mistake);
      return;
    }
    setAmenities((current) => [...current, raw.trim()]);
    setAmenityDraft("");
    setAmenityError(null);
    setErrors((current) => {
      if (!current.amenities) return current;
      const next = { ...current };
      delete next.amenities;
      return next;
    });
  }

  function removeAmenity(index: number) {
    setAmenities((current) => current.filter((_, i) => i !== index));
    setAmenityError(null);
  }

  function handleAmenityKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addAmenity(amenityDraft);
    } else if (event.key === "Backspace" && amenityDraft.length === 0 && amenities.length > 0) {
      removeAmenity(amenities.length - 1);
    }
  }

  function focusFirstInvalid(fieldErrors: FieldErrors) {
    const ids: Record<string, string> = {
      title: "edit-title", category: "edit-category", description: "edit-description",
      overview: "edit-overview", hourlyRate: "edit-hourly-rate",
      securityDeposit: "edit-security-deposit", maxCapacity: "edit-max-capacity",
      location: "edit-location", image: "edit-image", amenities: "edit-amenity-input",
    };
    for (const field of Object.keys(ids)) {
      if (fieldErrors[field]) {
        document.getElementById(ids[field])?.focus();
        return;
      }
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlightRef.current) return;

    const fieldErrors = validateEditForm(values);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      setFormError("Please fix the highlighted fields and try again.");
      focusFirstInvalid(fieldErrors);
      return;
    }

    submitInFlightRef.current = true;
    setSubmitting(true);
    setFormError(null);
    setErrors({});

    try {
      const draft = amenityDraft.trim();
      let effectiveAmenities = amenities;
      if (draft.length > 0) {
        const mistake = validateAmenity(draft, amenities);
        if (mistake) {
          setAmenityError(mistake);
          submitInFlightRef.current = false;
          setSubmitting(false);
          return;
        }
        effectiveAmenities = [...amenities, draft];
        setAmenities(effectiveAmenities);
        setAmenityDraft("");
      }

      // Only client-editable fields — no technicianId, no approvalStatus.
      const payload: Record<string, unknown> = {};
      if (values.title !== undefined) payload.title = values.title.trim();
      if (values.category !== undefined) payload.category = values.category;
      if (values.description !== undefined) payload.description = values.description.trim();
      if (values.overview !== undefined) payload.overview = values.overview.trim();
      if (values.hourlyRate) payload.hourlyRate = Number(values.hourlyRate);
      if (values.securityDeposit) payload.securityDeposit = Number(values.securityDeposit);
      if (values.maxCapacity) payload.maxCapacity = Number.parseInt(values.maxCapacity, 10);
      if (values.location !== undefined) payload.location = values.location.trim();
      // An empty image means "keep the current one" — omit it entirely so the
      // backend's strict image rule (min 1 char) is not violated.
      if (values.image !== undefined && values.image.trim().length > 0) {
        payload.image = values.image.trim();
      }
      if (effectiveAmenities.length > 0) payload.amenities = effectiveAmenities;

      const message = await patchService(serviceId, payload);
      setUpdated(message);
    } catch (error) {
      if (error instanceof EditServiceError) {
        if (error.kind === "unauthorized" || error.kind === "forbidden") {
          setSessionError({ kind: error.kind, message: error.message });
        } else if (error.kind === "validation") {
          const mapped: FieldErrors = {};
          for (const issue of error.issues) {
            if (!mapped[issue.field]) mapped[issue.field] = issue.message;
          }
          setErrors(mapped);
          setFormError(
            error.issues.length > 0
              ? "The server rejected some details — the highlighted fields need your attention."
              : error.message
          );
          focusFirstInvalid(mapped);
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError("Something went wrong while editing your service. Please try again.");
      }
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  if (sessionError) {
    const unauthorized = sessionError.kind === "unauthorized";
    return (
      <div role="alert" className="rounded-2xl border border-error/40 bg-error-soft/60 px-5 py-10 text-center sm:px-8">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mx-auto h-9 w-9 text-error">
          <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
        </svg>
        <h2 className="mt-3 text-lg font-bold text-heading">{unauthorized ? "Session expired" : "Technician access only"}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">{sessionError.message}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {unauthorized ? (
            <Link href="/sign-in" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md">Sign in again</Link>
          ) : (
            <Link href="/dashboard/my-services" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted">Back to My Services</Link>
          )}
        </div>
      </div>
    );
  }

  if (updated !== null) {
    return (
      <div role="status" aria-live="polite" className="rounded-2xl border border-success/40 bg-success-soft/60 px-5 py-12 text-center sm:px-8">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mx-auto h-12 w-12 text-success">
          <circle cx="12" cy="12" r="9" /><path d="M9 12.5l2 2 4-4.5" />
        </svg>
        <h2 className="mt-4 text-xl font-extrabold tracking-tight text-heading">Service updated</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          {updated} Your service is now <span className="font-semibold text-warning">pending approval</span> — the FixMate team reviews updated services before customers can book them. Taking you to My Services…
        </p>
        <Link href="/dashboard/my-services" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md">Go to My Services now</Link>
      </div>
    );
  }

  const busy = submitting;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/my-services" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
          Back to My Services
        </Link>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Ref: <code className="select-all rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] normal-case tracking-normal text-foreground">{serviceId}</code></p>
      </div>

      {formError && (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-error/40 bg-error-soft/60 px-4 py-3 text-sm leading-relaxed text-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
          <span>{formError}</span>
        </div>
      )}

      <fieldset className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
        <legend className="px-1 text-sm font-bold uppercase tracking-[0.14em] text-muted">Service basics</legend>
        <div className="mt-1 grid gap-5 sm:grid-cols-2">
          <Field id="edit-title" label="Service title" helper="3–120 characters." error={errors.title}>
            <input id="edit-title" type="text" value={values.title ?? ""} onChange={(e) => updateField("title", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.title) || undefined} autoComplete="off" className={inputBase} />
          </Field>
          <Field id="edit-category" label="Category" error={errors.category}>
            <div className="relative">
              <select id="edit-category" value={values.category ?? ""} onChange={(e) => updateField("category", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.category) || undefined} className={selectBase}>
                <option value="">Select a category…</option>
                {SERVICE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"><path d="m6 9 6 6 6-6" /></svg>
            </div>
          </Field>
          <Field id="edit-location" label="Service location" helper="2–200 characters." error={errors.location}>
            <input id="edit-location" type="text" value={values.location ?? ""} onChange={(e) => updateField("location", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.location) || undefined} autoComplete="off" className={inputBase} />
          </Field>
          <div className="sm:col-span-2">
            <p id="edit-image" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Service image
            </p>
            <div className="mt-1.5">
              <ServiceImageUpload
                id="edit-image-input"
                mode="edit"
                value={values.image ?? ""}
                onChange={(url) => updateField("image", url)}
                disabled={busy}
                error={errors.image}
              />
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
        <legend className="px-1 text-sm font-bold uppercase tracking-[0.14em] text-muted">Pricing &amp; capacity</legend>
        <div className="mt-1 grid gap-5 sm:grid-cols-3">
          <Field id="edit-hourly-rate" label="Hourly rate" helper="> 0, up to 100000." error={errors.hourlyRate}>
            <input id="edit-hourly-rate" type="number" inputMode="decimal" min={0} step="any" value={values.hourlyRate ?? ""} onChange={(e) => updateField("hourlyRate", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.hourlyRate) || undefined} className={inputBase} />
          </Field>
          <Field id="edit-security-deposit" label="Security deposit" helper="≥ 0, up to 1000000." error={errors.securityDeposit}>
            <input id="edit-security-deposit" type="number" inputMode="decimal" min={0} step="any" value={values.securityDeposit ?? ""} onChange={(e) => updateField("securityDeposit", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.securityDeposit) || undefined} className={inputBase} />
          </Field>
          <Field id="edit-max-capacity" label="Max capacity" helper="Whole number 1–1000." error={errors.maxCapacity}>
            <input id="edit-max-capacity" type="number" inputMode="numeric" min={1} max={1000} step={1} value={values.maxCapacity ?? ""} onChange={(e) => updateField("maxCapacity", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.maxCapacity) || undefined} className={inputBase} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
        <legend className="px-1 text-sm font-bold uppercase tracking-[0.14em] text-muted">Service details</legend>
        <div className="mt-1 grid gap-5">
          <Field id="edit-description" label="Description" helper="10–2000 characters." error={errors.description}>
            <textarea id="edit-description" rows={3} value={values.description ?? ""} onChange={(e) => updateField("description", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.description) || undefined} className={`${inputBase} resize-y`} />
          </Field>
          <Field id="edit-overview" label="Overview" helper="10–5000 characters." error={errors.overview}>
            <textarea id="edit-overview" rows={5} value={values.overview ?? ""} onChange={(e) => updateField("overview", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.overview) || undefined} className={`${inputBase} resize-y`} />
          </Field>
          <Field id="edit-amenity-input" label="Amenities" helper="Enter or Add to include. Up to 30 entries, 60 characters each." error={amenityError ?? errors.amenities}>
            <div className={`rounded-lg border bg-surface p-2 focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/25 ${amenityError || errors.amenities ? "border-error/60" : "border-border-strong"}`}>
              {amenities.length > 0 && (
                <ul aria-label="Added amenities" className="mb-2 flex flex-wrap gap-1.5">
                  {amenities.map((amenity, index) => (
                    <li key={`${amenity}-${index}`} className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-muted py-1 pl-3 pr-1.5 text-xs font-medium text-foreground">
                      <span className="max-w-48 truncate">{amenity}</span>
                      <button type="button" onClick={() => removeAmenity(index)} disabled={busy} aria-label={`Remove amenity ${amenity}`} className="flex h-5 w-5 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-error-soft hover:text-error disabled:cursor-not-allowed">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3 w-3"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2">
                <input id="edit-amenity-input" type="text" value={amenityDraft} onChange={(e) => { setAmenityDraft(e.target.value); setAmenityError(null); }} onKeyDown={handleAmenityKeyDown} disabled={busy} autoComplete="off" aria-label="Add an amenity" aria-invalid={Boolean(amenityError ?? errors.amenities) || undefined} placeholder="e.g. Home visit, Original parts…" className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted" />
                <button type="button" onClick={() => addAmenity(amenityDraft)} disabled={busy || amenityDraft.trim().length === 0} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50">Add</button>
              </div>
            </div>
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-[11px] leading-relaxed text-muted">Updating a service resets its approval status to <span className="font-semibold text-warning">Pending</span> — the FixMate team reviews every service update before customers can book it.</p>
        <button type="submit" disabled={busy} aria-live="polite" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none"><circle cx="12" cy="12" r="9" strokeOpacity="0.3" /><path d="M21 12a9 9 0 0 0-9-9" /></svg>
              Updating service…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4"><path d="M12 5v14M5 12h14" /></svg>
              Save changes
            </>
          )}
        </button>
      </div>
    </form>
  );
}

/* ================================================================== */
/*  Default export — technician gate + service lookup (client)          */
/*  `serviceId` comes from the route page unwrapping the params promise. */
/* ================================================================== */

export default function EditService({ serviceId }: { serviceId: string }) {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const role = roleFromUser(user);

  const [service, setService] = useState<ServiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ kind: "unauthorized" | "forbidden" | "server" | "network"; message: string } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (isPending || !user || role !== "technician") return;
    const controller = new AbortController();
    let cancelled = false;
    fetchOwnServices(controller.signal)
      .then((items) => {
        if (cancelled) return;
        setService(items.find((item) => item.id === serviceId) ?? null);
        setLoadError(null);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof EditServiceError) {
          if (error.kind === "unauthorized" || error.kind === "forbidden" || error.kind === "server" || error.kind === "network") {
            setLoadError({ kind: error.kind, message: error.message });
          } else {
            setLoadError({ kind: "server", message: error.message });
          }
        } else {
          setLoadError({ kind: "server", message: "Something went wrong while loading your services. Please try again." });
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [serviceId, isPending, user, role, reloadToken]);

  if (isPending) return <FormSkeleton />;
  if (!user) return null;
  if (role !== "technician") {
    return <AccessDenied role={role === "customer" || role === "admin" ? role : null} />;
  }
  if (loading) return <FormSkeleton />;
  if (loadError) {
    const unauthorized = loadError.kind === "unauthorized";
    return (
      <div role="alert" className="rounded-2xl border border-error/40 bg-error-soft/60 px-5 py-10 text-center sm:px-8">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mx-auto h-9 w-9 text-error"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
        <h2 className="mt-3 text-lg font-bold text-heading">{unauthorized ? "Session expired" : loadError.kind === "forbidden" ? "Technician access only" : "Couldn't load this service"}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">{loadError.message}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {unauthorized ? (
            <Link href="/sign-in" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md">Sign in again</Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setReloadToken((token) => token + 1);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }
  if (!service) {
    return <ErrorPanel title="Service not found" message="We couldn't find this service. It may have been removed, or the link is incorrect. It must be one of your own services." />;
  }
  return <EditServiceForm serviceId={serviceId} service={service} />;
}
