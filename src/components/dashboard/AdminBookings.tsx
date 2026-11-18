"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { roleFromUser } from "@/components/dashboard/DashboardSidebar";
import {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  type BookingStatus,
  type PaymentStatus,
} from "@/components/dashboard/MyBookings";

/** Admin all-bookings — read-only view of GET /api/admin/bookings. */

interface AdminBooking {
  id: string;
  customerName: string;
  customerEmail: string;
  technicianName: string;
  technicianEmail: string;
  serviceTitle: string;
  serviceCategory: string;
  serviceLocation: string;
  serviceImage: string;
  hourlyRate: number;
  securityDeposit: number;
  problemDescription: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  finalAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  currentPage: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface BookingsData {
  items: AdminBooking[];
  pagination: Pagination;
}

type ErrorKind = "unauthorized" | "forbidden" | "network" | "server" | "parse";

class AdminBookingsError extends Error {
  readonly kind: ErrorKind;
  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.name = "AdminBookingsError";
    this.kind = kind;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const PAGE_SIZE = 10;
const DEBOUNCE_MS = 350;

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
  accepted: "border-accent-500/40 bg-accent-50 text-accent-strong dark:border-accent-400/30 dark:bg-accent-400/10 dark:text-accent",
  "in-progress": "border-accent-500/50 bg-accent-500/15 text-accent-strong dark:border-accent-400/40 dark:bg-accent-400/15 dark:text-accent",
  completed: "border-success/40 bg-success-soft text-success",
  rejected: "border-error/40 bg-error-soft text-error",
  cancelled: "border-border-strong bg-surface-muted text-muted",
};
const PAYMENT_LABELS: Record<PaymentStatus, string> = { unpaid: "Unpaid", paid: "Paid", refunded: "Refunded" };
const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  unpaid: "border-warning/40 bg-warning-soft text-warning",
  paid: "border-success/40 bg-success-soft text-success",
  refunded: "border-border-strong bg-surface-muted text-muted",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const requiredString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) throw new AdminBookingsError("parse", "The server returned an unexpected booking payload.");
  return value;
};

function parseBooking(raw: unknown): AdminBooking {
  if (!isRecord(raw)) throw new AdminBookingsError("parse", "The server returned an unexpected booking payload.");
  const status = raw.status;
  if (typeof status !== "string" || !BOOKING_STATUSES.some((value) => value === status)) throw new AdminBookingsError("parse", "The server returned an unknown booking status.");
  const paymentStatus = raw.paymentStatus;
  if (typeof paymentStatus !== "string" || !PAYMENT_STATUSES.some((value) => value === paymentStatus)) throw new AdminBookingsError("parse", "The server returned an unknown payment status.");
  const finalAmount = raw.finalAmount;
  return {
    id: requiredString(raw, "id"),
    customerName: requiredString(raw, "customerName"),
    customerEmail: typeof raw.customerEmail === "string" ? raw.customerEmail : "",
    technicianName: typeof raw.technicianName === "string" ? raw.technicianName : "",
    technicianEmail: typeof raw.technicianEmail === "string" ? raw.technicianEmail : "",
    serviceTitle: requiredString(raw, "serviceTitle"),
    serviceCategory: typeof raw.serviceCategory === "string" ? raw.serviceCategory : "",
    serviceLocation: typeof raw.serviceLocation === "string" ? raw.serviceLocation : "",
    serviceImage: typeof raw.serviceImage === "string" ? raw.serviceImage : "",
    hourlyRate: typeof raw.hourlyRate === "number" ? raw.hourlyRate : 0,
    securityDeposit: typeof raw.securityDeposit === "number" ? raw.securityDeposit : 0,
    problemDescription: typeof raw.problemDescription === "string" ? raw.problemDescription : "",
    status: status as BookingStatus,
    paymentStatus: paymentStatus as PaymentStatus,
    finalAmount: typeof finalAmount === "number" && Number.isFinite(finalAmount) ? finalAmount : null,
    createdAt: requiredString(raw, "createdAt"),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function parsePagination(raw: unknown): Pagination {
  if (!isRecord(raw)) throw new AdminBookingsError("parse", "The server returned an unexpected pagination payload.");
  const currentPage = raw.currentPage, limit = raw.limit, totalItems = raw.totalItems, totalPages = raw.totalPages;
  if (
    typeof currentPage !== "number" || !Number.isFinite(currentPage) ||
    typeof limit !== "number" || !Number.isFinite(limit) ||
    typeof totalItems !== "number" || !Number.isFinite(totalItems) ||
    typeof totalPages !== "number" || !Number.isFinite(totalPages) ||
    typeof raw.hasNextPage !== "boolean" || typeof raw.hasPrevPage !== "boolean"
  ) throw new AdminBookingsError("parse", "The server returned an unexpected pagination payload.");
  return { currentPage, limit, totalItems, totalPages, hasNextPage: raw.hasNextPage, hasPrevPage: raw.hasPrevPage };
}

async function fetchAccessToken(): Promise<string> {
  let response: { data: unknown; error: null | ({ status: number } & Record<string, unknown>) };
  try {
    response = await authClient.$fetch<{ token: string }>("/token", { method: "GET" });
  } catch {
    throw new AdminBookingsError("network", "Couldn't reach the FixMate server to verify your session. Check your connection and try again.");
  }
  if (response.error) {
    if (response.error.status === 401 || response.error.status === 403) throw new AdminBookingsError("unauthorized", "Your session has expired. Sign in again to view bookings.");
    throw new AdminBookingsError("server", "We couldn't verify your session right now. Please try again.");
  }
  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) throw new AdminBookingsError("server", "The FixMate server returned an unexpected session-token response.");
  return data.token;
}

async function fetchBookings(
  options: { search: string; status: string; paymentStatus: string; page: number; signal: AbortSignal }
): Promise<BookingsData> {
  const token = await fetchAccessToken();
  const params = new URLSearchParams({ page: String(options.page), limit: String(PAGE_SIZE) });
  if (options.search) params.set("search", options.search);
  if (options.status !== "all") params.set("status", options.status);
  if (options.paymentStatus !== "all") params.set("paymentStatus", options.paymentStatus);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/admin/bookings?${params.toString()}`, {
      method: "GET", headers: { Authorization: `Bearer ${token}` }, credentials: "include", signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AdminBookingsError("network", "Couldn't reach the FixMate server. Check your connection and try again.");
  }
  if (response.status === 401) throw new AdminBookingsError("unauthorized", "Your session has expired. Sign in again to view bookings.");
  if (response.status === 403) throw new AdminBookingsError("forbidden", "Admin access only. This account can't view all bookings.");
  let body: unknown = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) throw new AdminBookingsError("server", isRecord(body) && typeof body.message === "string" ? body.message : "Couldn't load bookings. Please try again.");
  if (!isRecord(body) || body.success !== true || !Array.isArray(body.data)) throw new AdminBookingsError("parse", "The server returned an unexpected response.");
  return { items: body.data.map(parseBooking), pagination: parsePagination(body.pagination) };
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading bookings…" className="grid gap-4 lg:grid-cols-2">
      <span className="sr-only">Loading bookings…</span>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} aria-hidden="true" className="h-44 animate-pulse rounded-2xl border border-border bg-surface" />
      ))}
    </div>
  );
}

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${className}`}>{label}</span>;
}

