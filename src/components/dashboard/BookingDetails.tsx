"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { roleFromUser } from "@/components/dashboard/DashboardSidebar";
import {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  type BookingStatus,
  type PaymentStatus,
} from "@/components/dashboard/MyBookings";
import {
  ALL_SERVICE_CATEGORIES as SERVICE_CATEGORIES,
  type AnyServiceCategory as ServiceCategory,
} from "@/lib/service-categories";
import { createCheckoutSession, CheckoutSessionError } from "@/lib/payments";
import { getReviewEligibility } from "@/lib/review";
import ReviewForm from "@/components/dashboard/ReviewForm";
import ChatPanel from "@/components/dashboard/ChatPanel";
import BookingTimeline, { type PublicTimelineEvent } from "@/components/dashboard/BookingTimeline";
import { API_BASE } from "@/lib/api";

/** Types — mirror the backend Booking Details DTO exactly.
 *  GET /api/bookings/:id (verifyToken + verifyCustomer, customer's own booking)
 *  returns { success, data }; the safe DTO excludes customer identity, serviceId
 *  and securityDeposit. Mongo dates serialize as ISO strings; finalAmount is only
 *  set once a job is completed. */
export interface BookingDetails {
  /** Mongo ObjectId hex string — the booking reference. */
  id: string;
  service: {
    title: string;
    category: ServiceCategory;
    location: string;
    image: string;
    hourlyRate: number;
  };
  technician: {
    id: string;
    name: string;
  };
  problemDescription: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  /** Only present once the technician settles the final repair charge. */
  finalAmount?: number;
  /** The customer's own review of this booking, when submitted. */
  review?: {
    rating: number;
    comment: string;
    createdAt: string;
  };
  /** Optional appointment schedule. */
  schedule?: {
    date: string;
    slotStart: string;
    slotEnd: string;
    durationMinutes: number;
    timezone: string;
  };
  /** Server-written timeline events. */
  timeline?: PublicTimelineEvent[];
  /** Unread messages for the viewing participant. */
  chatUnread?: number;
  /** Invoice snapshot once issued. */
  invoice?: {
    number: string;
    issuedAt: string;
    currency: string;
    serviceAmount: number;
    discountAmount: number;
    discountCode?: string;
    taxAmount: number;
    totalAmount: number;
    paymentStatus: string;
    paidAt?: string;
    bookingReference: string;
  };
  createdAt: string;
  updatedAt: string;
}

type BookingDetailsErrorKind =
  | "unauthorized"
  | "network"
  | "server"
  | "parse"
  | "notfound"
  | "invalid"
  | "conflict";

class BookingDetailsError extends Error {
  readonly kind: BookingDetailsErrorKind;
  constructor(kind: BookingDetailsErrorKind, message: string) {
    super(message);
    this.name = "BookingDetailsError";
    this.kind = kind;
  }
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new BookingDetailsError(
      "parse",
      "The server returned an unexpected booking payload."
    );
  }
  return value;
}

function requiredFiniteNumber(
  record: Record<string, unknown>,
  key: string
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BookingDetailsError(
      "parse",
      "The server returned an unexpected booking payload."
    );
  }
  return value;
}

function optionalFiniteNumber(
  record: Record<string, unknown>,
  key: string
): number | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BookingDetailsError(
      "parse",
      "The server returned an unexpected booking payload."
    );
  }
  return value;
}

function requiredEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[]
): T {
  const value = record[key];
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new BookingDetailsError(
      "parse",
      "The server returned an unknown value in a booking field."
    );
  }
  return value as T;
}

