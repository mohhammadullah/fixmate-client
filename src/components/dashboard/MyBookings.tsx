"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { createCheckoutSession, CheckoutSessionError } from "@/lib/payments";
import {
  ALL_SERVICE_CATEGORIES,
  type AnyServiceCategory,
} from "@/lib/service-categories";

/** Types mirror the backend contract exactly:
 *  GET /api/bookings/my (verifyToken + verifyCustomer) returns
 *  { success, data, pagination }; dates serialize as strings; finalAmount is
 *  only set once a job is completed. */

export const BOOKING_STATUSES = [
  "requested",
  "accepted",
  "in-progress",
  "completed",
  "rejected",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface CustomerBooking {
  _id: string;
  serviceId: string;
  customerId: string;
  technicianId: string;
  customerName: string;
  customerEmail: string;
  technicianName: string;
  technicianEmail: string;
  serviceTitle: string;
  serviceCategory: AnyServiceCategory;
  serviceLocation: string;
  serviceImage: string;
  hourlyRate: number;
  securityDeposit: number;
  problemDescription: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  /** Optional appointment schedule (present when chosen at booking time). */
  schedule?: {
    date: string;
    slotStart: string;
    slotEnd: string;
    durationMinutes: number;
    timezone: string;
  };
  /** Only present once the technician settles the final repair charge. */
  finalAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookingsPagination {
  currentPage: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface BookingsPageData {
  items: CustomerBooking[];
  pagination: BookingsPagination;
}

type BookingsErrorKind =
  | "unauthorized"
  | "network"
  | "server"
  | "parse"
  | "notfound"
  | "conflict";

class BookingsError extends Error {
  readonly kind: BookingsErrorKind;
  constructor(kind: BookingsErrorKind, message: string) {
    super(message);
    this.name = "BookingsError";
    this.kind = kind;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const PAGE_SIZE = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new BookingsError("parse", "The server returned an unexpected booking payload.");
  }
  return value;
}

function requiredFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BookingsError("parse", "The server returned an unexpected booking payload.");
  }
  return value;
}

function optionalFiniteNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BookingsError("parse", "The server returned an unexpected booking payload.");
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
    throw new BookingsError("parse", "The server returned an unknown value in a booking field.");
  }
  return value as T;
}

function optionalScheduleValue(raw: unknown): CustomerBooking["schedule"] {
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

function parseBooking(raw: unknown): CustomerBooking {
  if (!isRecord(raw)) {
    throw new BookingsError("parse", "The server returned an unexpected booking payload.");
  }
  return {
    _id: requiredString(raw, "_id"),
    serviceId: requiredString(raw, "serviceId"),
    customerId: requiredString(raw, "customerId"),
    technicianId: requiredString(raw, "technicianId"),
    customerName: requiredString(raw, "customerName"),
    customerEmail: requiredString(raw, "customerEmail"),
    technicianName: requiredString(raw, "technicianName"),
    technicianEmail: requiredString(raw, "technicianEmail"),
    serviceTitle: requiredString(raw, "serviceTitle"),
    serviceCategory: requiredEnum(raw, "serviceCategory", ALL_SERVICE_CATEGORIES),
    serviceLocation: requiredString(raw, "serviceLocation"),
    serviceImage: typeof raw.serviceImage === "string" ? raw.serviceImage : "",
    hourlyRate: requiredFiniteNumber(raw, "hourlyRate"),
    securityDeposit:
      typeof raw.securityDeposit === "number" && Number.isFinite(raw.securityDeposit)
        ? raw.securityDeposit
        : 0,
    problemDescription:
      typeof raw.problemDescription === "string" ? raw.problemDescription : "",
    status: requiredEnum(raw, "status", BOOKING_STATUSES),
    paymentStatus: requiredEnum(raw, "paymentStatus", PAYMENT_STATUSES),
    finalAmount: optionalFiniteNumber(raw, "finalAmount"),
    schedule: optionalScheduleValue(raw.schedule),
    createdAt: requiredString(raw, "createdAt"),
    updatedAt: requiredString(raw, "updatedAt"),
  };
}

function parsePagination(raw: unknown): BookingsPagination {
  if (!isRecord(raw)) {
    throw new BookingsError("parse", "The server returned an unexpected pagination payload.");
  }
  const currentPage = requiredFiniteNumber(raw, "currentPage");
  const limit = requiredFiniteNumber(raw, "limit");
  const totalItems = requiredFiniteNumber(raw, "totalItems");
  const totalPages = requiredFiniteNumber(raw, "totalPages");
  if (
    typeof raw.hasNextPage !== "boolean" ||
    typeof raw.hasPrevPage !== "boolean"
  ) {
    throw new BookingsError("parse", "The server returned an unexpected pagination payload.");
  }
  return {
    currentPage,
    limit,
    totalItems,
    totalPages,
    hasNextPage: raw.hasNextPage,
    hasPrevPage: raw.hasPrevPage,
  };
}

function parseBookingsResponse(body: unknown): BookingsPageData {
  if (!isRecord(body)) {
    throw new BookingsError("parse", "The server returned an unexpected response.");
  }
  if (body.success !== true) {
    const message =
      typeof body.message === "string" && body.message.length > 0 && body.message.length <= 200
        ? body.message
        : "The server couldn't load your bookings.";
    throw new BookingsError("server", message);
  }
  if (!Array.isArray(body.data)) {
    throw new BookingsError("parse", "The server returned an unexpected bookings payload.");
  }
  return {
    items: body.data.map(parseBooking),
    pagination: parsePagination(body.pagination),
  };
}

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
    throw new BookingsError(
      "network",
      "Couldn't reach the FixMate server to verify your session. Check your connection and try again."
    );
  }

  if (response.error) {
    const status = response.error.status;
    if (status === 401 || status === 403) {
      throw new BookingsError(
        "unauthorized",
        "Your session has expired. Sign in again to view your bookings."
      );
    }
    throw new BookingsError(
      "server",
      "We couldn't verify your session with FixMate right now. Please try again."
    );
  }

  // `data` is typed from the generic above but the endpoint lives outside
  // the typed client surface — narrow it honestly anyway.
  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new BookingsError(
      "parse",
      "The FixMate server returned an unexpected session-token response."
    );
  }
  return data.token;
}

