"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { roleFromUser } from "@/components/dashboard/DashboardSidebar";
import BookingScheduleFields, { type BookingScheduleValue } from "@/components/services/BookingScheduleFields";
import ServiceImageFallback from "@/components/ui/ServiceImageFallback";
import {
  ALL_SERVICE_CATEGORIES,
  displayCategory,
  type AnyServiceCategory,
} from "@/lib/service-categories";

/** Types mirror the public service-details DTO.
 *  GET /api/services/:id returns the safe public projection of an approved
 *  + available service; private fields are removed by the server.
 *  POST /api/bookings (verifyToken -> verifyCustomer) accepts ONLY
 *  { serviceId, problemDescription }; JWT is fetched per request. */

// Accept legacy values from older records without hiding them.
const CATEGORIES = ALL_SERVICE_CATEGORIES;

type ServiceCategory = AnyServiceCategory;

interface PublicServiceDetails {
  _id: string;
  title: string;
  category: ServiceCategory;
  description: string;
  overview: string;
  hourlyRate: number;
  securityDeposit: number;
  maxCapacity: number;
  location: string;
  image: string;
  amenities: string[];
  /** Actual aggregated rating from stored booking reviews. */
  rating: {
    averageRating: number | null;
    reviewCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

type DetailsErrorKind =
  | "invalid"
  | "notfound"
  | "network"
  | "server"
  | "parse"
  | "unauthorized";

class DetailsError extends Error {
  readonly kind: DetailsErrorKind;
  constructor(kind: DetailsErrorKind, message: string) {
    super(message);
    this.name = "DetailsError";
    this.kind = kind;
  }
}

type BookingErrorKind =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "notfound"
  | "conflict"
  | "network"
  | "server";

class BookingError extends Error {
  readonly kind: BookingErrorKind;
  constructor(kind: BookingErrorKind, message: string) {
    super(message);
    this.name = "BookingError";
    this.kind = kind;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const OBJECT_ID_HEX = /^[0-9a-fA-F]{24}$/;


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new DetailsError("parse", "The server returned an unexpected service payload.");
  }
  return value;
}

function requiredFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DetailsError("parse", "The server returned an unexpected service payload.");
  }
  return value;
}

function parseRating(raw: unknown): PublicServiceDetails["rating"] {
  if (!isRecord(raw)) {
    return { averageRating: null, reviewCount: 0 };
  }
  const reviewCount =
    typeof raw.reviewCount === "number" && Number.isFinite(raw.reviewCount) && raw.reviewCount >= 0
      ? Math.floor(raw.reviewCount)
      : 0;
  const averageRating =
    typeof raw.averageRating === "number" &&
    Number.isFinite(raw.averageRating) &&
    raw.averageRating >= 1 &&
    raw.averageRating <= 5
      ? raw.averageRating
      : null;
  return reviewCount > 0 && averageRating !== null
    ? { averageRating, reviewCount }
    : { averageRating: null, reviewCount: 0 };
}