function parseReview(raw: unknown): BookingDetails["review"] {
  if (raw === undefined || raw === null) return undefined;
  if (!isRecord(raw)) {
    throw new BookingDetailsError(
      "parse",
      "The server returned an unexpected review payload."
    );
  }
  const rating = raw.rating;
  if (
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    throw new BookingDetailsError(
      "parse",
      "The server returned an unexpected review rating."
    );
  }
  const comment = raw.comment;
  if (typeof comment !== "string" || comment.trim().length === 0) {
    throw new BookingDetailsError(
      "parse",
      "The server returned an unexpected review comment."
    );
  }
  const createdAt = raw.createdAt;
  if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) {
    throw new BookingDetailsError(
      "parse",
      "The server returned an unexpected review date."
    );
  }
  return { rating, comment, createdAt };
}

function optionalTimeline(raw: unknown): PublicTimelineEvent[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const events: PublicTimelineEvent[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const type = item.type;
    const at = item.at;
    const by = item.by;
    if (typeof type !== "string" || typeof at !== "string" || typeof by !== "string") continue;
    events.push({
      type,
      at,
      by,
      ...(typeof item.note === "string" && item.note ? { note: item.note } : {}),
    });
  }
  return events.length > 0 ? events : undefined;
}

function optionalSchedule(raw: unknown): BookingDetails["schedule"] | undefined {
  if (!isRecord(raw)) return undefined;
  if (
    typeof raw.date !== "string" ||
    typeof raw.slotStart !== "string" ||
    typeof raw.slotEnd !== "string" ||
    typeof raw.durationMinutes !== "number" ||
    typeof raw.timezone !== "string"
  ) {
    return undefined;
  }
  return {
    date: raw.date,
    slotStart: raw.slotStart,
    slotEnd: raw.slotEnd,
    durationMinutes: raw.durationMinutes,
    timezone: raw.timezone,
  };
}

function optionalInvoice(raw: unknown): BookingDetails["invoice"] {
  if (!isRecord(raw)) return undefined;
  if (
    typeof raw.number !== "string" ||
    typeof raw.issuedAt !== "string" ||
    typeof raw.currency !== "string" ||
    typeof raw.serviceAmount !== "number" ||
    typeof raw.discountAmount !== "number" ||
    typeof raw.taxAmount !== "number" ||
    typeof raw.totalAmount !== "number" ||
    typeof raw.paymentStatus !== "string" ||
    typeof raw.bookingReference !== "string"
  ) {
    return undefined;
  }
  return {
    number: raw.number,
    issuedAt: raw.issuedAt,
    currency: raw.currency,
    serviceAmount: raw.serviceAmount,
    discountAmount: raw.discountAmount,
    ...(typeof raw.discountCode === "string" && raw.discountCode ? { discountCode: raw.discountCode } : {}),
    taxAmount: raw.taxAmount,
    totalAmount: raw.totalAmount,
    paymentStatus: raw.paymentStatus,
    ...(typeof raw.paidAt === "string" && raw.paidAt ? { paidAt: raw.paidAt } : {}),
    bookingReference: raw.bookingReference,
  };
}

function parseBookingDetails(raw: unknown): BookingDetails {
  if (!isRecord(raw)) {
    throw new BookingDetailsError(
      "parse",
      "The server returned an unexpected booking payload."
    );
  }

  const id = requiredString(raw, "id");
  const service = raw.service;
  if (!isRecord(service)) {
    throw new BookingDetailsError(
      "parse",
      "The server returned an unexpected booking payload."
    );
  }
  const technician = raw.technician;
  if (!isRecord(technician)) {
    throw new BookingDetailsError(
      "parse",
      "The server returned an unexpected booking payload."
    );
  }

  return {
    id,
    service: {
      title: requiredString(service, "title"),
      category: requiredEnum(service, "category", SERVICE_CATEGORIES),
      location: requiredString(service, "location"),
      image: typeof service.image === "string" ? service.image.trim() : "",
      hourlyRate: requiredFiniteNumber(service, "hourlyRate"),
    },
    technician: {
      id: requiredString(technician, "id"),
      name: requiredString(technician, "name"),
    },
    problemDescription:
      typeof raw.problemDescription === "string" ? raw.problemDescription : "",
    status: requiredEnum(raw, "status", BOOKING_STATUSES),
    paymentStatus: requiredEnum(raw, "paymentStatus", PAYMENT_STATUSES),
    finalAmount: optionalFiniteNumber(raw, "finalAmount"),
    review: parseReview(raw.review),
    schedule: optionalSchedule(raw.schedule),
    timeline: optionalTimeline(raw.timeline),
    chatUnread: typeof raw.chatUnread === "number" && Number.isFinite(raw.chatUnread) ? raw.chatUnread : undefined,
    invoice: optionalInvoice(raw.invoice),
    createdAt: requiredString(raw, "createdAt"),
    updatedAt: requiredString(raw, "updatedAt"),
  };
}

