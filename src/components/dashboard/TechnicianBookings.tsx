"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { roleFromUser } from "@/components/dashboard/DashboardSidebar";
import {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  type BookingStatus,
  type BookingsPagination,
  type PaymentStatus,
} from "@/components/dashboard/MyBookings";

/* ================================================================== */
/*  Technician Incoming Bookings                                       */
/*                                                                     */
/*  GET /api/bookings/technician (verifyToken -> verifyTechnician)      */
/*  returns only bookings whose technicianId matches the verified JWT.  */
/*  No technicianId is ever sent from the client — identity comes       */
/*  exclusively from the token. Response: { success, data, pagination }. */
/*                                                                     */
/*  Note: the only booking-details endpoint (GET /api/bookings/:id) is  */
/*  customer-only (verifyCustomer), so no "View Details" action is      */
/*  offered here — linking to a customer-only page would be wrong.      */
/* ================================================================== */

/** Statuses offered in the filter — cancelled is still valid in the DTO
 *  (and rendered when returned), but is intentionally not a filter option. */
const FILTER_STATUSES = [
  "requested",
  "accepted",
  "rejected",
  "in-progress",
  "completed",
] as const satisfies readonly BookingStatus[];

type StatusFilter = BookingStatus | "all";

interface TechnicianBooking {
  _id: string;
  customerName: string;
  customerEmail: string;
  serviceTitle: string;
  serviceCategory: string;
  serviceLocation: string;
  serviceImage: string;
  hourlyRate: number;
  problemDescription: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  finalAmount?: number;
  createdAt: string;
  updatedAt: string;
}

interface TechnicianBookingsPageData {
  items: TechnicianBooking[];
  pagination: BookingsPagination;
}

type BookingsErrorKind = "unauthorized" | "network" | "server" | "parse";

class TechnicianBookingsError extends Error {
  readonly kind: BookingsErrorKind;
  constructor(kind: BookingsErrorKind, message: string) {
    super(message);
    this.name = "TechnicianBookingsError";
    this.kind = kind;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const PAGE_SIZE = 10;

/* ================================================================== */
/*  Runtime response validation                                        */
/* ================================================================== */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new TechnicianBookingsError("parse", "The server returned an unexpected booking payload.");
  }
  return value;
}

function requiredFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TechnicianBookingsError("parse", "The server returned an unexpected booking payload.");
  }
  return value;
}

function optionalFiniteNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TechnicianBookingsError("parse", "The server returned an unexpected booking payload.");
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
    throw new TechnicianBookingsError("parse", "The server returned an unknown value in a booking field.");
  }
  return value as T;
}

function parseBooking(raw: unknown): TechnicianBooking {
  if (!isRecord(raw)) {
    throw new TechnicianBookingsError("parse", "The server returned an unexpected booking payload.");
  }
  return {
    _id: requiredString(raw, "_id"),
    customerName:
      typeof raw.customerName === "string" && raw.customerName.length > 0 ? raw.customerName : "Customer",
    customerEmail:
      typeof raw.customerEmail === "string" ? raw.customerEmail : "",
    serviceTitle: requiredString(raw, "serviceTitle"),
    serviceCategory:
      typeof raw.serviceCategory === "string" ? raw.serviceCategory : "Service",
    serviceLocation:
      typeof raw.serviceLocation === "string" ? raw.serviceLocation : "",
    serviceImage: typeof raw.serviceImage === "string" ? raw.serviceImage : "",
    hourlyRate:
      typeof raw.hourlyRate === "number" && Number.isFinite(raw.hourlyRate) ? raw.hourlyRate : 0,
    problemDescription:
      typeof raw.problemDescription === "string" ? raw.problemDescription : "",
    status: requiredEnum(raw, "status", BOOKING_STATUSES),
    paymentStatus: requiredEnum(raw, "paymentStatus", PAYMENT_STATUSES),
    finalAmount: optionalFiniteNumber(raw, "finalAmount"),
    createdAt: requiredString(raw, "createdAt"),
    updatedAt: requiredString(raw, "updatedAt"),
  };
}

