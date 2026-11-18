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
} from "@/lib/service-categories";

/** Types — mirror the backend createServiceSchema exactly.
 *
 *  POST /api/services (verifyToken -> verifyTechnician) accepts ONLY:
 *  title, category, description, overview, hourlyRate, securityDeposit,
 *  maxCapacity, location, image, amenities (optional, default []).
 *  z.strictObject on the server rejects anything else — notably
 *  technicianId/technicianName/approvalStatus, which the server derives
 *  from the verified JWT instead.
 *
 *  Success: 201 { success, message, data } with approvalStatus "pending"
 *  and availabilityStatus "available" (server-controlled).
 *  Failures: 400 { success:false, message, errors:[{field,message}] };
 *  401 (session), 403 ("Technician access only."). */

export interface CreateServiceInput {
  title: string;
  category: ServiceCategory;
  description: string;
  overview: string;
  hourlyRate: number;
  securityDeposit: number;
  maxCapacity: number;
  location: string;
  image: string;
  amenities?: string[];
}

type AddServiceErrorKind =
  | "unauthorized"
  | "forbidden"
  | "network"
  | "server"
  | "validation";

interface FieldIssue {
  field: string;
  message: string;
}

class AddServiceError extends Error {
  readonly kind: AddServiceErrorKind;
  readonly issues: FieldIssue[];
  constructor(kind: AddServiceErrorKind, message: string, issues: FieldIssue[] = []) {
    super(message);
    this.name = "AddServiceError";
    this.kind = kind;
    this.issues = issues;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

// API calls — JWT fetched per request; never stored or logged. Identity comes from the verified JWT only, never from client input.

/** Retrieve a short-lived JWT from the Better Auth server (`/api/auth/token`,
 *  session-cookie gated). Returns the token string only. */
async function fetchAccessToken(): Promise<string> {
  let response: {
    data: unknown;
    error: null | ({ status: number } & Record<string, unknown>);
  };
  try {
    response = await authClient.$fetch<{ token: string }>("/token", {
      method: "GET",
    });
  } catch {
    throw new AddServiceError(
      "network",
      "Couldn't reach the FixMate server to verify your session. Check your connection and try again."
    );
  }

  if (response.error) {
    const status = response.error.status;
    if (status === 401 || status === 403) {
      throw new AddServiceError(
        "unauthorized",
        "Your session has expired. Sign in again to add your service."
      );
    }
    throw new AddServiceError(
      "server",
      "We couldn't verify your session with FixMate right now. Please try again."
    );
  }

  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new AddServiceError(
      "server",
      "The FixMate server returned an unexpected session-token response."
    );
  }
  return data.token;
}

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
    if (issues.length >= 40) break;
  }
  return issues;
}