function parseDetailsResponse(body: unknown): BookingDetails {
  if (!isRecord(body)) {
    throw new BookingDetailsError(
      "parse",
      "The server returned an unexpected response."
    );
  }
  if (body.success !== true) {
    const message =
      typeof body.message === "string" && body.message.length > 0 && body.message.length <= 200
        ? body.message
        : "The server couldn't load this booking.";
    throw new BookingDetailsError("server", message);
  }
  return parseBookingDetails(body.data);
}

// API calls — the JWT is fetched per request cycle and never stored, logged
// or persisted anywhere. Identity comes only from the verified JWT; no
// client-supplied customer identity is ever sent.
/** Retrieve a short-lived JWT from the Better Auth server (`/api/auth/token`,
 *  session-cookie gated). Returns the token string only. */
async function fetchAccessToken(): Promise<string> {
  let response: {
    data: unknown;
    error: null | ({ status: number } & Record<string, unknown>);
  };
  try {
    // `Res` tells the unschema'd endpoint what the 200 body looks like;
    // the shape is narrowed at runtime below regardless.
    response = await authClient.$fetch<{ token: string }>("/token", {
      method: "GET",
    });
  } catch {
    throw new BookingDetailsError(
      "network",
      "Couldn't reach the FixMate server to verify your session. Check your connection and try again."
    );
  }

  if (response.error) {
    const status = response.error.status;
    if (status === 401 || status === 403) {
      throw new BookingDetailsError(
        "unauthorized",
        "Your session has expired. Sign in again to view this booking."
      );
    }
    throw new BookingDetailsError(
      "server",
      "We couldn't verify your session with FixMate right now. Please try again."
    );
  }

  // `data` is typed from the generic above but the endpoint lives outside
  // the typed client surface — narrow it honestly anyway.
  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new BookingDetailsError(
      "parse",
      "The FixMate server returned an unexpected session-token response."
    );
  }
  return data.token;
}

async function fetchBookingDetails(
  bookingId: string,
  signal: AbortSignal
): Promise<BookingDetails> {
  const token = await fetchAccessToken();

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE}/api/bookings/${encodeURIComponent(bookingId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        signal,
      }
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new BookingDetailsError(
      "network",
      "Couldn't reach the FixMate server. Check your connection and try again."
    );
  }

  if (response.status === 401) {
    throw new BookingDetailsError(
      "unauthorized",
      "Your session has expired. Sign in again to view this booking."
    );
  }

  if (response.status === 400) {
    throw new BookingDetailsError(
      "invalid",
      "This booking reference isn't valid. Check the link and try again."
    );
  }

  if (response.status === 404) {
    throw new BookingDetailsError(
      "notfound",
      "We couldn't find this booking. It may have been cancelled or removed, or the link is incorrect."
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Handled below — a non-JSON error page or empty body.
  }

  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.message === "string" && body.message.length <= 200
        ? body.message
        : "The server couldn't load this booking. Please try again.";
    throw new BookingDetailsError("server", message);
  }

  return parseDetailsResponse(body);
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatBookingDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return `${dateFormatter.format(date)} · ${timeFormatter.format(date)}`;
}

