"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { roleFromUser } from "@/components/dashboard/DashboardSidebar";
import ChatPanel from "@/components/dashboard/ChatPanel";
import {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  type BookingStatus,
  type BookingsPagination,
  type PaymentStatus,
} from "@/components/dashboard/MyBookings";

/** Incoming Bookings — GET /api/bookings/technician (verifyToken + verifyTechnician) returns only bookings whose technicianId matches the verified JWT; no technicianId is ever sent. The only booking-details endpoint (GET /api/bookings/:id) is customer-only (verifyCustomer), so no "View Details" action is offered here. */

/** Statuses offered in the filter. Cancelled is a first-class option: the
 *  default list excludes cancelled bookings (server-side), and selecting
 *  Cancelled returns only cancelled records. */
const FILTER_STATUSES = [
  "requested",
  "accepted",
  "rejected",
  "in-progress",
  "completed",
  "cancelled",
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
  schedule?: {
    date: string;
    slotStart: string;
    slotEnd: string;
    durationMinutes: number;
    timezone: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface TechnicianBookingsPageData {
  items: TechnicianBooking[];
  pagination: BookingsPagination;
}

type BookingsErrorKind =
  | "unauthorized"
  | "forbidden"
  | "notfound"
  | "conflict"
  | "badrequest"
  | "network"
  | "server"
  | "parse";

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

function optionalScheduleValue(raw: unknown): TechnicianBooking["schedule"] {
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
    serviceImage: typeof raw.serviceImage === "string" ? raw.serviceImage.trim() : "",
    hourlyRate:
      typeof raw.hourlyRate === "number" && Number.isFinite(raw.hourlyRate) ? raw.hourlyRate : 0,
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

/** PATCH /api/bookings/:id/(accept|reject) — technician-only transition.
 *  The backend guard is atomic: {_id, technicianId, status:"requested"}.
 *  No request body is required or sent; identity comes from the JWT.
 *  Backend: 200 {success,message,data} | 400 | 401 | 403 | 404 | 409. */
type TransitionAction = "accept" | "reject" | "start" | "complete";

/** Amount sent when completing a booking: finite and > 0 (backend rule). */
type FinalAmount = number;

async function updateBookingStatus(
  bookingId: string,
  payload: { status: "in-progress" } | { status: "completed"; finalAmount: FinalAmount }
): Promise<string> {
  const token = await fetchAccessToken();

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/bookings/${encodeURIComponent(bookingId)}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  } catch {
    throw new TechnicianBookingsError(
      "network",
      "Couldn't reach the FixMate server. Check your connection and try again."
    );
  }

  if (response.status === 401) {
    throw new TechnicianBookingsError(
      "unauthorized",
      "Your session has expired. Sign in again to manage your bookings."
    );
  }
  if (response.status === 403) {
    throw new TechnicianBookingsError(
      "forbidden",
      "Technician access only. This account isn't allowed to update bookings."
    );
  }
  if (response.status === 404) {
    throw new TechnicianBookingsError(
      "notfound",
      "This booking could not be found. It may have been removed."
    );
  }
  if (response.status === 409) {
    throw new TechnicianBookingsError(
      "conflict",
      "This booking may have already changed — its status moved on since you opened it. Refresh the list to see its latest status."
    );
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
    const fieldError =
      isRecord(body) && Array.isArray(body.errors) && body.errors.length > 0 && isRecord(body.errors[0])
        ? body.errors[0].message
        : null;
    const message =
      typeof fieldError === "string" && fieldError.length > 0 && fieldError.length <= 200
        ? fieldError
        : serverMessage;
    throw new TechnicianBookingsError(
      "badrequest",
      message ?? "The final amount is invalid. Enter a positive number and try again."
    );
  }

  if (!response.ok || (isRecord(body) && body.success === false)) {
    throw new TechnicianBookingsError(
      "server",
      serverMessage ?? "The server couldn't update this booking. Please try again."
    );
  }

  return serverMessage ??
    (payload.status === "in-progress"
      ? "Booking marked as in-progress."
      : "Booking completed successfully.");
}

async function transitionBooking(
  bookingId: string,
  action: TransitionAction
): Promise<string> {
  const token = await fetchAccessToken();

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE}/api/bookings/${encodeURIComponent(bookingId)}/${action}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      }
    );
  } catch {
    throw new TechnicianBookingsError(
      "network",
      "Couldn't reach the FixMate server. Check your connection and try again."
    );
  }

  if (response.status === 401) {
    throw new TechnicianBookingsError(
      "unauthorized",
      "Your session has expired. Sign in again to manage your bookings."
    );
  }
  if (response.status === 403) {
    throw new TechnicianBookingsError(
      "forbidden",
      "Technician access only. This account isn't allowed to update bookings."
    );
  }
  if (response.status === 404) {
    throw new TechnicianBookingsError(
      "notfound",
      "This booking could not be found. It may have been removed."
    );
  }
  if (response.status === 409) {
    throw new TechnicianBookingsError(
      "conflict",
      "This booking may have already changed — another technician may have accepted or rejected it. Refresh the list to see its latest status."
    );
  }
  if (response.status === 400) {
    throw new TechnicianBookingsError("badrequest", "Invalid booking reference. Refresh the list and try again.");
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

  if (!response.ok || (isRecord(body) && body.success === false)) {
    throw new TechnicianBookingsError(
      "server",
      serverMessage ?? "The server couldn't update this booking. Please try again."
    );
  }

  return serverMessage ?? (action === "accept" ? "Booking accepted successfully." : "Booking rejected successfully.");
}