async function fetchMyBookings(options: {
  page: number;
  limit: number;
  status: BookingStatus | "all";
  signal: AbortSignal;
}): Promise<BookingsPageData> {
  const token = await fetchAccessToken();

  const params = new URLSearchParams({
    page: String(options.page),
    limit: String(options.limit),
  });
  if (options.status !== "all") params.set("status", options.status);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/bookings/my?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new BookingsError(
      "network",
      "Couldn't reach the FixMate server. Check your connection and try again."
    );
  }

  if (response.status === 401) {
    throw new BookingsError(
      "unauthorized",
      "Your session has expired. Sign in again to view your bookings."
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
        : "The server couldn't load your bookings. Please try again.";
    throw new BookingsError("server", message);
  }

  return parseBookingsResponse(body);
}

/** PATCH /api/bookings/:id/cancel — the customer cancels their own
 *  "requested" booking. Sends an empty JSON object (the backend's strict
 *  object schema accepts nothing else) — never a customerId, never a
 *  status. The JWT is retrieved per call and never stored or logged.
 *  Returns the server's success message. */
async function cancelBookingRequest(bookingId: string): Promise<string> {
  const token = await fetchAccessToken();

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE}/api/bookings/${encodeURIComponent(bookingId)}/cancel`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: "{}",
      }
    );
  } catch {
    throw new BookingsError(
      "network",
      "Couldn't reach the FixMate server. Check your connection and try again."
    );
  }

  if (response.status === 401) {
    throw new BookingsError(
      "unauthorized",
      "Your session has expired. Sign in again to manage your bookings."
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON body — handled by the status checks below.
  }

  const serverMessage =
    isRecord(body) &&
    typeof body.message === "string" &&
    body.message.length > 0 &&
    body.message.length <= 200
      ? body.message
      : null;

  if (response.status === 404) {
    throw new BookingsError(
      "notfound",
      serverMessage ??
        "We couldn't find this booking. It may have already been cancelled or removed."
    );
  }

  if (response.status === 409) {
    throw new BookingsError(
      "conflict",
      serverMessage ??
        "This booking is no longer in a state that allows cancellation."
    );
  }

  if (!response.ok) {
    throw new BookingsError(
      "server",
      serverMessage ?? "The server couldn't cancel this booking. Please try again."
    );
  }

  if (isRecord(body) && body.success === false) {
    throw new BookingsError(
      "server",
      serverMessage ?? "The server couldn't cancel this booking. Please try again."
    );
  }

  return serverMessage ?? "Booking cancelled successfully.";
}

/** Apply a successful cancellation to the already-loaded page data.
 *
 *  - "all" / "cancelled" filters: the card stays in place, re-badged as
 *    cancelled, and the totals are unchanged.
 *  - any other filter: the booking no longer matches, so it is removed from
 *    the visible page and the totals are decremented; the current page is
 *    clamped to the new page range. */
function applyCancellation(
  data: BookingsPageData,
  bookingId: string,
  statusFilter: BookingStatus | "all",
  cancelledAt: string
): BookingsPageData {
  const items = data.items.map((booking) =>
    booking._id === bookingId
      ? { ...booking, status: "cancelled" as const, updatedAt: cancelledAt }
      : booking
  );

  if (statusFilter === "all" || statusFilter === "cancelled") {
    return { items, pagination: data.pagination };
  }

  const remaining = items.filter((booking) => booking._id !== bookingId);
  const totalItems = Math.max(0, data.pagination.totalItems - 1);
  const totalPages = Math.max(1, Math.ceil(totalItems / data.pagination.limit));
  const currentPage = Math.min(data.pagination.currentPage, totalPages);

  return {
    items: remaining,
    pagination: {
      ...data.pagination,
      currentPage,
      totalItems,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    },
  };
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

function BookingsSkeleton() {
  return (
    <div role="status" aria-label="Loading your bookings…" className="space-y-4">
      <span className="sr-only">Loading your bookings…</span>
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="overflow-hidden rounded-2xl border border-border bg-surface"
        >
          <div className="flex flex-col sm:flex-row">
            <div className="h-36 animate-pulse bg-surface-muted sm:h-auto sm:w-40" />
            <div className="flex-1 space-y-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="h-5 w-44 animate-pulse rounded bg-surface-muted" />
                <div className="h-5 w-20 animate-pulse rounded-full bg-surface-muted" />
              </div>
              <div className="h-3 w-56 animate-pulse rounded bg-surface-muted" />
              <div className="h-3 w-40 animate-pulse rounded bg-surface-muted" />
              <div className="flex gap-2 pt-2">
                <div className="h-6 w-24 animate-pulse rounded-full bg-surface-muted" />
                <div className="h-6 w-24 animate-pulse rounded-full bg-surface-muted" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorPanel({
  error,
  onRetry,
}: {
  error: BookingsError;
  onRetry: () => void;
}) {
  const unauthorized = error.kind === "unauthorized";
  return (
    <div
      role="alert"
      className="rounded-2xl border border-error/40 bg-error-soft/60 px-5 py-6 text-center sm:px-8"
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
        {unauthorized ? "Session expired" : "Couldn't load your bookings"}
      </h2>
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

function EmptyState({ filtered, onClearFilter, statusFilter }: { filtered: boolean; onClearFilter: () => void; statusFilter?: BookingStatus | "all" }) {
  if (filtered) {
    const cancelled = statusFilter === "cancelled";
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted/30 px-6 py-12 text-center">
        <h2 className="text-lg font-bold text-heading">{cancelled ? "No cancelled bookings" : "No matching bookings"}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          {cancelled
            ? "When a job is cancelled it will appear here and be kept for your records."
            : "You have no bookings with this status yet. Clear the filter to see everything."}
        </p>
        <button
          type="button"
          onClick={onClearFilter}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted cursor-pointer active:bg-surface-muted"
        >
          Clear filter
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted/30 px-6 py-14 text-center">
      <div
        aria-hidden="true"
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-900 text-accent-400 ring-1 ring-inset ring-accent-400/30"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8"
        >
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M8 2v4M16 2v4M3 9h18" />
          <path d="M9.5 14.5l2 2 3.5-3.5" />
        </svg>
      </div>
      <h2 className="mt-5 text-xl font-bold tracking-tight text-heading">No bookings yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        When you book a repair, it will show up here with its status and payment details.
        Browse our services to book your first visit.
      </p>
      <Link
        href="/services"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]"
      >
        Browse services
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

/** Pay Now — starts the shared Stripe Checkout flow for a completed, unpaid
 *  booking. The amount shown is display-only; the server re-reads it from the
 *  booking record, so a tampered client can never influence the charge. */
function PayNowButton({
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
    <button
      type="button"
      onClick={handlePayNow}
      disabled={pending}
      aria-busy={pending}
      className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-200 enabled:hover:bg-primary-hover enabled:hover:shadow-md enabled:active:bg-primary-hover enabled:active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="h-4 w-4 animate-spin motion-reduce:animate-none"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Starting payment…
        </>
      ) : (
        <>
          Pay Now
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{formatAmount(finalAmount)}</span>
        </>
      )}
    </button>
  );
}

/** Completed + paid — an explicit indicator in place of the Pay Now action. */
function PaidIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success-soft px-4 py-2 text-xs font-semibold text-success">
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
        <path d="M20 6 9 17l-5-5" />
      </svg>
      Paid
    </span>
  );
}

function BookingCard({
  booking,
  onCancelRequest,
}: {
  booking: CustomerBooking;
  onCancelRequest: (booking: CustomerBooking, trigger: HTMLButtonElement) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = booking.serviceImage.length > 0 && !imageFailed;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs transition-shadow duration-200 hover:shadow-md">
      <div className="flex flex-col sm:flex-row">
        {/* Service image — only when the API provides one */}
        <div className="relative h-36 w-full shrink-0 overflow-hidden bg-navy-900 sm:h-auto sm:w-40 lg:w-48">
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- backend image URLs are remote and not known at build time, so next/image remotePatterns can't be configured.
            <img
              src={booking.serviceImage}
              alt={booking.serviceTitle}
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center"
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
          )}
        </div>

        <div className="min-w-0 flex-1 p-4 sm:p-5">
          {/* Title + status */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold leading-snug text-heading">
                {booking.serviceTitle}
              </h3>
              <p className="mt-1 text-xs text-muted">
                <span className="font-medium text-foreground">{booking.serviceCategory}</span>
                <span aria-hidden="true"> · </span>
                {booking.serviceLocation}
              </p>
            </div>
            <Badge label={STATUS_LABELS[booking.status]} className={STATUS_STYLES[booking.status]} />
          </div>

          {/* Technician */}
          <p className="mt-3 flex items-center gap-2 text-sm text-foreground">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="min-w-0 truncate">
              <span className="text-muted">Technician: </span>
              <span className="font-semibold text-heading">{booking.technicianName}</span>
            </span>
          </p>

          {/* Appointment schedule */}
          {booking.schedule && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-accent-strong dark:text-accent">
              <svg
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-3 w-3"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              {new Intl.DateTimeFormat("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              }).format(new Date(`${booking.schedule.date}T12:00:00Z`))}
              <span aria-hidden="true"> · </span>
              {booking.schedule.slotStart}
            </p>
          )}

          {/* Problem description — real, customer-supplied data */}
          {booking.problemDescription && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">
              {booking.problemDescription}
            </p>
          )}

          {/* Facts row */}
          <dl className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-xs">
            <div className="flex items-baseline gap-1.5">
              <dt className="text-muted">Hourly rate</dt>
              <dd className="font-semibold tabular-nums text-heading">
                {formatAmount(booking.hourlyRate)}/hr
              </dd>
            </div>
            {typeof booking.finalAmount === "number" && (
              <div className="flex items-baseline gap-1.5">
                <dt className="text-muted">Final amount</dt>
                <dd className="font-semibold tabular-nums text-heading">
                  {formatAmount(booking.finalAmount)}
                </dd>
              </div>
            )}
            <div className="flex items-center gap-2">
              <dt className="sr-only">Payment status</dt>
              <dd>
                <Badge
                  label={PAYMENT_LABELS[booking.paymentStatus]}
                  className={PAYMENT_STYLES[booking.paymentStatus]}
                />
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-muted">Booked</dt>
              <dd className="font-medium text-foreground">
                {formatBookingDate(booking.createdAt)}
              </dd>
            </div>
          </dl>

          {/* Cancellation — only while the booking is still awaiting the technician */}
          {booking.status === "requested" && (
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-[11px] font-medium leading-snug text-muted">
                You can cancel while the technician hasn&apos;t responded yet.
              </p>
              <button
                type="button"
                onClick={(event) => onCancelRequest(booking, event.currentTarget)}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-error/40 bg-error-soft/50 px-4 py-2 text-xs font-semibold text-error transition-colors duration-200 hover:border-error/60 hover:bg-error-soft cursor-pointer active:bg-error-soft"
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
                  <circle cx="12" cy="12" r="9" />
                  <path d="M15 9l-6 6M9 9l6 6" />
                </svg>
                Cancel booking
              </button>
            </div>
          )}
          {/* Payment + details — Pay Now only for a completed, unpaid booking
              with a settled final amount; paid bookings show a Paid indicator.
              Everything else (requested/accepted/in-progress/cancelled/rejected,
              or an incomplete unpaid job) shows no payment action. */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <Link
              href={`/dashboard/bookings/${encodeURIComponent(booking._id)}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted cursor-pointer active:bg-surface-muted"
            >
              Booking details
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
            <div className="flex flex-wrap items-center gap-2">
              {booking.status === "completed" && booking.paymentStatus === "paid" && (
                <PaidIndicator />
              )}
              {booking.status === "completed" &&
                booking.paymentStatus === "unpaid" &&
                typeof booking.finalAmount === "number" &&
                booking.finalAmount > 0 && (
                  <PayNowButton bookingId={booking._id} finalAmount={booking.finalAmount} />
                )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Cancel confirmation dialog — custom, accessible, never native confirm()/alert().
 *  Focus is trapped while open, Escape dismisses, and focus returns to the triggering button on close. */
function CancelBookingDialog({
  booking,
  pending,
  error,
  onDismiss,
  onConfirm,
}: {
  booking: CustomerBooking;
  pending: boolean;
  error: string | null;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const keepBookingRef = useRef<HTMLButtonElement>(null);
  const onDismissRef = useRef(onDismiss);
  const pendingRef = useRef(pending);

  // Keep refs current for the mount-only listeners below.
  useEffect(() => {
    onDismissRef.current = onDismiss;
    pendingRef.current = pending;
  }, [onDismiss, pending]);

  // Mount-only: initial focus (the safe action), body scroll lock,
  // Escape to dismiss and a Tab focus trap inside the dialog.
  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    keepBookingRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!pendingRef.current) onDismissRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const focusOutside =
        !(active instanceof HTMLElement) || !node.contains(active);
      if (event.shiftKey) {
        if (active === first || focusOutside) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || focusOutside) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6">
      {/* Backdrop — click to dismiss (ignored while the request is in flight) */}
      <div
        aria-hidden="true"
        onClick={() => {
          if (!pendingRef.current) onDismissRef.current();
        }}
        className="absolute inset-0 bg-navy-950/70 backdrop-blur-[2px]"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-booking-title"
        aria-describedby="cancel-booking-description"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-error/40 bg-error-soft text-error"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2
                id="cancel-booking-title"
                className="text-base font-bold leading-snug text-heading"
              >
                Cancel this booking?
              </h2>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                FixMate · My Bookings
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            disabled={pending}
            aria-label="Close dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors duration-200 enabled:hover:bg-surface-muted enabled:hover:text-heading enabled:active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 sm:px-6">
          <p
            id="cancel-booking-description"
            className="text-sm leading-relaxed text-foreground"
          >
            This action cannot be undone. Your booking for{" "}
            <span className="font-semibold text-heading">
              {booking.serviceTitle}
            </span>{" "}
            with{" "}
            <span className="font-semibold text-heading">
              {booking.technicianName}
            </span>{" "}
            will be marked as cancelled and the reserved time will be released.
            If you change your mind, you&apos;ll need to make a new booking.
          </p>

          {/* Booking summary */}
          <dl className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-border bg-surface-muted/40 px-4 py-3 text-xs sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Service
              </dt>
              <dd className="mt-0.5 truncate font-medium text-heading">
                {booking.serviceTitle}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Technician
              </dt>
              <dd className="mt-0.5 truncate font-medium text-heading">
                {booking.technicianName}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Booked
              </dt>
              <dd className="mt-0.5 font-medium text-heading">
                {formatBookingDate(booking.createdAt)}
              </dd>
            </div>
          </dl>

          {/* In-dialog error — network/server failures can be retried */}
          {error && (
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
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button
            ref={keepBookingRef}
            type="button"
            onClick={onDismiss}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted enabled:active:bg-surface-muted cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            aria-live="polite"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-error px-5 py-2.5 text-sm font-semibold text-background shadow-sm transition-all duration-200 enabled:hover:brightness-95 enabled:active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? (
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
                Cancelling…
              </>
            ) : (
              "Confirm Cancellation"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


type BookingsNotice =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string; showRefresh: boolean };

export default function MyBookings() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [reloadToken, setReloadToken] = useState(0);

  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: BookingsError }
    | { phase: "success"; data: BookingsPageData }
  >({ phase: "loading" });

  const [cancelTarget, setCancelTarget] = useState<CustomerBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [notice, setNotice] = useState<BookingsNotice | null>(null);
  const cancelInFlightRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Handlers set the "loading" phase synchronously (event handlers may
  // setState freely); the effect only talks to the network.
  function beginLoading() {
    setState({ phase: "loading" });
  }

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetchMyBookings({ page, limit: PAGE_SIZE, status, signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        setState({ phase: "success", data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof BookingsError) {
          setState({ phase: "error", error });
          return;
        }
        setState({
          phase: "error",
          error: new BookingsError(
            "server",
            "Something went wrong while loading your bookings. Please try again."
          ),
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, status, reloadToken]);

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

  function handleStatusChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    beginLoading();
    setStatus(value === "all" ? "all" : (value as BookingStatus));
    setPage(1); // Reset pagination whenever the filter changes.
  }

  function goToPage(nextPage: number) {
    beginLoading();
    setPage(nextPage);
  }

  function reload() {
    beginLoading();
    setReloadToken((token) => token + 1);
  }

  function handleRequestCancel(booking: CustomerBooking, trigger: HTMLButtonElement) {
    returnFocusRef.current = trigger;
    setCancelError(null);
    setCancelTarget(booking);
  }

  function closeCancelDialog() {
    // Never dismiss mid-request — that would allow duplicate submissions.
    if (cancelInFlightRef.current) return;
    setCancelTarget(null);
    setCancelError(null);
    const trigger = returnFocusRef.current;
    returnFocusRef.current = null;
    // The card may have unmounted after a successful cancel — fall back to
    // the filter control so keyboard focus is never lost.
    if (trigger && document.contains(trigger)) {
      trigger.focus();
    } else {
      document.getElementById("booking-status-filter")?.focus();
    }
  }

  async function confirmCancellation() {
    const target = cancelTarget;
    if (!target || cancelInFlightRef.current) return;
    cancelInFlightRef.current = true;
    setCancelling(true);
    setCancelError(null);

    try {
      const message = await cancelBookingRequest(target._id);

      const previousData = state.phase === "success" ? state.data : null;
      if (previousData) {
        const nextData = applyCancellation(
          previousData,
          target._id,
          status,
          new Date().toISOString()
        );
        setState({ phase: "success", data: nextData });
        // The page emptied out under an active filter — step back a page.
        if (
          nextData.items.length === 0 &&
          previousData.pagination.currentPage > 1
        ) {
          beginLoading();
          setPage(nextData.pagination.currentPage);
        }
      }

      setNotice({ kind: "success", message });
      cancelInFlightRef.current = false;
      setCancelling(false);
      closeCancelDialog();
      return;
    } catch (error) {
      cancelInFlightRef.current = false;
      setCancelling(false);

      if (error instanceof BookingsError && error.kind === "unauthorized") {
        // Consistent with the list's 401 path — full session-expired panel.
        setCancelTarget(null);
        setCancelError(null);
        setState({ phase: "error", error });
        return;
      }
      if (
        error instanceof BookingsError &&
        (error.kind === "notfound" || error.kind === "conflict")
      ) {
        // The booking is gone or has moved on — close the dialog and let
        // the user refresh the list to resync.
        setCancelTarget(null);
        setCancelError(null);
        setNotice({ kind: "error", message: error.message, showRefresh: true });
        return;
      }
      // Network/server/parse failures — keep the dialog open so the
      // customer can retry.
      setCancelError(
        error instanceof BookingsError
          ? error.message
          : "Something went wrong while cancelling this booking. Please try again."
      );
    }
  }

  // Auto-dismiss the success notice; errors persist until dismissed.
  useEffect(() => {
    if (notice?.kind !== "success") return;
    const timeout = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const isLoading = state.phase === "loading";
  const totalItems = state.phase === "success" ? state.data.pagination.totalItems : null;
  const filtered = status !== "all";

  const selectBase =
    "w-full appearance-none rounded-lg border border-border-strong bg-surface py-2.5 pl-4 pr-10 text-sm font-medium text-foreground shadow-xs outline-none transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25 cursor-pointer";

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <label
            htmlFor="booking-status-filter"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
          >
            Filter by status
          </label>
          <div className="relative mt-1.5">
            <select
              id="booking-status-filter"
              value={status}
              onChange={handleStatusChange}
              className={selectBase}
            >
              <option value="all">All statuses</option>
              {BOOKING_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
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
        </div>

        <div className="flex items-center gap-3">
          {totalItems !== null && (
            <p aria-live="polite" className="text-xs font-medium tabular-nums text-muted sm:text-sm">
              {totalItems} {totalItems === 1 ? "booking" : "bookings"}
            </p>
          )}
          <button
            type="button"
            onClick={reload}
            disabled={isLoading}
            aria-label="Refresh bookings"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-200 enabled:hover:bg-surface-muted enabled:hover:text-heading enabled:active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`h-5 w-5 ${isLoading ? "animate-spin motion-reduce:animate-none" : ""}`}
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
            </svg>
          </button>
        </div>
      </div>

      {notice && (
        <div
          role={notice.kind === "success" ? "status" : "alert"}
          aria-live={notice.kind === "success" ? "polite" : "assertive"}
          className={`mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
            notice.kind === "success"
              ? "border-success/40 bg-success-soft/60 text-success"
              : "border-error/40 bg-error-soft/60 text-error"
          }`}
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
            {notice.kind === "success" ? (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M9 12.5l2 2 4-4.5" />
              </>
            ) : (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" />
              </>
            )}
          </svg>
          <p className="min-w-0 flex-1 font-medium leading-relaxed">
            {notice.message}
          </p>
          {notice.kind === "error" && notice.showRefresh && (
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                reload();
              }}
              className="shrink-0 rounded-full border border-error/40 bg-surface px-3 py-1.5 text-xs font-semibold text-error transition-colors duration-200 hover:bg-error-soft cursor-pointer active:bg-error-soft"
            >
              Refresh list
            </button>
          )}
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss message"
            className="shrink-0 rounded-lg p-1 opacity-80 transition-opacity duration-200 hover:opacity-100 cursor-pointer hover:bg-surface-muted hover:text-heading active:scale-90"
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
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="mt-6" aria-busy={isLoading}>
        {state.phase === "loading" && <BookingsSkeleton />}

        {state.phase === "error" && (
          <ErrorPanel error={state.error} onRetry={reload} />
        )}

        {state.phase === "success" && state.data.items.length === 0 && (
          <EmptyState filtered={filtered} onClearFilter={() => { beginLoading(); setStatus("all"); setPage(1); }} statusFilter={status} />
        )}

        {state.phase === "success" && state.data.items.length > 0 && (
          <>
            <ul className="flex flex-col gap-4">
              {state.data.items.map((booking) => (
                <li key={booking._id}>
                  <BookingCard booking={booking} onCancelRequest={handleRequestCancel} />
                </li>
              ))}
            </ul>

            <nav
              aria-label="Bookings pagination"
              className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5"
            >
              <button
                type="button"
                onClick={() => goToPage(Math.max(1, state.data.pagination.currentPage - 1))}
                disabled={!state.data.pagination.hasPrevPage || isLoading}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted enabled:active:bg-surface-muted cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
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
                <span className="hidden sm:inline">Previous</span>
              </button>
              <p className="text-center text-xs font-medium tabular-nums text-muted sm:text-sm">
                Page{" "}
                <span className="font-semibold text-heading">
                  {state.data.pagination.currentPage}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-heading">
                  {Math.max(state.data.pagination.totalPages, 1)}
                </span>
              </p>
              <button
                type="button"
                onClick={() => goToPage(state.data.pagination.currentPage + 1)}
                disabled={!state.data.pagination.hasNextPage || isLoading}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted enabled:active:bg-surface-muted cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="hidden sm:inline">Next</span>
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
              </button>
            </nav>
          </>
        )}
      </div>

      {cancelTarget && (
        <CancelBookingDialog
          booking={cancelTarget}
          pending={cancelling}
          error={cancelError}
          onDismiss={closeCancelDialog}
          onConfirm={confirmCancellation}
        />
      )}
    </div>
  );
}