/** Plain localized number — the backend carries no currency metadata, so
 *  no currency symbol is invented here. */
function formatAmount(value: number): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  requested: "Requested",
  accepted: "Accepted",
  "in-progress": "In Progress",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<BookingStatus, string> = {
  requested: "border-warning/40 bg-warning-soft text-warning",
  accepted:
    "border-accent-500/40 bg-accent-50 text-accent-strong dark:border-accent-400/30 dark:bg-accent-400/10 dark:text-accent",
  "in-progress":
    "border-accent-500/50 bg-accent-500/15 text-accent-strong dark:border-accent-400/40 dark:bg-accent-400/15 dark:text-accent",
  completed: "border-success/40 bg-success-soft text-success",
  rejected: "border-error/40 bg-error-soft text-error",
  cancelled: "border-border-strong bg-surface-muted text-muted",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  refunded: "Refunded",
};

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  unpaid: "border-warning/40 bg-warning-soft text-warning",
  paid: "border-success/40 bg-success-soft text-success",
  refunded: "border-border-strong bg-surface-muted text-muted",
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${className}`}
    >
      {label}
    </span>
  );
}

function technicianInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function DetailsSkeleton() {
  return (
    <div role="status" aria-label="Loading booking details…" className="space-y-6">
      <span className="sr-only">Loading booking details…</span>
      <div
        aria-hidden="true"
        className="grid gap-6 lg:grid-cols-3"
      >
        <div className="space-y-6 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
              <div className="h-40 w-full animate-pulse rounded-xl bg-surface-muted sm:h-auto sm:w-44" />
              <div className="flex-1 space-y-3">
                <div className="h-6 w-2/3 animate-pulse rounded bg-surface-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-surface-muted" />
                <div className="flex gap-2 pt-2">
                  <div className="h-6 w-20 animate-pulse rounded-full bg-surface-muted" />
                  <div className="h-6 w-20 animate-pulse rounded-full bg-surface-muted" />
                </div>
                <div className="h-8 w-40 animate-pulse rounded-lg bg-surface-muted" />
              </div>
            </div>
          </div>
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-surface" />
          <div className="h-24 animate-pulse rounded-2xl border border-border bg-surface" />
        </div>
        <div className="h-96 animate-pulse rounded-2xl border border-border bg-surface" />
      </div>
    </div>
  );
}

function BackToBookingsLink() {
  return (
    <Link
      href="/dashboard/bookings"
      className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted cursor-pointer active:bg-surface-muted"
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
      Back to My Bookings
    </Link>
  );
}

function DetailsErrorPanel({
  error,
  onRetry,
}: {
  error: BookingDetailsError;
  onRetry: () => void;
}) {
  const unauthorized = error.kind === "unauthorized";
  const notfound = error.kind === "notfound";
  const invalid = error.kind === "invalid";
  const title = unauthorized
    ? "Session expired"
    : invalid
      ? "Invalid booking link"
      : notfound
        ? "Booking not found"
        : "Couldn't load this booking";

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
      <h2 className="mt-3 text-lg font-bold text-heading">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
        {error.message}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {unauthorized ? (
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]"
          >
            Sign in again
          </Link>
        ) : invalid || notfound ? (
          <BackToBookingsLink />
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

function CopyReferenceButton({ reference }: { reference: string }) {
  const [feedback, setFeedback] = useState<"idle" | "copied" | "failed">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reference);
      setFeedback("copied");
    } catch {
      // Clipboard API unavailable (permissions, non-secure context) —
      // say so honestly instead of pretending it worked.
      setFeedback("failed");
    }
  }

  useEffect(() => {
    if (feedback === "idle") return;
    const timeout = window.setTimeout(() => setFeedback("idle"), 2000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy booking reference"
        title="Copy booking reference"
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-heading cursor-pointer active:scale-95"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-4 w-4"
        >
          {feedback === "copied" ? (
            <path d="M20 6 9 17l-5-5" />
          ) : (
            <>
              <rect x="9" y="9" width="12" height="12" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
            </>
          )}
        </svg>
      </button>
      <span
        aria-live="polite"
        className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
          feedback === "failed" ? "text-error" : "text-success"
        } ${feedback === "idle" ? "sr-only" : ""}`}
      >
        {feedback === "failed" ? "Copy failed" : "Copied"}
      </span>
    </span>
  );
}