function parseServiceDetails(raw: unknown): PublicServiceDetails {
  if (!isRecord(raw)) {
    throw new DetailsError("parse", "The server returned an unexpected service payload.");
  }
  const category = raw.category;
  if (typeof category !== "string" || !CATEGORIES.some((value) => value === category)) {
    throw new DetailsError("parse", "The server returned an unknown service category.");
  }
  return {
    _id: requiredString(raw, "_id"),
    title: requiredString(raw, "title"),
    category: displayCategory(category) as ServiceCategory,
    description: typeof raw.description === "string" ? raw.description : "",
    overview: typeof raw.overview === "string" ? raw.overview : "",
    hourlyRate: requiredFiniteNumber(raw, "hourlyRate"),
    securityDeposit:
      typeof raw.securityDeposit === "number" && Number.isFinite(raw.securityDeposit)
        ? raw.securityDeposit
        : 0,
    maxCapacity: requiredFiniteNumber(raw, "maxCapacity"),
    location: requiredString(raw, "location"),
    image: typeof raw.image === "string" ? raw.image.trim() : "",
    amenities: Array.isArray(raw.amenities)
      ? raw.amenities.filter((item): item is string => typeof item === "string")
      : [],
    rating: parseRating(raw.rating),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

// API calls — details is public; booking uses a dynamic JWT.

async function fetchServiceDetails(serviceId: string, signal: AbortSignal): Promise<PublicServiceDetails> {
  if (!OBJECT_ID_HEX.test(serviceId)) {
    throw new DetailsError("invalid", "This service link isn't valid. Check the URL and try again.");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/services/${encodeURIComponent(serviceId)}`, {
      method: "GET",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new DetailsError(
      "network",
      "Couldn't reach the FixMate server. Check your connection and try again."
    );
  }

  if (response.status === 400) {
    throw new DetailsError("invalid", "This service link isn't valid. Check the URL and try again.");
  }
  if (response.status === 404) {
    throw new DetailsError(
      "notfound",
      "This service isn't available. It may have been removed, rejected or marked unavailable by the technician."
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON body — handled below.
  }

  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.message === "string" && body.message.length <= 200
        ? body.message
        : "The server couldn't load this service. Please try again.";
    throw new DetailsError("server", message);
  }
  if (!isRecord(body) || body.success !== true) {
    throw new DetailsError("server", "The server returned an unexpected response.");
  }
  return parseServiceDetails(body.data);
}

/** Retrieve a short-lived JWT from Better Auth (`/api/auth/token`),
 *  session-cookie gated. Never stored, logged or persisted. */
async function fetchAccessToken(): Promise<string> {
  let response: {
    data: unknown;
    error: null | ({ status: number } & Record<string, unknown>);
  };
  try {
    response = await authClient.$fetch<{ token: string }>("/token", { method: "GET" });
  } catch {
    throw new BookingError(
      "network",
      "Couldn't reach the FixMate server to verify your session. Check your connection and try again."
    );
  }
  if (response.error) {
    if (response.error.status === 401 || response.error.status === 403) {
      throw new BookingError(
        "unauthorized",
        "Your session has expired. Sign in again to request this booking."
      );
    }
    throw new BookingError(
      "server",
      "We couldn't verify your session with FixMate right now. Please try again."
    );
  }
  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new BookingError("server", "The FixMate server returned an unexpected session-token response.");
  }
  return data.token;
}

async function createBookingRequest(
  serviceId: string,
  problemDescription: string,
  schedule?: { date: string; slotStart: string; timezone: string } | null
): Promise<string> {
  const token = await fetchAccessToken();

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/bookings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      // Only the strict-schema fields — no customerId/technicianId,
      // no status, no paymentStatus.
      body: JSON.stringify({
        serviceId,
        problemDescription,
        ...(schedule ? { schedule } : {}),
      }),
    });
  } catch {
    throw new BookingError(
      "network",
      "Couldn't reach the FixMate server. Check your connection and try again."
    );
  }

  if (response.status === 401) {
    throw new BookingError("unauthorized", "Your session has expired. Sign in again to request this booking.");
  }
  if (response.status === 403) {
    throw new BookingError(
      "forbidden",
      "Only customer accounts can book services. Switch to a customer account to continue."
    );
  }
  if (response.status === 404) {
    throw new BookingError(
      "notfound",
      "This service is no longer available. It may have been removed or taken offline."
    );
  }
  if (response.status === 409) {
    let serverMessagePayload: unknown = null;
    try {
      serverMessagePayload = await response.clone().json();
    } catch {
      serverMessagePayload = null;
    }
    const message =
      serverMessagePayload &&
      typeof serverMessagePayload === "object" &&
      typeof (serverMessagePayload as { message?: unknown }).message === "string" &&
      ((serverMessagePayload as { message: string }).message as string).length > 0 &&
      ((serverMessagePayload as { message: string }).message as string).length <= 300
        ? (serverMessagePayload as { message: string }).message
        : "That slot was just taken or this service is no longer bookable. Please pick another slot.";
    throw new BookingError("conflict", message);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON body — handled below.
  }

  const serverMessage =
    isRecord(body) && typeof body.message === "string" && body.message.length > 0 && body.message.length <= 200
      ? body.message
      : null;

  if (response.status === 400) {
    const issue =
      isRecord(body) && Array.isArray(body.errors) && body.errors.length > 0 && isRecord(body.errors[0])
        ? body.errors[0].message
        : null;
    const message =
      typeof issue === "string" && issue.length > 0 && issue.length <= 200 ? issue : serverMessage;
    throw new BookingError(
      "validation",
      message ?? "Check your details — the problem description must be 10 to 2000 characters."
    );
  }

  if (!response.ok || (isRecord(body) && body.success === false)) {
    throw new BookingError(
      "server",
      serverMessage ?? "The server couldn't create your booking. Please try again."
    );
  }

  return serverMessage ?? "Booking requested successfully.";
}


function formatAmount(value: number): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}

function validateProblemDescription(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 10) return "Problem description must be at least 10 characters long.";
  if (trimmed.length > 2000) return "Problem description must be at most 2000 characters long.";
  return null;
}


function DetailsSkeleton() {
  return (
    <div role="status" aria-label="Loading service details…" className="space-y-6">
      <span className="sr-only">Loading service details…</span>
      <div aria-hidden="true" className="grid gap-6 lg:grid-cols-5">
        <div className="h-80 animate-pulse rounded-2xl border border-border bg-surface-muted lg:col-span-3" />
        <div className="space-y-4 lg:col-span-2">
          <div className="h-44 animate-pulse rounded-2xl border border-border bg-surface-muted" />
          <div className="h-56 animate-pulse rounded-2xl border border-border bg-surface-muted" />
        </div>
      </div>
    </div>
  );
}

function DetailsErrorPanel({ error, onRetry }: { error: DetailsError; onRetry: () => void }) {
  const invalid = error.kind === "invalid";
  const notfound = error.kind === "notfound";
  const title = invalid
    ? "Invalid service link"
    : notfound
      ? "Service not found"
      : "Couldn't load this service";

  return (
    <div
      role="alert"
      className="mx-auto max-w-2xl rounded-2xl border border-error/40 bg-error-soft/60 px-6 py-12 text-center"
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
      <h2 className="mt-3 text-lg font-bold text-heading">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">{error.message}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/services"
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted active:scale-[0.98] active:bg-surface-muted cursor-pointer"
        >
          Browse services
        </Link>
        {!invalid && !notfound && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] active:bg-primary-hover cursor-pointer"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/services"
      className="inline-flex items-center gap-2 text-xs font-semibold text-accent-strong transition-colors duration-200 hover:text-accent-600 dark:text-accent dark:hover:text-accent-400 cursor-pointer"
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
      Back to services
    </Link>
  );
}


function BookingPanel({ service }: { service: PublicServiceDetails }) {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const role = roleFromUser(user);

  const [problemDescription, setProblemDescription] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<BookingScheduleValue | null>(null);
  const submitInFlightRef = useRef(false);

  const signInHref = `/sign-in?callbackURL=${encodeURIComponent(`/services/${service._id}`)}`;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlightRef.current) return;

    const validationError = validateProblemDescription(problemDescription);
    if (validationError) {
      setFieldError(validationError);
      setFormError(null);
      document.getElementById("booking-problem-description")?.focus();
      return;
    }

    submitInFlightRef.current = true;
    setSubmitting(true);
    setFieldError(null);
    setFormError(null);

    try {
      const message = await createBookingRequest(
        service._id,
        problemDescription.trim(),
        schedule
      );
      setSuccess(message);
      return;
    } catch (error) {
      setFormError(
        error instanceof BookingError
          ? error.message
          : "Something went wrong while sending your booking request. Please try again."
      );
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  if (success !== null) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-success/40 bg-success-soft/60 p-6 text-center sm:p-8"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="mx-auto h-10 w-10 text-success"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9 12.5l2 2 4-4.5" />
        </svg>
        <h2 className="mt-4 text-lg font-extrabold tracking-tight text-heading sm:text-xl">
          Booking request sent
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          {success} This is a <span className="font-semibold text-foreground">request</span> — it is
          not confirmed until the technician accepts it. You&apos;ll see the latest status in My
          Bookings.
        </p>
        <Link
          href="/dashboard/bookings"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] active:bg-primary-hover cursor-pointer"
        >
          Go to My Bookings
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
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    );
  }

  if (isPending) {
    return (
      <div role="status" aria-label="Checking your session…" className="rounded-2xl border border-border bg-surface p-6">
        <span className="sr-only">Checking your session…</span>
        <div aria-hidden="true" className="h-40 animate-pulse rounded-xl bg-surface-muted" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs sm:p-8">
        <h2 className="text-lg font-extrabold tracking-tight text-heading">Ready to book?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Sign in with a customer account to request this repair. A booking is a request — it is
          not confirmed until the technician accepts it.
        </p>
        <Link
          href={signInHref}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] active:bg-primary-hover cursor-pointer"
        >
          Sign in to book
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
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    );
  }

  if (role !== "customer") {
    return (
      <div className="rounded-2xl border border-warning/40 bg-warning-soft/60 p-6 shadow-xs sm:p-8">
        <h2 className="text-lg font-extrabold tracking-tight text-heading">Customers can book services</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          You&apos;re signed in with a {role === "technician" ? "technician" : "admin"} account, so
          you can&apos;t request bookings here. Please use a customer account.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight text-heading">Book this service</h2>
        <p className="text-xs font-medium tabular-nums text-muted">
          {formatAmount(service.hourlyRate)}/hr
        </p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Tell the technician what&apos;s wrong. Your booking is a request and isn&apos;t confirmed
        until the technician accepts it.
      </p>

      <BookingScheduleFields
        serviceId={service._id}
        onChange={setSchedule}
        disabled={submitting}
      />

      {formError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-error/40 bg-error-soft/60 px-4 py-3 text-xs leading-relaxed text-error"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="booking-problem-description"
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"
          >
            Problem description <span aria-hidden="true" className="text-error">*</span>
          </label>
          <textarea
            id="booking-problem-description"
            rows={5}
            value={problemDescription}
            onChange={(event) => {
              setProblemDescription(event.target.value);
              setFieldError(null);
              setFormError(null);
            }}
            disabled={submitting}
            required
            aria-invalid={Boolean(fieldError) || undefined}
            aria-describedby={fieldError ? "booking-problem-error" : "booking-problem-helper"}
            placeholder="Describe the issue, the device model and anything else the technician should know…"
            className="mt-1.5 w-full resize-y rounded-xl border border-border-strong bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted shadow-xs outline-none transition-colors duration-200 enabled:hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25 aria-[invalid=true]:border-error/60 disabled:cursor-not-allowed disabled:opacity-60"
          />
          {fieldError ? (
            <p id="booking-problem-error" role="alert" className="mt-1.5 text-[11px] font-medium text-error">
              {fieldError}
            </p>
          ) : (
            <p id="booking-problem-helper" className="mt-1.5 text-[11px] leading-snug text-muted">
              10–2000 characters. {problemDescription.trim().length}/2000 used.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          aria-live="polite"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-semibold text-[#04121f] shadow-glow transition-all duration-200 enabled:hover:bg-accent-400 enabled:active:scale-[0.98] enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {submitting ? (
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
              Sending request…
            </>
          ) : (
            "Book This Service"
          )}
        </button>
      </form>
    </div>
  );
}


export default function ServiceDetails({ serviceId }: { serviceId: string }) {
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: DetailsError }
    | { phase: "success"; service: PublicServiceDetails }
  >({ phase: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetchServiceDetails(serviceId, controller.signal)
      .then((service) => {
        if (cancelled) return;
        setState({ phase: "success", service });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof DetailsError) {
          setState({ phase: "error", error });
          return;
        }
        setState({
          phase: "error",
          error: new DetailsError(
            "server",
            "Something went wrong while loading this service. Please try again."
          ),
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [serviceId, reloadToken]);

  function retry() {
    // Event handler — setting the loading phase synchronously is safe.
    setState({ phase: "loading" });
    setReloadToken((token) => token + 1);
  }

  return (
    <div>
      <BackLink />

      <div className="mt-5">
        {state.phase === "loading" && <DetailsSkeleton />}
        {state.phase === "error" && <DetailsErrorPanel error={state.error} onRetry={retry} />}
        {state.phase === "success" && (
          <ServiceDetailsContent service={state.service} />
        )}
      </div>
    </div>
  );
}

function ServiceDetailsContent({ service }: { service: PublicServiceDetails }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = service.image.trim();
  const showImage = imageUrl.length > 0 && !imageFailed;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <section
          aria-labelledby="service-details-heading"
          className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs"
        >
          <div className="relative h-56 w-full overflow-hidden bg-navy-900 sm:h-72">
            {showImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- backend image URLs are remote and not known at build time, so next/image remotePatterns can't be configured.
              <img
                src={imageUrl}
                alt={service.title}
                loading="lazy"
                decoding="async"
                onError={() => setImageFailed(true)}
                className="absolute inset-0 h-full w-full object-cover object-[50%_38%]"
              />
            ) : (
              <ServiceImageFallback />
            )}
            <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-navy-950/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-100 backdrop-blur-sm">
              {service.category}
            </span>
          </div>
          <div className="p-5 sm:p-7">
            <h2 id="service-details-heading" className="text-xl font-extrabold tracking-tight text-heading sm:text-2xl">
              {service.title}
            </h2>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {service.location}
            </p>
            <p className="mt-2.5 flex items-center gap-1.5 text-sm">
              {service.rating.reviewCount > 0 && service.rating.averageRating !== null ? (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="currentColor"
                    aria-hidden="true"
                    className="h-4 w-4 text-warning"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <span className="font-bold tabular-nums text-heading">
                    {service.rating.averageRating.toFixed(1)}
                  </span>
                  <span className="text-muted">
                    · {service.rating.reviewCount}{" "}
                    {service.rating.reviewCount === 1 ? "review" : "reviews"}
                  </span>
                </>
              ) : (
                <span className="text-muted">No reviews yet</span>
              )}
            </p>
          </div>
        </section>

        {service.description && (
          <section aria-labelledby="service-description-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-7">
            <h2 id="service-description-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
              Description
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">
              {service.description}
            </p>
          </section>
        )}

        <section aria-labelledby="service-overview-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-7">
          <h2 id="service-overview-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
            What&apos;s included
          </h2>
          {service.overview.trim() ? (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">
              {service.overview}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">No overview was provided for this service.</p>
          )}

          {service.amenities.length > 0 && (
            <ul aria-label="Amenities" className="mt-5 flex flex-wrap gap-2">
              {service.amenities.map((amenity, index) => (
                <li
                  key={`${amenity}-${index}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-muted px-3 py-1 text-xs font-medium text-foreground"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-3 w-3 text-accent-strong dark:text-accent"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {amenity}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-6 lg:col-span-2">
        <BookingPanel service={service} />

        <section
          aria-labelledby="service-facts-heading"
          className="h-fit rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6"
        >
          <h2 id="service-facts-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
            Service details
          </h2>
          <dl className="mt-4 flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3.5">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Hourly rate</dt>
              <dd className="text-xs font-bold tabular-nums text-heading">
                {formatAmount(service.hourlyRate)}/hr
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3.5">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Security deposit</dt>
              <dd className="text-xs font-bold tabular-nums text-heading">
                {formatAmount(service.securityDeposit)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3.5">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Max capacity</dt>
              <dd className="text-xs font-bold tabular-nums text-heading">{service.maxCapacity}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Category</dt>
              <dd className="text-xs font-bold text-heading">{service.category}</dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  );
}