async function createService(input: CreateServiceInput): Promise<string> {
  const token = await fetchAccessToken();

  const payload: Record<string, unknown> = {
    title: input.title,
    category: input.category,
    description: input.description,
    overview: input.overview,
    hourlyRate: input.hourlyRate,
    securityDeposit: input.securityDeposit,
    maxCapacity: input.maxCapacity,
    location: input.location,
    image: input.image,
  };
  if (input.amenities && input.amenities.length > 0) {
    payload.amenities = input.amenities;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/services`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  } catch {
    throw new AddServiceError(
      "network",
      "Couldn't reach the FixMate server. Check your connection and try again."
    );
  }

  if (response.status === 401) {
    throw new AddServiceError(
      "unauthorized",
      "Your session has expired. Sign in again to add your service."
    );
  }

  if (response.status === 403) {
    throw new AddServiceError(
      "forbidden",
      "Technician access only. This account isn't allowed to create services."
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON body — handled by the status checks below.
  }

  const serverMessage =
    isRecord(body) && typeof body.message === "string" && body.message.length > 0 && body.message.length <= 200
      ? body.message
      : null;

  if (response.status === 400) {
    const issues = parseFieldIssues(body);
    throw new AddServiceError(
      "validation",
      serverMessage ?? "Some details were rejected. Please review the highlighted fields.",
      issues
    );
  }

  if (!response.ok && response.status !== 201) {
    throw new AddServiceError(
      "server",
      serverMessage ?? "The server couldn't create your service. Please try again."
    );
  }

  if (isRecord(body) && body.success === false) {
    throw new AddServiceError(
      "server",
      serverMessage ?? "The server couldn't create your service. Please try again."
    );
  }

  return serverMessage ?? "Service created successfully.";
}

/* Client-side validation — mirrors createServiceSchema exactly, plus an http(s)-URL check for the image field. */

export interface FormValues {
  title: string;
  category: string;
  location: string;
  image: string;
  hourlyRate: string;
  securityDeposit: string;
  maxCapacity: string;
  description: string;
  overview: string;
}

export type FieldErrors = Partial<Record<string, string>>;

function parseFiniteNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function parseIntStrict(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  // Reject decimals up front so inputs like "2.5" fail int validation.
  if (!/^-?\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

export function validateServiceForm(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};

  const title = values.title.trim();
  if (title.length < 3) errors.title = "Title must be at least 3 characters long.";
  else if (title.length > 120) errors.title = "Title must be at most 120 characters long.";

  if (!SERVICE_CATEGORIES.includes(values.category as ServiceCategory)) {
    errors.category = `Category must be one of: ${SERVICE_CATEGORIES.join(", ")}.`;
  }

  const description = values.description.trim();
  if (description.length < 10) errors.description = "Description must be at least 10 characters long.";
  else if (description.length > 2000) errors.description = "Description must be at most 2000 characters long.";

  const overview = values.overview.trim();
  if (overview.length < 10) errors.overview = "Overview must be at least 10 characters long.";
  else if (overview.length > 5000) errors.overview = "Overview must be at most 5000 characters long.";

  const hourlyRate = parseFiniteNumber(values.hourlyRate);
  if (hourlyRate === null) errors.hourlyRate = "Hourly rate must be a number.";
  else if (hourlyRate <= 0) errors.hourlyRate = "Hourly rate must be greater than 0.";
  else if (hourlyRate > 100000) errors.hourlyRate = "Hourly rate must be at most 100000.";

  const securityDeposit = parseFiniteNumber(values.securityDeposit);
  if (securityDeposit === null) errors.securityDeposit = "Security deposit must be a number (use 0 if none).";
  else if (securityDeposit < 0) errors.securityDeposit = "Security deposit cannot be negative.";
  else if (securityDeposit > 1000000) errors.securityDeposit = "Security deposit must be at most 1000000.";

  const maxCapacity = parseIntStrict(values.maxCapacity);
  if (maxCapacity === null) errors.maxCapacity = "Max capacity must be a whole number.";
  else if (maxCapacity < 1) errors.maxCapacity = "Max capacity must be at least 1.";
  else if (maxCapacity > 1000) errors.maxCapacity = "Max capacity must be at most 1000.";

  const location = values.location.trim();
  if (location.length < 2) errors.location = "Location must be at least 2 characters long.";
  else if (location.length > 200) errors.location = "Location must be at most 200 characters long.";

  const image = values.image.trim();
  if (image.length === 0) {
    errors.image = "Image URL is required.";
  } else if (image.length > 2048) {
    errors.image = "Image URL must be at most 2048 characters long.";
  } else {
    try {
      const parsed = new URL(image);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        errors.image = "Image URL must start with http:// or https://.";
      }
    } catch {
      errors.image = "Enter a valid http(s) image URL.";
    }
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


const inputBase =
  "w-full rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm text-foreground shadow-xs outline-none transition-colors duration-200 placeholder:text-muted enabled:hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25 aria-[invalid=true]:border-error/60 aria-[invalid=true]:bg-error-soft/20";

const selectBase = `${inputBase} appearance-none pr-10 cursor-pointer disabled:cursor-not-allowed`;

function Field({
  id,
  label,
  required = false,
  helper,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-error">
            *
          </span>
        )}
      </label>
      <div className="mt-1.5">{children}</div>
      {helper && !error && (
        <p id={`${id}-helper`} className="mt-1.5 text-[11px] leading-snug text-muted">
          {helper}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[11px] font-medium leading-snug text-error">
          {error}
        </p>
      )}
    </div>
  );
}

function ScreenSkeleton() {
  return (
    <div role="status" aria-label="Loading…" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <div
        aria-hidden="true"
        className="h-[34rem] animate-pulse rounded-2xl border border-border bg-surface"
      />
    </div>
  );
}

function AccessDenied({ role }: { role: "customer" | "admin" | null }) {
  const roleLabel = role === "customer" ? "customer" : role === "admin" ? "admin" : null;
  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-2xl border border-warning/40 bg-warning-soft text-warning"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8"
        >
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-heading">
        This page is for technician accounts
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {roleLabel
          ? `You're signed in with a ${roleLabel} account, so you can't add services here. Your dashboard only shows the sections your role can use.`
          : "Your account's role isn't recognized, so this section isn't available. Please contact FixMate support if this looks wrong."}
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-4 w-4"
        >
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        Back to your dashboard
      </Link>
    </section>
  );
}


export function AddServiceScreen() {
  // Session atom is already resolved by the layout — this resolves instantly.
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const role = roleFromUser(user);

  if (isPending) return <ScreenSkeleton />;

  // Signed out — the layout is redirecting; render nothing private.
  if (!user) return null;

  // Technician-only gate. Known non-technician roles (and unknown roles)
  // are refused here; the backend enforces the same rule independently.
  if (role !== "technician") {
    return <AccessDenied role={role === "customer" || role === "admin" ? role : null} />;
  }

  return <AddServiceForm />;
}


function BackToServicesLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/dashboard/my-services"
      className={`inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted cursor-pointer active:bg-surface-muted ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-4 w-4"
      >
        <path d="M19 12H5M11 18l-6-6 6-6" />
      </svg>
      Back to My Services
    </Link>
  );
}