function PayNowSection({
  bookingId,
  finalAmount,
}: {
  bookingId: string;
  finalAmount: number;
}) {
  const [pending, setPending] = useState(false);

  async function handlePayNow() {
    // Guard against double clicks while the session is being created.
    if (pending) return;
    setPending(true);

    try {
      const checkoutUrl = await createCheckoutSession(bookingId);
      // Hard navigation to Stripe's hosted Checkout — the only correct
      // place to enter payment details.
      window.location.assign(checkoutUrl);
      // Keep the button disabled: navigation is in flight.
    } catch (error) {
      if (error instanceof CheckoutSessionError) {
        toast.error(error.message);
      } else {
        toast.error("Something went wrong while starting the payment. Please try again.");
      }
      setPending(false);
    }
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Amount due
          </p>
          <p className="mt-0.5 text-xl font-extrabold tabular-nums text-heading">
            {formatAmount(finalAmount)}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handlePayNow}
        disabled={pending}
        aria-busy={pending}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 enabled:hover:bg-primary-hover enabled:hover:shadow-md enabled:active:bg-primary-hover enabled:active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? (
          <>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            </svg>
            Redirecting to Stripe…
          </>
        ) : (
          <>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
              <path d="M6 15h4" />
            </svg>
            Pay now with Stripe
          </>
        )}
      </button>
      <p className="mt-2 text-center text-[11px] leading-snug text-muted">
        Secure Stripe Checkout — you will be redirected to complete the payment.
      </p>
    </div>
  );
}