function parsePagination(raw: unknown): BookingsPagination {
  if (!isRecord(raw)) {
    throw new TechnicianBookingsError("parse", "The server returned an unexpected pagination payload.");
  }
  const currentPage = requiredFiniteNumber(raw, "currentPage");
  const limit = requiredFiniteNumber(raw, "limit");
  const totalItems = requiredFiniteNumber(raw, "totalItems");
  const totalPages = requiredFiniteNumber(raw, "totalPages");
  if (typeof raw.hasNextPage !== "boolean" || typeof raw.hasPrevPage !== "boolean") {
    throw new TechnicianBookingsError("parse", "The server returned an unexpected pagination payload.");
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

function parseBookingsResponse(body: unknown): TechnicianBookingsPageData {
  if (!isRecord(body)) {
    throw new TechnicianBookingsError("parse", "The server returned an unexpected response.");
  }
  if (body.success !== true) {
    const message =
      typeof body.message === "string" && body.message.length > 0 && body.message.length <= 200
        ? body.message
        : "The server couldn't load your incoming bookings.";
    throw new TechnicianBookingsError("server", message);
  }
  if (!Array.isArray(body.data)) {
    throw new TechnicianBookingsError("parse", "The server returned an unexpected bookings payload.");
  }
  return {
    items: body.data.map(parseBooking),
    pagination: parsePagination(body.pagination),
  };
}

/* ================================================================== */
/*  API calls — JWT is retrieved dynamically per request cycle and     */
/*  never stored, logged, hardcoded or persisted.                       */
/* ================================================================== */

async function fetchAccessToken(): Promise<string> {
  let response: {
    data: unknown;
    error: null | ({ status: number } & Record<string, unknown>);
  };
  try {
    response = await authClient.$fetch<{ token: string }>("/token", { method: "GET" });
  } catch {
    throw new TechnicianBookingsError(
      "network",
      "Couldn't reach the FixMate server to verify your session. Check your connection and try again."
    );
  }
  if (response.error) {
    const status = response.error.status;
    if (status === 401 || status === 403) {
      throw new TechnicianBookingsError(
        "unauthorized",
        "Your session has expired. Sign in again to view your incoming bookings."
      );
    }
    throw new TechnicianBookingsError(
      "server",
      "We couldn't verify your session with FixMate right now. Please try again."
    );
  }
  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new TechnicianBookingsError(
      "parse",
      "The FixMate server returned an unexpected session-token response."
    );
  }
  return data.token;
}

async function fetchTechnicianBookings(options: {
  page: number;
  limit: number;
  status: StatusFilter;
  signal: AbortSignal;
}): Promise<TechnicianBookingsPageData> {
  const token = await fetchAccessToken();

  const params = new URLSearchParams({
    page: String(options.page),
    limit: String(options.limit),
  });
  if (options.status !== "all") params.set("status", options.status);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/bookings/technician?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new TechnicianBookingsError(
      "network",
      "Couldn't reach the FixMate server. Check your connection and try again."
    );
  }

  if (response.status === 401) {
    throw new TechnicianBookingsError(
      "unauthorized",
      "Your session has expired. Sign in again to view your incoming bookings."
    );
  }
  if (response.status === 403) {
    throw new TechnicianBookingsError(
      "unauthorized",
      "Technician access only. This account isn't allowed to view these bookings."
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
        : "The server couldn't load your incoming bookings. Please try again.";
    throw new TechnicianBookingsError("server", message);
  }

  return parseBookingsResponse(body);
}

/* ================================================================== */
/*  Display helpers                                                    */
/* ================================================================== */

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

/* ================================================================== */
/*  Building blocks                                                    */
/* ================================================================== */

function BookingsSkeleton() {
  return (
    <div role="status" aria-label="Loading incoming bookings…" className="space-y-4">
      <span className="sr-only">Loading incoming bookings…</span>
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
  error: TechnicianBookingsError;
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
        {unauthorized ? "Session expired" : "Couldn't load incoming bookings"}
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
        {error.message}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {unauthorized ? (
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md"
          >
            Sign in again
          </Link>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ filtered, onClearFilter }: { filtered: boolean; onClearFilter: () => void }) {
  if (filtered) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted/30 px-6 py-12 text-center">
        <h2 className="text-lg font-bold text-heading">No matching bookings</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          You have no bookings with this status yet. Clear the filter to see everything.
        </p>
        <button
          type="button"
          onClick={onClearFilter}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted"
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
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </div>
      <h2 className="mt-5 text-xl font-bold tracking-tight text-heading">No incoming bookings yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        When a customer requests one of your services, it will appear here with
        their details, the problem description and its current status.
      </p>
    </div>
  );
}

function BookingCard({ booking }: { booking: TechnicianBooking }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = booking.serviceImage.length > 0 && !imageFailed;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs transition-shadow duration-200 hover:shadow-md">
      <div className="flex flex-col sm:flex-row">
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
            <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold leading-snug text-heading">
                {booking.serviceTitle}
              </h3>
              <p className="mt-1 text-xs text-muted">
                <span className="font-medium text-foreground">{booking.serviceCategory}</span>
                {booking.serviceLocation && (
                  <>
                    <span aria-hidden="true"> · </span>
                    {booking.serviceLocation}
                  </>
                )}
              </p>
            </div>
            <Badge label={STATUS_LABELS[booking.status]} className={STATUS_STYLES[booking.status]} />
          </div>

          {/* Customer */}
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
              <span className="text-muted">Customer: </span>
              <span className="font-semibold text-heading">{booking.customerName}</span>
            </span>
          </p>

          {booking.problemDescription && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">
              {booking.problemDescription}
            </p>
          )}

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
              <dt className="text-muted">Requested</dt>
              <dd className="font-medium text-foreground">
                {formatBookingDate(booking.createdAt)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}

/* ================================================================== */
/*  Technician-only screen                                             */
/* ================================================================== */

function ScreenSkeleton() {
  return (
    <div role="status" aria-label="Loading…" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="h-16 animate-pulse rounded-2xl bg-surface-muted/70" />
      <div aria-hidden="true" className="space-y-4">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-2xl bg-surface-muted/70" />
        ))}
      </div>
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
          ? `You're signed in with a ${roleLabel} account, so incoming bookings aren't available here. Your dashboard only shows the sections your role can use.`
          : "Your account's role isn't recognized, so this section isn't available. Please contact FixMate support if this looks wrong."}
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md"
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