const EMPTY_VALUES: FormValues = {
  title: "",
  category: "",
  location: "",
  image: "",
  hourlyRate: "",
  securityDeposit: "0",
  maxCapacity: "",
  description: "",
  overview: "",
};

const FIELD_IDS: Record<string, string> = {
  title: "add-service-title",
  category: "add-service-category",
  location: "add-service-location",
  image: "add-service-image",
  hourlyRate: "add-service-hourly-rate",
  securityDeposit: "add-service-security-deposit",
  maxCapacity: "add-service-max-capacity",
  description: "add-service-description",
  overview: "add-service-overview",
  amenities: "add-service-amenity-input",
};

export default function AddServiceForm() {
  const router = useRouter();
  const submitInFlightRef = useRef(false);

  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [amenityDraft, setAmenityDraft] = useState("");
  const [amenityError, setAmenityError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ message: string } | null>(null);
  // Session/role failures surface as a dedicated panel (kept in state so the
  // form unmount path stays simple).
  const [submitFailure, setSubmitFailure] = useState<{ kind: "unauthorized" | "forbidden"; message: string } | null>(null);

  // Auto-redirect to My Services after a successful creation.
  useEffect(() => {
    if (!created) return;
    const timeout = window.setTimeout(() => {
      router.replace("/dashboard/my-services");
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [created, router]);

  function updateField<K extends keyof FormValues>(key: K, value: string) {
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
    setFormError(null);
    // Clear any backend error attached to the amenities array.
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
      // Convenience: Backspace on an empty draft removes the last chip.
      removeAmenity(amenities.length - 1);
    }
  }

  function focusFirstInvalid(fieldErrors: FieldErrors) {
    for (const field of Object.keys(FIELD_IDS)) {
      if (fieldErrors[field]) {
        document.getElementById(FIELD_IDS[field])?.focus();
        return;
      }
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlightRef.current) return;

    // Fold any unsaved amenity draft into the submission instead of
    // silently dropping it.
    let effectiveAmenities = amenities;
    const draft = amenityDraft.trim();
    if (draft.length > 0) {
      const mistake = validateAmenity(draft, amenities);
      if (mistake) {
        setAmenityError(mistake);
        document.getElementById(FIELD_IDS.amenities)?.focus();
        return;
      }
      effectiveAmenities = [...amenities, draft];
      setAmenities(effectiveAmenities);
      setAmenityDraft("");
      setAmenityError(null);
    }

    const fieldErrors = validateServiceForm(values);
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
      const message = await createService({
        title: values.title.trim(),
        category: values.category as ServiceCategory,
        location: values.location.trim(),
        image: values.image.trim(),
        hourlyRate: parseFiniteNumber(values.hourlyRate) as number,
        securityDeposit: parseFiniteNumber(values.securityDeposit) as number,
        maxCapacity: parseIntStrict(values.maxCapacity) as number,
        description: values.description.trim(),
        overview: values.overview.trim(),
        amenities: effectiveAmenities.length > 0 ? effectiveAmenities : undefined,
      });
      setCreated({ message });
      return;
    } catch (error) {
      if (error instanceof AddServiceError) {
        if (error.kind === "unauthorized" || error.kind === "forbidden") {
          // Rendered below as the full-page panel — routing here keeps a
          // single code path for session/role failures.
          setFormError(null);
          setErrors({});
          setSubmitFailure({ kind: error.kind, message: error.message });
          return;
        }
        if (error.kind === "validation") {
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
          return;
        }
        setFormError(error.message);
        return;
      }
      setFormError("Something went wrong while creating your service. Please try again.");
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  if (submitFailure) {
    const unauthorized = submitFailure.kind === "unauthorized";
    return (
      <div
        role="alert"
        className="rounded-2xl border border-error/40 bg-error-soft/60 px-5 py-10 text-center sm:px-8"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="mx-auto h-9 w-9 text-error"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <h2 className="mt-3 text-lg font-bold text-heading">
          {unauthorized ? "Session expired" : "Technician access only"}
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
          {submitFailure.message}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {unauthorized ? (
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]"
            >
              Sign in again
            </Link>
          ) : (
            <BackToServicesLink />
          )}
        </div>
      </div>
    );
  }

  if (created) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-success/40 bg-success-soft/60 px-5 py-12 text-center sm:px-8"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="mx-auto h-12 w-12 text-success"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9 12.5l2 2 4-4.5" />
        </svg>
        <h2 className="mt-4 text-xl font-extrabold tracking-tight text-heading">
          Service created
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          {created.message} Your service is now <span className="font-semibold text-foreground">pending approval</span> — the FixMate team reviews new services before customers can book them. Taking you to My Services…
        </p>
        <Link
          href="/dashboard/my-services"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]"
        >
          Go to My Services
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    );
  }

  const busy = submitting;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackToServicesLink />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          <span aria-hidden="true" className="text-error">*</span> Required field
        </p>
      </div>

      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-error/40 bg-error-soft/60 px-4 py-3 text-sm leading-relaxed text-error"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{formError}</span>
        </div>
      )}

      <fieldset className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
        <legend className="px-1 text-sm font-bold uppercase tracking-[0.14em] text-muted">
          Service basics
        </legend>
        <div className="mt-1 grid gap-5 sm:grid-cols-2">
          <Field
            id={FIELD_IDS.title}
            label="Service title"
            required
            helper="3–120 characters. What will customers call this service?"
            error={errors.title}
          >
            <input
              id={FIELD_IDS.title}
              type="text"
              value={values.title}
              onChange={(e) => updateField("title", e.target.value)}
              disabled={busy}
              aria-invalid={Boolean(errors.title) || undefined}
              aria-describedby={errors.title ? `${FIELD_IDS.title}-error` : `${FIELD_IDS.title}-helper`}
              autoComplete="off"
              placeholder="e.g. Smartphone Screen Replacement"
              className={inputBase}
            />
          </Field>

          <Field
            id={FIELD_IDS.category}
            label="Category"
            required
            error={errors.category}
          >
            <div className="relative">
              <select
                id={FIELD_IDS.category}
                value={values.category}
                onChange={(e) => updateField("category", e.target.value)}
                disabled={busy}
                aria-invalid={Boolean(errors.category) || undefined}
                aria-describedby={errors.category ? `${FIELD_IDS.category}-error` : undefined}
                className={selectBase}
              >
                <option value="">Select a category…</option>
                {SERVICE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </Field>

          <Field
            id={FIELD_IDS.location}
            label="Service location"
            required
            helper="2–200 characters. City, area or neighborhood you serve."
            error={errors.location}
          >
            <input
              id={FIELD_IDS.location}
              type="text"
              value={values.location}
              onChange={(e) => updateField("location", e.target.value)}
              disabled={busy}
              aria-invalid={Boolean(errors.location) || undefined}
              aria-describedby={errors.location ? `${FIELD_IDS.location}-error` : `${FIELD_IDS.location}-helper`}
              autoComplete="off"
              placeholder="e.g. Dhaka — Banani"
              className={inputBase}
            />
          </Field>

          <div className="sm:col-span-2">
            <p
              id={FIELD_IDS.image}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
            >
              Service image <span aria-hidden="true" className="text-error">*</span>
            </p>
            <div className="mt-1.5">
              <ServiceImageUpload
                id="add-service-image-input"
                value={values.image}
                onChange={(url) => updateField("image", url)}
                disabled={busy}
                error={errors.image}
              />
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
        <legend className="px-1 text-sm font-bold uppercase tracking-[0.14em] text-muted">
          Pricing &amp; capacity
        </legend>
        <div className="mt-1 grid gap-5 sm:grid-cols-3">
          <Field
            id={FIELD_IDS.hourlyRate}
            label="Hourly rate"
            required
            helper="Greater than 0, up to 100000."
            error={errors.hourlyRate}
          >
            <input
              id={FIELD_IDS.hourlyRate}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={values.hourlyRate}
              onChange={(e) => updateField("hourlyRate", e.target.value)}
              disabled={busy}
              aria-invalid={Boolean(errors.hourlyRate) || undefined}
              aria-describedby={errors.hourlyRate ? `${FIELD_IDS.hourlyRate}-error` : `${FIELD_IDS.hourlyRate}-helper`}
              placeholder="e.g. 500"
              className={inputBase}
            />
          </Field>

          <Field
            id={FIELD_IDS.securityDeposit}
            label="Security deposit"
            required
            helper="0 or more, up to 1000000. Use 0 if none."
            error={errors.securityDeposit}
          >
            <input
              id={FIELD_IDS.securityDeposit}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={values.securityDeposit}
              onChange={(e) => updateField("securityDeposit", e.target.value)}
              disabled={busy}
              aria-invalid={Boolean(errors.securityDeposit) || undefined}
              aria-describedby={errors.securityDeposit ? `${FIELD_IDS.securityDeposit}-error` : `${FIELD_IDS.securityDeposit}-helper`}
              placeholder="e.g. 0"
              className={inputBase}
            />
          </Field>

          <Field
            id={FIELD_IDS.maxCapacity}
            label="Max capacity"
            required
            helper="Whole number from 1 to 1000."
            error={errors.maxCapacity}
          >
            <input
              id={FIELD_IDS.maxCapacity}
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              step={1}
              value={values.maxCapacity}
              onChange={(e) => updateField("maxCapacity", e.target.value)}
              disabled={busy}
              aria-invalid={Boolean(errors.maxCapacity) || undefined}
              aria-describedby={errors.maxCapacity ? `${FIELD_IDS.maxCapacity}-error` : `${FIELD_IDS.maxCapacity}-helper`}
              placeholder="e.g. 4"
              className={inputBase}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
        <legend className="px-1 text-sm font-bold uppercase tracking-[0.14em] text-muted">
          Service details
        </legend>
        <div className="mt-1 grid gap-5">
          <Field
            id={FIELD_IDS.description}
            label="Description"
            required
            helper="10–2000 characters. A concise summary customers will see first."
            error={errors.description}
          >
            <textarea
              id={FIELD_IDS.description}
              rows={3}
              value={values.description}
              onChange={(e) => updateField("description", e.target.value)}
              disabled={busy}
              aria-invalid={Boolean(errors.description) || undefined}
              aria-describedby={errors.description ? `${FIELD_IDS.description}-error` : `${FIELD_IDS.description}-helper`}
              placeholder="Briefly describe what this service covers…"
              className={`${inputBase} resize-y`}
            />
          </Field>

          <Field
            id={FIELD_IDS.overview}
            label="Overview"
            required
            helper="10–5000 characters. The full story — scope, what's included, what isn't."
            error={errors.overview}
          >
            <textarea
              id={FIELD_IDS.overview}
              rows={5}
              value={values.overview}
              onChange={(e) => updateField("overview", e.target.value)}
              disabled={busy}
              aria-invalid={Boolean(errors.overview) || undefined}
              aria-describedby={errors.overview ? `${FIELD_IDS.overview}-error` : `${FIELD_IDS.overview}-helper`}
              placeholder="Tell customers exactly what to expect from this service…"
              className={`${inputBase} resize-y`}
            />
          </Field>

          {/* Amenities — free text, validated per the backend rule: each 1–60
              chars, at most 30 entries. No preset list exists server-side. */}
          <Field
            id={FIELD_IDS.amenities}
            label="Amenities"
            helper="Optional. Type an amenity and press Enter (or Add). Up to 30 entries, 60 characters each."
            error={amenityError ?? errors.amenities}
          >
            <div
              className={`rounded-lg border bg-surface p-2 transition-colors duration-200 focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/25 ${
                amenityError || errors.amenities ? "border-error/60" : "border-border-strong"
              }`}
            >
              {amenities.length > 0 && (
                <ul aria-label="Added amenities" className="mb-2 flex flex-wrap gap-1.5">
                  {amenities.map((amenity, index) => (
                    <li
                      key={`${amenity}-${index}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-muted py-1 pl-3 pr-1.5 text-xs font-medium text-foreground"
                    >
                      <span className="max-w-48 truncate">{amenity}</span>
                      <button
                        type="button"
                        onClick={() => removeAmenity(index)}
                        disabled={busy}
                        aria-label={`Remove amenity ${amenity}`}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-muted transition-colors duration-200 enabled:hover:bg-error-soft enabled:hover:text-error cursor-pointer enabled:active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className="h-3 w-3"
                        >
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2">
                <input
                  id={FIELD_IDS.amenities}
                  type="text"
                  value={amenityDraft}
                  onChange={(e) => {
                    setAmenityDraft(e.target.value);
                    setAmenityError(null);
                  }}
                  onKeyDown={handleAmenityKeyDown}
                  disabled={busy}
                  autoComplete="off"
                  aria-label="Add an amenity"
                  aria-invalid={Boolean(amenityError ?? errors.amenities) || undefined}
                  aria-describedby={`${FIELD_IDS.amenities}-helper`}
                  placeholder="e.g. Home visit, Original parts, Warranty…"
                  className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted"
                />
                <button
                  type="button"
                  onClick={() => addAmenity(amenityDraft)}
                  disabled={busy || amenityDraft.trim().length === 0}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted cursor-pointer enabled:active:bg-surface-muted enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-[11px] leading-relaxed text-muted">
          New services start as <span className="font-semibold text-warning">Pending</span> approval and remain available once approved. The FixMate team reviews every new service.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Link
            href="/dashboard/my-services"
            aria-disabled={busy || undefined}
            className={`inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted cursor-pointer active:bg-surface-muted ${
              busy ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={busy}
            aria-live="polite"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 enabled:hover:bg-primary-hover enabled:hover:shadow-md cursor-pointer enabled:active:bg-primary-hover enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin motion-reduce:animate-none"
                >
                  <circle cx="12" cy="12" r="9" strokeOpacity="0.3" />
                  <path d="M21 12a9 9 0 0 0-9-9" />
                </svg>
                Creating service…
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-4 w-4"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Create Service
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