function BookingImage({ booking }: { booking: BookingDetails }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = booking.service.image.length > 0 && !imageFailed;

  if (!showImage) {
    return (
      <div
        aria-hidden="true"
        className="flex h-40 w-full items-center justify-center bg-navy-900 sm:h-auto sm:w-44 sm:self-stretch"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-12 w-12 text-accent-400/60"
        >
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="relative h-40 w-full shrink-0 overflow-hidden bg-navy-900 sm:h-auto sm:w-44">
      {/* eslint-disable-next-line @next/next/no-img-element -- backend image URLs are remote and not known at build time, so next/image remotePatterns can't be configured. */}
      <img
        src={booking.service.image}
        alt={booking.service.title}
        loading="lazy"
        decoding="async"
        onError={() => setImageFailed(true)}
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
    </div>
  );
}

function SummaryRow({
  label,
  children,
  bordered = true,
}: {
  label: string;
  children: React.ReactNode;
  bordered?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        bordered ? "border-b border-border pb-3.5" : ""
      }`}
    >
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </dt>
      <dd className="min-w-0 text-right text-xs font-medium text-heading">{children}</dd>
    </div>
  );
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span
      role="img"
      aria-label={`Rated ${rating} out of 5 stars`}
      className="flex items-center gap-0.5"
    >
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < rating;
        return (
          <svg
            key={index}
            viewBox="0 0 24 24"
            width="17"
            height="17"
            fill={filled ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`h-[17px] w-[17px] ${filled ? "text-warning" : "text-border-strong"}`}
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        );
      })}
    </span>
  );
}

function BookingDetailsView({
  booking,
  onReviewSubmitted,
}: {
  booking: BookingDetails;
  onReviewSubmitted: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Hero card */}
        <section
          aria-labelledby="booking-service-title"
          className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs"
        >
          <div className="flex flex-col sm:flex-row">
            <BookingImage booking={booking} />
            <div className="min-w-0 flex-1 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2
                    id="booking-service-title"
                    className="text-lg font-bold leading-snug text-heading sm:text-xl"
                  >
                    {booking.service.title}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    <span className="font-medium text-foreground">
                      {booking.service.category}
                    </span>
                    <span aria-hidden="true"> · </span>
                    {booking.service.location}
                  </p>
                </div>
                <Badge
                  label={STATUS_LABELS[booking.status]}
                  className={STATUS_STYLES[booking.status]}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                {booking.schedule && (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-strong dark:text-accent"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                    <span className="text-xs font-semibold text-heading">
                      {new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${booking.schedule.date}T12:00:00Z`))}
                      <span aria-hidden="true"> · </span>
                      {booking.schedule.slotStart}–{booking.schedule.slotEnd}
                      <span aria-hidden="true"> · </span>
                      <span className="font-normal text-muted">{booking.schedule.timezone}</span>
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Hourly rate
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-heading">
                    {formatAmount(booking.service.hourlyRate)}
                    <span className="text-xs font-medium text-muted">/hr</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Payment
                  </p>
                  <p className="mt-1">
                    <Badge
                      label={PAYMENT_LABELS[booking.paymentStatus]}
                      className={PAYMENT_STYLES[booking.paymentStatus]}
                    />
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem description */}
        <section
          aria-labelledby="booking-problem-heading"
          className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6"
        >
          <h2
            id="booking-problem-heading"
            className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-muted"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4 text-accent-500"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M9 13h6M9 17h6M9 9h1" />
            </svg>
            Problem description
          </h2>
          {booking.problemDescription.trim().length > 0 ? (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">
              {booking.problemDescription}
            </p>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              No problem description was provided for this booking.
            </p>
          )}
        </section>

        {/* Technician */}
        <section
          aria-labelledby="booking-technician-heading"
          className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6"
        >
          <h2
            id="booking-technician-heading"
            className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-muted"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4 text-accent-500"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            Technician
          </h2>
          <div className="mt-4 flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-navy-900 text-base font-bold tracking-wide text-accent-400 ring-1 ring-inset ring-accent-400/30"
            >
              {technicianInitials(booking.technician.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-heading">
                {booking.technician.name}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Assigned repair technician for this booking.
              </p>
            </div>
          </div>
        </section>

        {/* Timeline */}
        {booking.timeline && booking.timeline.length > 0 && (
          <section
            aria-labelledby="booking-timeline-heading"
            className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6"
          >
            <h2
              id="booking-timeline-heading"
              className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-muted"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4 text-accent-500"
              >
                <path d="M10 13a5 5 0 0 0 7.07 0l3.54-3.54a5 5 0 0 0-7.07-7.07L12 4" />
                <path d="M14 11a5 5 0 0 0-7.07 0L3.4 14.54a5 5 0 0 0 7.07 7.07L12 20" />
              </svg>
              Timeline
            </h2>
            <BookingTimeline events={booking.timeline} />
          </section>
        )}

        {/* Invoice — completed bookings only */}
        {booking.status === "completed" && (
          <section
            aria-labelledby="booking-invoice-heading"
            className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6"
          >
            <h2
              id="booking-invoice-heading"
              className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-muted"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4 text-accent-500"
              >
                <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
                <path d="M8 7h8M8 12h8M8 17h4" />
              </svg>
              Invoice
            </h2>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                {booking.invoice ? (
                  <>
                    <p className="font-mono text-sm font-bold text-heading">{booking.invoice.number}</p>
                    <p className="mt-0.5 text-xs capitalize text-muted">{booking.invoice.paymentStatus.replace(/_/g, " ")} · {new Intl.NumberFormat("en-US", { style: "currency", currency: booking.invoice.currency.toUpperCase() }).format(booking.invoice.totalAmount)}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted">Your invoice is ready as soon as the booking settles.</p>
                )}
              </div>
              <Link
                href={`/dashboard/bookings/${booking.id}/invoice`}
                className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-heading transition-colors hover:bg-surface-muted"
              >
                View invoice
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
            </div>
          </section>
        )}

        {/* Conversation with the technician */}
        <ChatPanel bookingId={booking.id} />

        {/* Review — only for completed bookings owned by this customer */}
        {getReviewEligibility(booking.status, booking.review) !== "not-completed" && (
          <section
            aria-labelledby="booking-review-heading"
            className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6"
          >
            <h2
              id="booking-review-heading"
              className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-muted"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4 text-accent-500"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Your Review
            </h2>

            {booking.review ? (
              <figure className="mt-4 rounded-2xl border border-accent-500/25 bg-accent-50/40 p-5 dark:bg-surface-muted/40">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <ReviewStars rating={booking.review.rating} />
                  <time
                    dateTime={booking.review.createdAt}
                    className="text-[11px] font-medium tabular-nums text-muted"
                  >
                    {formatBookingDate(booking.review.createdAt)}
                  </time>
                </div>
                <blockquote className="mt-3 whitespace-pre-line text-sm leading-6 text-foreground">
                  &ldquo;{booking.review.comment}&rdquo;
                </blockquote>
                <figcaption className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-success">
                  Published — thank you for your feedback
                </figcaption>
              </figure>
            ) : (
              <div className="mt-4">
                <ReviewForm
                  bookingId={booking.id}
                  onSubmitted={onReviewSubmitted}
                />
              </div>
            )}
          </section>
        )}
      </div>

      <aside
        aria-labelledby="booking-summary-heading"
        className="h-fit rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6 lg:sticky lg:top-6"
      >
        <h2
          id="booking-summary-heading"
          className="text-sm font-bold uppercase tracking-[0.14em] text-muted"
        >
          Booking summary
        </h2>
        <dl className="mt-4 flex flex-col gap-3.5">
          <SummaryRow label="Reference">
            <span className="inline-flex items-center gap-1.5">
              <code className="select-all rounded-md bg-surface-muted px-2 py-1 font-mono text-[11px] font-semibold text-foreground">
                {booking.id}
              </code>
              <CopyReferenceButton reference={booking.id} />
            </span>
          </SummaryRow>
          <SummaryRow label="Status">
            <Badge
              label={STATUS_LABELS[booking.status]}
              className={STATUS_STYLES[booking.status]}
            />
          </SummaryRow>
          <SummaryRow label="Payment">
            <Badge
              label={PAYMENT_LABELS[booking.paymentStatus]}
              className={PAYMENT_STYLES[booking.paymentStatus]}
            />
          </SummaryRow>
          <SummaryRow label="Hourly rate">
            <span className="tabular-nums">{formatAmount(booking.service.hourlyRate)}/hr</span>
          </SummaryRow>
          {typeof booking.finalAmount === "number" && (
            <SummaryRow label="Final amount">
              <span className="font-bold tabular-nums text-heading">
                {formatAmount(booking.finalAmount)}
              </span>
            </SummaryRow>
          )}
          <SummaryRow label="Booked">{formatBookingDate(booking.createdAt)}</SummaryRow>
          <SummaryRow label="Last updated" bordered={false}>
            {formatBookingDate(booking.updatedAt)}
          </SummaryRow>
        </dl>
        {booking.status === "completed" &&
        booking.paymentStatus === "unpaid" &&
        typeof booking.finalAmount === "number" ? (
          <PayNowSection bookingId={booking.id} finalAmount={booking.finalAmount} />
        ) : booking.paymentStatus === "paid" ? (
          <p className="mt-5 border-t border-border pt-4 text-[11px] leading-relaxed text-muted">
            <span className="font-semibold text-success">Payment received.</span>{" "}
            This booking has been paid in full via Stripe Checkout.
          </p>
        ) : (
          <p className="mt-5 border-t border-border pt-4 text-[11px] leading-relaxed text-muted">
            Payment becomes available once the technician completes the repair
            and settles the final amount.
          </p>
        )}
      </aside>
    </div>
  );
}