const formatAmount = (value: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export default function AdminBookings() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const role = roleFromUser(user);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: AdminBookingsError }
    | { phase: "success"; data: BookingsData }
  >({ phase: "loading" });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (isPending || !user || role !== "admin") return;
    const controller = new AbortController();
    let cancelled = false;
    fetchBookings({ search: debouncedSearch, status, paymentStatus, page, signal: controller.signal })
      .then((data) => { if (!cancelled) setState({ phase: "success", data }); })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          phase: "error",
          error: error instanceof AdminBookingsError ? error : new AdminBookingsError("server", "Something went wrong while loading bookings. Please try again."),
        });
      });
    return () => { cancelled = true; controller.abort(); };
  }, [debouncedSearch, status, paymentStatus, page, reloadToken, isPending, user, role]);

  if (isPending) return <Skeleton />;
  if (!user) return null;
  if (role !== "admin") {
    return (
      <section className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-heading">Admin access only</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">All bookings are available to administrators only.</p>
        <Link href="/dashboard" className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm cursor-pointer transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:bg-primary-hover active:scale-[0.98]">Back to your dashboard</Link>
      </section>
    );
  }

  const isLoading = state.phase === "loading";
  const totalItems = state.phase === "success" ? state.data.pagination.totalItems : null;
  const selectClass = "h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium text-foreground outline-none transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25 cursor-pointer";

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-2">
          <label htmlFor="admin-booking-search" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Search</label>
          <input
            id="admin-booking-search"
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Customer, service or technician…"
            className="mt-1.5 h-11 w-full rounded-lg border border-border-strong bg-surface px-4 text-sm text-foreground placeholder:text-muted outline-none transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25"
          />
        </div>
        <div>
          <label htmlFor="admin-booking-status" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Booking status</label>
          <select id="admin-booking-status" value={status} onChange={(event) => { setState({ phase: "loading" }); setStatus(event.target.value); setPage(1); }} className={`mt-1.5 ${selectClass}`}>
            <option value="all">All statuses</option>
            {BOOKING_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="admin-booking-payment" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Payment status</label>
          <select id="admin-booking-payment" value={paymentStatus} onChange={(event) => { setState({ phase: "loading" }); setPaymentStatus(event.target.value); setPage(1); }} className={`mt-1.5 ${selectClass}`}>
            <option value="all">All payments</option>
            {PAYMENT_STATUSES.map((value) => <option key={value} value={value}>{PAYMENT_LABELS[value]}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {totalItems !== null && <p aria-live="polite" className="text-xs font-medium tabular-nums text-muted sm:text-sm">{totalItems} booking{totalItems === 1 ? "" : "s"}</p>}
        <button
          type="button"
          onClick={() => { setState({ phase: "loading" }); setReloadToken((token) => token + 1); }}
          disabled={isLoading}
          aria-label="Refresh bookings"
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-200 enabled:hover:bg-surface-muted enabled:hover:text-heading disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`h-5 w-5 ${isLoading ? "animate-spin motion-reduce:animate-none" : ""}`}><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
        </button>
      </div>

      <div className="mt-6" aria-busy={isLoading}>
        {state.phase === "loading" && <Skeleton />}
        {state.phase === "error" && (
          <div role="alert" className="rounded-2xl border border-error/40 bg-error-soft/60 px-5 py-10 text-center">
            <h2 className="text-lg font-bold text-heading">{state.error.kind === "unauthorized" ? "Session expired" : "Couldn't load bookings"}</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{state.error.message}</p>
            <div className="mt-5 flex justify-center gap-3">
              {state.error.kind === "unauthorized" ? (
                <Link href="/sign-in" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm cursor-pointer transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:bg-primary-hover active:scale-[0.98]">Sign in again</Link>
              ) : (
                <button type="button" onClick={() => { setState({ phase: "loading" }); setReloadToken((token) => token + 1); }} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm cursor-pointer transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:bg-primary-hover active:scale-[0.98]">Try again</button>
              )}
            </div>
          </div>
        )}
        {state.phase === "success" && state.data.items.length === 0 && (
          status === "cancelled" ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted/30 px-6 py-14 text-center">
              <h2 className="text-lg font-bold text-heading">No cancelled bookings</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">Bookings cancelled on the platform will appear here and be kept for records and reporting.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted/30 px-6 py-14 text-center">
              <h2 className="text-lg font-bold text-heading">No bookings found</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">Try a different search or filter selection.</p>
            </div>
          )
        )}
        {state.phase === "success" && state.data.items.length > 0 && (
          <>
            <ul className="grid gap-4 lg:grid-cols-2">
              {state.data.items.map((booking) => (
                <li key={booking.id}>
                  <article className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-xs">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-heading">{booking.serviceTitle}</h3>
                        <p className="mt-0.5 text-xs text-muted">{booking.serviceCategory}{booking.serviceLocation ? ` · ${booking.serviceLocation}` : ""}</p>
                        <p className="mt-1 text-xs text-muted">Customer: <span className="font-semibold text-heading">{booking.customerName}</span></p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge label={STATUS_LABELS[booking.status]} className={STATUS_STYLES[booking.status]} />
                        <Badge label={PAYMENT_LABELS[booking.paymentStatus]} className={PAYMENT_STYLES[booking.paymentStatus]} />
                      </div>
                    </div>
                    {booking.problemDescription && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted">{booking.problemDescription}</p>}
                    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs sm:grid-cols-3">
                      <div><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Hourly rate</dt><dd className="mt-0.5 font-semibold tabular-nums text-heading">{formatAmount(booking.hourlyRate)}</dd></div>
                      <div><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Final amount</dt><dd className="mt-0.5 font-semibold tabular-nums text-heading">{booking.finalAmount === null ? "—" : formatAmount(booking.finalAmount)}</dd></div>
                      <div><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Booked</dt><dd className="mt-0.5 font-medium text-heading">{formatDate(booking.createdAt)}</dd></div>
                    </dl>
                    <p className="mt-3 text-[10px] text-muted">Technician: {booking.technicianName || "—"} · Ref <code className="font-mono">{booking.id}</code></p>
                    <div className="mt-3 flex justify-end border-t border-border pt-3">
                      <Link
                        href={`/dashboard/admin/bookings/${booking.id}`}
                        aria-label={`View details for ${booking.serviceTitle}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-strong transition-colors duration-200 hover:text-accent-600 dark:text-accent dark:hover:text-accent-400"
                      >
                        View details
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      </Link>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
            <nav aria-label="Bookings pagination" className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
              <button type="button" onClick={() => { setState({ phase: "loading" }); setPage(Math.max(1, state.data.pagination.currentPage - 1)); }} disabled={!state.data.pagination.hasPrevPage || isLoading} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer active:bg-surface-muted">Previous</button>
              <p className="text-xs font-medium tabular-nums text-muted">Page <span className="font-semibold text-heading">{state.data.pagination.currentPage}</span> of <span className="font-semibold text-heading">{Math.max(state.data.pagination.totalPages, 1)}</span></p>
              <button type="button" onClick={() => { setState({ phase: "loading" }); setPage(state.data.pagination.currentPage + 1); }} disabled={!state.data.pagination.hasNextPage || isLoading} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer active:bg-surface-muted">Next</button>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