/** Reflect a successful transition in the already-loaded page data without
 *  a full reload. If an active status filter no longer matches, the booking
 *  is removed and the pagination metadata is adjusted accordingly. */
function applyTransition(
  data: TechnicianBookingsPageData,
  bookingId: string,
  newStatus: BookingStatus,
  statusFilter: StatusFilter,
  finalAmount?: FinalAmount
): { data: TechnicianBookingsPageData; needsRefetch: boolean } {
  const items = data.items.map((booking) =>
    booking._id === bookingId
      ? {
          ...booking,
          status: newStatus,
          updatedAt: new Date().toISOString(),
          ...(typeof finalAmount === "number" ? { finalAmount } : {}),
        }
      : booking
  );

  if (statusFilter === "all" || statusFilter === newStatus) {
    return { data: { items, pagination: data.pagination }, needsRefetch: false };
  }

  const remaining = items.filter((booking) => booking._id !== bookingId);
  const totalItems = Math.max(0, data.pagination.totalItems - 1);
  const totalPages = Math.max(1, Math.ceil(totalItems / data.pagination.limit));
  const currentPage = Math.min(data.pagination.currentPage, totalPages);

  return {
    data: {
      items: remaining,
      pagination: {
        ...data.pagination,
        currentPage,
        totalItems,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    },
    needsRefetch: remaining.length === 0 && data.pagination.currentPage > 1,
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

function EmptyState({ filtered, onClearFilter, statusFilter }: { filtered: boolean; onClearFilter: () => void; statusFilter?: StatusFilter }) {
  if (filtered) {
    const cancelled = statusFilter === "cancelled";
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted/30 px-6 py-12 text-center">
        <h2 className="text-lg font-bold text-heading">{cancelled ? "No cancelled bookings" : "No matching bookings"}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          {cancelled
            ? "When a customer cancels a booking, it will appear here and be kept for your records."
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

/** Complete Work dialog — custom, accessible, no native prompts. Requires a finite positive final repair amount (backend rule). */
function CompleteWorkDialog({
  booking,
  pending,
  error,
  onDismiss,
  onConfirm,
}: {
  booking: TechnicianBooking;
  pending: boolean;
  error: string | null;
  onDismiss: () => void;
  onConfirm: (finalAmount: FinalAmount) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const onDismissRef = useRef(onDismiss);
  const pendingRef = useRef(pending);

  useEffect(() => {
    onDismissRef.current = onDismiss;
    pendingRef.current = pending;
  }, [onDismiss, pending]);

  // Mount-only: focus the amount input, scroll lock, Escape to dismiss,
  // Tab focus trap. Focus restoration is handled by the parent.
  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    amountRef.current?.focus();

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
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const focusOutside = !(active instanceof HTMLElement) || !node.contains(active);
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = amount.trim();
    const value = Number(trimmed);
    if (trimmed.length === 0 || !Number.isFinite(value) || value <= 0) {
      setAmountError("Enter a finite final amount greater than 0.");
      amountRef.current?.focus();
      return;
    }
    setAmountError(null);
    onConfirm(value);
  }

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
        aria-labelledby="complete-booking-title"
        aria-describedby="complete-booking-description"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-success/40 bg-success-soft text-success"
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
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 id="complete-booking-title" className="text-base font-bold leading-snug text-heading">
                Complete work
              </h2>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                FixMate · Incoming Bookings
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

        <form onSubmit={handleSubmit} noValidate>
          <div className="px-5 py-5 sm:px-6">
            <p id="complete-booking-description" className="text-sm leading-relaxed text-foreground">
              Finish the repair for{" "}
              <span className="font-semibold text-heading">{booking.serviceTitle}</span> from{" "}
              <span className="font-semibold text-heading">{booking.customerName}</span>.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              The final repair amount you enter below will be used for the
              customer&apos;s payment. Enter a final amount greater than 0 —
              this is your repair charge, not a payment.
            </p>

            <div className="mt-4">
              <label
                htmlFor="complete-final-amount"
                className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"
              >
                Final repair amount <span aria-hidden="true" className="text-error">*</span>
              </label>
              <div className="relative mt-1.5">
                <input
                  ref={amountRef}
                  id="complete-final-amount"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setAmountError(null);
                  }}
                  disabled={pending}
                  required
                  aria-invalid={Boolean(amountError) || undefined}
                  aria-describedby={amountError ? "complete-amount-error" : "complete-amount-helper"}
                  placeholder="e.g. 1500"
                  className="w-full rounded-lg border border-border-strong bg-surface py-2.5 pl-4 pr-4 text-sm text-foreground shadow-xs outline-none transition-colors duration-200 placeholder:text-muted hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25 aria-[invalid=true]:border-error/60"
                />
              </div>
              {!amountError && (
                <p id="complete-amount-helper" className="mt-1.5 text-[11px] leading-snug text-muted">
                  A finite number greater than 0. No currency symbol needed.
                </p>
              )}
              {amountError && (
                <p id="complete-amount-error" role="alert" className="mt-1.5 text-[11px] font-medium text-error">
                  {amountError}
                </p>
              )}
            </div>

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

          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onDismiss}
              disabled={pending}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted enabled:active:bg-surface-muted cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              aria-live="polite"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 enabled:hover:bg-primary-hover enabled:hover:shadow-md enabled:active:bg-primary-hover enabled:active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
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
                  Completing…
                </>
              ) : (
                "Mark as complete"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Reject confirmation dialog — custom, accessible, no native confirm()/alert().
 *  Escape/backdrop dismiss (blocked while pending), focus trapped while open and restored to the trigger on close. */
function RejectBookingDialog({
  booking,
  pending,
  error,
  onDismiss,
  onConfirm,
}: {
  booking: TechnicianBooking;
  pending: boolean;
  error: string | null;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const keepBookingRef = useRef<HTMLButtonElement>(null);
  const onDismissRef = useRef(onDismiss);
  const pendingRef = useRef(pending);

  useEffect(() => {
    onDismissRef.current = onDismiss;
    pendingRef.current = pending;
  }, [onDismiss, pending]);

  // Mount-only: initial focus on the safe action, scroll lock, Escape to
  // dismiss and a Tab focus trap inside the dialog.
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
      const focusOutside = !(active instanceof HTMLElement) || !node.contains(active);
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
        aria-labelledby="reject-booking-title"
        aria-describedby="reject-booking-description"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
      >
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
                <circle cx="12" cy="12" r="9" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 id="reject-booking-title" className="text-base font-bold leading-snug text-heading">
                Reject this booking?
              </h2>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                FixMate · Incoming Bookings
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

        <div className="px-5 py-5 sm:px-6">
          <p id="reject-booking-description" className="text-sm leading-relaxed text-foreground">
            You&apos;re about to reject the booking for{" "}
            <span className="font-semibold text-heading">{booking.serviceTitle}</span> from{" "}
            <span className="font-semibold text-heading">{booking.customerName}</span>. The
            customer will see it as rejected and this action cannot be undone.
          </p>
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
                Rejecting…
              </>
            ) : (
              "Confirm Rejection"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingCard({
  booking,
  onAccept,
  onReject,
  onStartWork,
  onCompleteWork,
  actionsBusy,
  pendingAction,
}: {
  booking: TechnicianBooking;
  onAccept: (booking: TechnicianBooking, trigger: HTMLButtonElement) => void;
  onReject: (booking: TechnicianBooking, trigger: HTMLButtonElement) => void;
  onStartWork: (booking: TechnicianBooking, trigger: HTMLButtonElement) => void;
  onCompleteWork: (booking: TechnicianBooking, trigger: HTMLButtonElement) => void;
  /** Any transition is in flight — disable all action buttons. */
  actionsBusy: boolean;
  /** Which action is in flight for this specific booking, if any. */
  pendingAction: TransitionAction | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const showImage = booking.serviceImage.length > 0 && !imageFailed;
  const isRequested = booking.status === "requested";
  const showChat = booking.status !== "cancelled" && booking.status !== "rejected";

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
              decoding="async"
              onError={() => setImageFailed(true)}
              className="absolute inset-0 h-full w-full object-cover object-center"
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

          {/* Accept / Reject — only while the booking is still requested */}
          {isRequested && (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={(event) => onAccept(booking, event.currentTarget)}
                disabled={actionsBusy}
                aria-live="polite"
                className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success-soft/60 px-4 py-2 text-xs font-semibold text-success transition-colors duration-200 enabled:hover:bg-success-soft enabled:active:bg-success-soft cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingAction === "accept" ? (
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
                    Accepting…
                  </>
                ) : (
                  <>
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
                    Accept
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={(event) => onReject(booking, event.currentTarget)}
                disabled={actionsBusy}
                aria-live="polite"
                className="inline-flex items-center gap-2 rounded-full border border-error/40 bg-error-soft/50 px-4 py-2 text-xs font-semibold text-error transition-colors duration-200 enabled:hover:border-error/60 enabled:hover:bg-error-soft enabled:active:bg-error-soft cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingAction === "reject" ? (
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
                    Rejecting…
                  </>
                ) : (
                  <>
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
                    Reject
                  </>
                )}
              </button>
            </div>
          )}

          {/* Workflow — accepted → in-progress → completed */}
          {(booking.status === "accepted" || booking.status === "in-progress") && (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
              {booking.status === "accepted" ? (
                <button
                  type="button"
                  onClick={(event) => onStartWork(booking, event.currentTarget)}
                  disabled={actionsBusy}
                  aria-live="polite"
                  className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-4 py-2 text-xs font-semibold text-accent-foreground shadow-sm transition-all duration-200 enabled:hover:bg-accent enabled:hover:shadow-md enabled:active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 dark:bg-accent dark:text-accent-foreground dark:enabled:hover:bg-accent-400"
                >
                  {pendingAction === "start" ? (
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
                      Starting…
                    </>
                  ) : (
                    <>
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
                        <path d="M5 3l14 9-14 9V3Z" />
                      </svg>
                      Start Work
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(event) => onCompleteWork(booking, event.currentTarget)}
                  disabled={actionsBusy}
                  aria-live="polite"
                  className="inline-flex items-center gap-2 rounded-full bg-success px-4 py-2 text-xs font-semibold text-background shadow-sm transition-all duration-200 enabled:hover:brightness-95 enabled:active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingAction === "complete" ? (
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
                      Completing…
                    </>
                  ) : (
                    <>
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
                      Complete Work
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Conversation with the customer */}
      {showChat && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setChatOpen((open) => !open)}
            aria-expanded={chatOpen}
            aria-controls={`chat-${booking._id}`}
            className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-xs font-semibold text-accent-strong transition-colors duration-200 hover:bg-surface-muted/60 dark:text-accent"
          >
            <span className="flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-[15px] w-[15px]"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Conversation with {booking.customerName}
            </span>
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`h-[15px] w-[15px] transition-transform duration-200 ${chatOpen ? "rotate-180" : ""}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {chatOpen && (
            <div id={`chat-${booking._id}`} className="border-t border-border p-3">
              <ChatPanel bookingId={booking._id} />
            </div>
          )}
        </div>
      )}
    </article>
  );
}


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


export default function TechnicianBookings() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [reloadToken, setReloadToken] = useState(0);

  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: TechnicianBookingsError }
    | { phase: "success"; data: TechnicianBookingsPageData }
  >({ phase: "loading" });

  const [rejectTarget, setRejectTarget] = useState<TechnicianBooking | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [completeTarget, setCompleteTarget] = useState<TechnicianBooking | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ bookingId: string; action: TransitionAction } | null>(null);
  const [notice, setNotice] = useState<
    | { kind: "success"; message: string }
    | { kind: "error"; message: string; showRefresh: boolean }
    | null
  >(null);
  const actionInFlightRef = useRef<Set<string>>(new Set());
  const returnFocusRef = useRef<HTMLElement | null>(null);

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

  function restoreFocus() {
    const trigger = returnFocusRef.current;
    returnFocusRef.current = null;
    if (trigger && document.contains(trigger)) {
      trigger.focus();
    } else {
      // The action buttons unmount once the status changes — fall back to
      // the filter control so keyboard focus is never lost.
      document.getElementById("technician-booking-status-filter")?.focus();
    }
  }

  function handleAccept(booking: TechnicianBooking, trigger: HTMLButtonElement) {
    returnFocusRef.current = trigger;
    void runTransition(booking, "accept");
  }

  function handleRejectRequest(booking: TechnicianBooking, trigger: HTMLButtonElement) {
    returnFocusRef.current = trigger;
    setRejectError(null);
    setRejectTarget(booking);
  }

  function closeRejectDialog() {
    if (rejectTarget && actionInFlightRef.current.has(rejectTarget._id)) return;
    setRejectTarget(null);
    setRejectError(null);
    restoreFocus();
  }

  function handleStartWork(booking: TechnicianBooking, trigger: HTMLButtonElement) {
    returnFocusRef.current = trigger;
    void runTransition(booking, "start");
  }

  function handleCompleteRequest(booking: TechnicianBooking, trigger: HTMLButtonElement) {
    returnFocusRef.current = trigger;
    setCompleteError(null);
    setCompleteTarget(booking);
  }

  function closeCompleteDialog() {
    if (completeTarget && actionInFlightRef.current.has(completeTarget._id)) return;
    setCompleteTarget(null);
    setCompleteError(null);
    restoreFocus();
  }

  async function runTransition(
    booking: TechnicianBooking,
    action: TransitionAction,
    finalAmount?: FinalAmount
  ) {
    // Per-booking guard — duplicate clicks/keys cannot send duplicate requests.
    if (actionInFlightRef.current.has(booking._id)) return;
    actionInFlightRef.current.add(booking._id);
    setPending({ bookingId: booking._id, action });
    setNotice(null);
    setRejectError(null);
    setCompleteError(null);

    const nextStatus: BookingStatus =
      action === "accept"
        ? "accepted"
        : action === "reject"
          ? "rejected"
          : action === "start"
            ? "in-progress"
            : "completed";

    let message: string;
    try {
      if (action === "start") {
        message = await updateBookingStatus(booking._id, { status: "in-progress" });
      } else if (action === "complete") {
        if (finalAmount === undefined) {
          throw new TechnicianBookingsError("badrequest", "Enter a valid final amount and try again.");
        }
        message = await updateBookingStatus(booking._id, {
          status: "completed",
          finalAmount,
        });
      } else {
        message = await transitionBooking(booking._id, action);
      }

      const previousData = state.phase === "success" ? state.data : null;
      if (previousData) {
        const { data: nextData, needsRefetch } = applyTransition(
          previousData,
          booking._id,
          nextStatus,
          status,
          finalAmount
        );
        setState({ phase: "success", data: nextData });
        if (needsRefetch) {
          beginLoading();
          setPage(nextData.pagination.currentPage);
        }
      }
      setNotice({ kind: "success", message });
      actionInFlightRef.current.delete(booking._id);
      setPending(null);
      setRejectTarget(null);
      setRejectError(null);
      setCompleteTarget(null);
      setCompleteError(null);
      restoreFocus();
      return;
    } catch (error) {
      actionInFlightRef.current.delete(booking._id);
      setPending(null);

      if (error instanceof TechnicianBookingsError && error.kind === "unauthorized") {
        setRejectTarget(null);
        setRejectError(null);
        setCompleteTarget(null);
        setCompleteError(null);
        setState({ phase: "error", error });
        return;
      }
      if (
        error instanceof TechnicianBookingsError &&
        (error.kind === "notfound" ||
          error.kind === "conflict" ||
          error.kind === "forbidden" ||
          error.kind === "badrequest")
      ) {
        setRejectTarget(null);
        setRejectError(null);
        setCompleteTarget(null);
        setCompleteError(null);
        setNotice({ kind: "error", message: error.message, showRefresh: true });
        restoreFocus();
        return;
      }
      const message =
        error instanceof TechnicianBookingsError
          ? error.message
          : "Something went wrong while updating this booking. Please try again.";
      // Network/5xx failures keep a confirm dialog open so the technician
      // can retry without losing context; direct actions surface a notice.
      if (
        (action === "reject" && rejectTarget?._id === booking._id) ||
        (action === "complete" && completeTarget?._id === booking._id)
      ) {
        if (action === "reject") setRejectError(message);
        else setCompleteError(message);
      } else {
        setNotice({ kind: "error", message, showRefresh: true });
        restoreFocus();
      }
    }
  }

  function confirmReject() {
    if (rejectTarget) void runTransition(rejectTarget, "reject");
  }

  function confirmComplete(finalAmount: FinalAmount) {
    if (completeTarget) void runTransition(completeTarget, "complete", finalAmount);
  }

  // Auto-dismiss success notices; errors persist until dismissed.
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
          <p className="min-w-0 flex-1 font-medium leading-relaxed">{notice.message}</p>
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

        {state.phase === "error" && <ErrorPanel error={state.error} onRetry={reload} />}

        {state.phase === "success" && state.data.items.length === 0 && (
          <EmptyState filtered={filtered} onClearFilter={clearFilter} statusFilter={status} />
        )}

        {state.phase === "success" && state.data.items.length > 0 && (
          <>
            <ul className="flex flex-col gap-4">
              {state.data.items.map((booking) => (
                <li key={booking._id}>
                  <BookingCard
                    booking={booking}
                    onAccept={handleAccept}
                    onReject={handleRejectRequest}
                    onStartWork={handleStartWork}
                    onCompleteWork={handleCompleteRequest}
                    actionsBusy={pending !== null}
                    pendingAction={pending?.bookingId === booking._id ? pending.action : null}
                  />
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

      {rejectTarget && (
        <RejectBookingDialog
          booking={rejectTarget}
          pending={pending?.action === "reject" && pending.bookingId === rejectTarget._id}
          error={rejectError}
          onDismiss={closeRejectDialog}
          onConfirm={confirmReject}
        />
      )}

      {completeTarget && (
        <CompleteWorkDialog
          booking={completeTarget}
          pending={pending?.action === "complete" && pending.bookingId === completeTarget._id}
          error={completeError}
          onDismiss={closeCompleteDialog}
          onConfirm={confirmComplete}
        />
      )}
    </div>
  );
}