/* Customer-only screen — lives in this client module because the dashboard
 * layout is client and the role check mirrors /dashboard/bookings exactly.
 * The route page is a Server Component so it can opt out of instant-
 * navigation validation (`instant = false`). */
function ScreenSkeleton() {
  return (
    <div role="status" aria-label="Loading booking details…" className="space-y-6">
      <span className="sr-only">Loading booking details…</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="h-36 animate-pulse rounded-2xl bg-surface-muted/70" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="h-44 animate-pulse rounded-2xl bg-surface-muted/70" />
            <div className="h-32 animate-pulse rounded-2xl bg-surface-muted/70" />
          </div>
          <div className="h-72 animate-pulse rounded-2xl bg-surface-muted/70" />
        </div>
      </div>
    </div>
  );
}

function AccessDenied({ role }: { role: "technician" | "admin" | null }) {
  const roleLabel = role === "technician" ? "technician" : role === "admin" ? "admin" : null;
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
        This page is for customer accounts
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {roleLabel
          ? `You're signed in with a ${roleLabel} account, so Booking Details isn't available here. Your dashboard only shows the sections your role can use.`
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

export function BookingDetailsScreen({ bookingId }: { bookingId: string }) {
  // Session atom is already resolved by the layout — this resolves instantly.
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const role = roleFromUser(user);

  if (isPending) return <ScreenSkeleton />;

  // Signed out — the layout is redirecting; render nothing private.
  if (!user) return null;

  // Customer-only gate. Known non-customer roles (and unknown roles) are
  // refused here; the backend enforces the same rule independently.
  if (role !== "customer") return <AccessDenied role={role} />;

  return <BookingDetails bookingId={bookingId} />;
}

export default function BookingDetails({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: BookingDetailsError }
    | { phase: "success"; data: BookingDetails }
  >({ phase: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetchBookingDetails(bookingId, controller.signal)
      .then((data) => {
        if (cancelled) return;
        setState({ phase: "success", data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof BookingDetailsError) {
          setState({ phase: "error", error });
          return;
        }
        setState({
          phase: "error",
          error: new BookingDetailsError(
            "server",
            "Something went wrong while loading this booking. Please try again."
          ),
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [bookingId, reloadToken]);

  // Revalidate in the background when the window regains focus or
  // visibility — e.g. the customer returns from the Stripe Checkout tab
  // or restores this page from the back/forward cache. Keeps stale
  // "Pending" badges from lingering; never flashes a skeleton.
  const lastRevalidateRef = useRef(0);
  useEffect(() => {
    function revalidate() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRevalidateRef.current < 500) return;
      lastRevalidateRef.current = now;
      setReloadToken((token) => token + 1);
    }
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, []);

  function reload() {
    // Event handler — setting the loading phase synchronously is fine.
    setState({ phase: "loading" });
    setReloadToken((token) => token + 1);
  }

  function refreshSilently() {
    // Background revalidation without flashing the skeleton — used after a
    // review is submitted so the published review replaces the form. Also
    // revalidates server components so rating aggregates refresh everywhere.
    setReloadToken((token) => token + 1);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <BackToBookingsLink />
        {state.phase === "success" && (
          <p aria-live="polite" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Reference{" "}
            <span className="font-mono text-foreground">{state.data.id}</span>
          </p>
        )}
      </div>

      {state.phase === "loading" && <DetailsSkeleton />}

      {state.phase === "error" && (
        <DetailsErrorPanel error={state.error} onRetry={reload} />
      )}

      {state.phase === "success" && (
        <BookingDetailsView booking={state.data} onReviewSubmitted={refreshSilently} />
      )}
    </div>
  );
}