export function TechnicianBookingsScreen() {
  // Session atom is already resolved by the layout — this resolves instantly.
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const role = roleFromUser(user);

  if (isPending) return <ScreenSkeleton />;
  if (!user) return null;
  if (role !== "technician") {
    return <AccessDenied role={role === "customer" || role === "admin" ? role : null} />;
  }

  return <TechnicianBookings />;
}

/* ================================================================== */
/*  Main component                                                     */
/* ================================================================== */

export default function TechnicianBookings() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [reloadToken, setReloadToken] = useState(0);

  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: TechnicianBookingsError }
    | { phase: "success"; data: TechnicianBookingsPageData }
  >({ phase: "loading" });

  function beginLoading() {
    setState({ phase: "loading" });
  }

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetchTechnicianBookings({ page, limit: PAGE_SIZE, status, signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        setState({ phase: "success", data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof TechnicianBookingsError) {
          setState({ phase: "error", error });
          return;
        }
        setState({
          phase: "error",
          error: new TechnicianBookingsError(
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

  function handleStatusChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    beginLoading();
    setStatus(value === "all" ? "all" : (value as BookingStatus));
    setPage(1);
  }

  function goToPage(nextPage: number) {
    beginLoading();
    setPage(nextPage);
  }

  function reload() {
    beginLoading();
    setReloadToken((token) => token + 1);
  }

  function clearFilter() {
    beginLoading();
    setStatus("all");
    setPage(1);
  }

  const isLoading = state.phase === "loading";
  const totalItems = state.phase === "success" ? state.data.pagination.totalItems : null;
  const filtered = status !== "all";

  const selectBase =
    "w-full appearance-none rounded-lg border border-border-strong bg-surface py-2.5 pl-4 pr-10 text-sm font-medium text-foreground shadow-xs outline-none transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25";

  return (
    <div>
      {/* ---------- Filter + result bar ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <label
            htmlFor="technician-booking-status-filter"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
          >
            Filter by status
          </label>
          <div className="relative mt-1.5">
            <select
              id="technician-booking-status-filter"
              value={status}
              onChange={handleStatusChange}
              className={selectBase}
            >
              <option value="all">All</option>
              {FILTER_STATUSES.map((value) => (
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
            aria-label="Refresh incoming bookings"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-heading disabled:cursor-not-allowed disabled:opacity-60"
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

      {/* ---------- Content ---------- */}
      <div className="mt-6" aria-busy={isLoading}>
        {state.phase === "loading" && <BookingsSkeleton />}

        {state.phase === "error" && <ErrorPanel error={state.error} onRetry={reload} />}

        {state.phase === "success" && state.data.items.length === 0 && (
          <EmptyState filtered={filtered} onClearFilter={clearFilter} />
        )}

        {state.phase === "success" && state.data.items.length > 0 && (
          <>
            <ul className="flex flex-col gap-4">
              {state.data.items.map((booking) => (
                <li key={booking._id}>
                  <BookingCard booking={booking} />
                </li>
              ))}
            </ul>

            <nav
              aria-label="Incoming bookings pagination"
              className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5"
            >
              <button
                type="button"
                onClick={() => goToPage(Math.max(1, state.data.pagination.currentPage - 1))}
                disabled={!state.data.pagination.hasPrevPage || isLoading}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
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
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
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
    </div>
  );
}
