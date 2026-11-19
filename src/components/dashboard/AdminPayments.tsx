"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { roleFromUser } from "@/components/dashboard/DashboardSidebar";
import { API_BASE } from "@/lib/api";

/** Admin payment management — GET /api/admin/payments.
 *  Read-only by design: payment statuses are owned by the verified Stripe
 *  webhook. No status editing, no refunds, no manual marks. */

export const PAYMENT_RECORD_STATUSES = [
  "pending",
  "succeeded",
  "failed",
  "expired",
] as const;
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

export interface AdminPayment {
  id: string;
  bookingId: string;
  customerName: string | null;
  customerEmail: string | null;
  /** Stripe Checkout Session id — an identifier, not a secret. */
  reference: string | null;
  paymentIntentId: string | null;
  amount: number;
  amountMinor: number;
  currency: string;
  status: PaymentRecordStatus;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}

export interface AdminPaymentsSummary {
  successfulPayments: number;
  successfulAmountByCurrency: Array<{ currency: string; amount: number }>;
  pendingPayments: number;
  failedPayments: number;
  expiredPayments: number;
}

export interface PaymentsPagination {
  currentPage: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface PaymentsData {
  items: AdminPayment[];
  summary: AdminPaymentsSummary;
  pagination: PaymentsPagination;
}

type ErrorKind = "unauthorized" | "forbidden" | "network" | "server" | "parse";

class AdminPaymentsError extends Error {
  readonly kind: ErrorKind;
  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.name = "AdminPaymentsError";
    this.kind = kind;
  }
}

const PAGE_SIZE = 12;
const DEBOUNCE_MS = 350;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const nullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

function parsePayment(raw: unknown): AdminPayment {
  if (!isRecord(raw)) throw new AdminPaymentsError("parse", "The server returned an unexpected payment payload.");
  const status = raw.status;
  if (typeof status !== "string" || !(PAYMENT_RECORD_STATUSES as readonly string[]).includes(status)) {
    throw new AdminPaymentsError("parse", "The server returned an unknown payment status.");
  }
  const amount = raw.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new AdminPaymentsError("parse", "The server returned an invalid amount.");
  }
  const currency = raw.currency;
  if (typeof currency !== "string" || currency.length === 0) {
    throw new AdminPaymentsError("parse", "The server returned an invalid currency.");
  }
  return {
    id: typeof raw.id === "string" && raw.id.length > 0 ? raw.id : (() => { throw new AdminPaymentsError("parse", "The server returned a payment without an id."); })(),
    bookingId: typeof raw.bookingId === "string" && raw.bookingId.length > 0 ? raw.bookingId : (() => { throw new AdminPaymentsError("parse", "The server returned a payment without a booking reference."); })(),
    customerName: nullableString(raw.customerName),
    customerEmail: nullableString(raw.customerEmail),
    reference: nullableString(raw.reference),
    paymentIntentId: nullableString(raw.paymentIntentId),
    amount,
    amountMinor: typeof raw.amountMinor === "number" ? raw.amountMinor : Math.round(amount * 100),
    currency: currency.toLowerCase(),
    status: status as PaymentRecordStatus,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : String(raw.createdAt),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : String(raw.updatedAt),
    paidAt: raw.paidAt === null || raw.paidAt === undefined ? null : nullableString(raw.paidAt),
  };
}

function parseSummary(raw: unknown): AdminPaymentsSummary {
  if (!isRecord(raw)) throw new AdminPaymentsError("parse", "The server returned an unexpected summary payload.");
  if (typeof raw.successfulPayments !== "number" || !Number.isFinite(raw.successfulPayments)) {
    throw new AdminPaymentsError("parse", "The server returned an unexpected summary payload.");
  }
  if (!Array.isArray(raw.successfulAmountByCurrency)) {
    throw new AdminPaymentsError("parse", "The server returned an unexpected summary payload.");
  }
  const amountByCurrency: Array<{ currency: string; amount: number }> = [];
  for (const entry of raw.successfulAmountByCurrency) {
    if (!isRecord(entry) || typeof entry.currency !== "string" || typeof entry.amount !== "number" || !Number.isFinite(entry.amount)) {
      throw new AdminPaymentsError("parse", "The server returned an unexpected summary payload.");
    }
    amountByCurrency.push({ currency: String(entry.currency).toLowerCase(), amount: entry.amount });
  }
  return {
    successfulPayments: raw.successfulPayments,
    successfulAmountByCurrency: amountByCurrency,
    pendingPayments: typeof raw.pendingPayments === "number" ? raw.pendingPayments : 0,
    failedPayments: typeof raw.failedPayments === "number" ? raw.failedPayments : 0,
    expiredPayments: typeof raw.expiredPayments === "number" ? raw.expiredPayments : 0,
  };
}

function parsePagination(raw: unknown): PaymentsPagination {
  if (!isRecord(raw)) throw new AdminPaymentsError("parse", "The server returned an unexpected pagination payload.");
  const currentPage = raw.currentPage, limit = raw.limit, totalItems = raw.totalItems, totalPages = raw.totalPages;
  if (
    typeof currentPage !== "number" || !Number.isFinite(currentPage) ||
    typeof limit !== "number" || !Number.isFinite(limit) ||
    typeof totalItems !== "number" || !Number.isFinite(totalItems) ||
    typeof totalPages !== "number" || !Number.isFinite(totalPages) ||
    typeof raw.hasNextPage !== "boolean" || typeof raw.hasPrevPage !== "boolean"
  ) throw new AdminPaymentsError("parse", "The server returned an unexpected pagination payload.");
  return { currentPage, limit, totalItems, totalPages, hasNextPage: raw.hasNextPage, hasPrevPage: raw.hasPrevPage };
}

function parsePaymentsResponse(body: unknown): PaymentsData {
  if (!isRecord(body)) throw new AdminPaymentsError("parse", "The server returned an unexpected response.");
  if (body.success !== true) {
    throw new AdminPaymentsError("server", typeof body.message === "string" ? body.message : "Couldn't load payments.");
  }
  if (!Array.isArray(body.data)) throw new AdminPaymentsError("parse", "The server returned an unexpected payments payload.");
  return { items: body.data.map(parsePayment), summary: parseSummary(body.summary), pagination: parsePagination(body.pagination) };
}

async function fetchAccessToken(): Promise<string> {
  let response: { data: unknown; error: null | ({ status: number } & Record<string, unknown>) };
  try {
    response = await authClient.$fetch<{ token: string }>("/token", { method: "GET" });
  } catch {
    throw new AdminPaymentsError("network", "Couldn't reach the FixMate server to verify your session. Check your connection and try again.");
  }
  if (response.error) {
    if (response.error.status === 401 || response.error.status === 403) {
      throw new AdminPaymentsError("unauthorized", "Your session has expired. Sign in again to manage payments.");
    }
    throw new AdminPaymentsError("server", "We couldn't verify your session right now. Please try again.");
  }
  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new AdminPaymentsError("server", "The FixMate server returned an unexpected session-token response.");
  }
  return data.token;
}

type PaymentFilters = {
  search: string;
  status: PaymentRecordStatus | "all";
  from: string;
  to: string;
};

async function fetchAdminPayments(filters: PaymentFilters, page: number, signal: AbortSignal): Promise<PaymentsData> {
  const token = await fetchAccessToken();
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (filters.search) params.set("search", filters.search);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/admin/payments?${params.toString()}`, {
      method: "GET", headers: { Authorization: `Bearer ${token}` }, credentials: "include", signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AdminPaymentsError("network", "Couldn't reach the FixMate server. Check your connection and try again.");
  }
  if (response.status === 401) throw new AdminPaymentsError("unauthorized", "Your session has expired. Sign in again to manage payments.");
  if (response.status === 403) throw new AdminPaymentsError("forbidden", "Admin access only. This account can't manage payments.");
  let body: unknown = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) {
    throw new AdminPaymentsError("server", isRecord(body) && typeof body.message === "string" ? body.message : "Couldn't load payments. Please try again.");
  }
  return parsePaymentsResponse(body);
}


const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return `${dateFormatter.format(date)} · ${timeFormatter.format(date)}`;
}

/** Formats a major-unit amount using the stored ISO 4217 currency. Falls
 *  back to a plain number + uppercased code when the code isn't known to
 *  Intl. Never assumes USD. */
function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(amount)} ${currency.toUpperCase()}`;
  }
}

const STATUS_LABELS: Record<PaymentRecordStatus, string> = {
  pending: "Pending",
  succeeded: "Succeeded",
  failed: "Failed",
  expired: "Expired",
};

const STATUS_STYLES: Record<PaymentRecordStatus, string> = {
  pending: "border-warning/40 bg-warning-soft text-warning",
  succeeded: "border-success/40 bg-success-soft text-success",
  failed: "border-error/40 bg-error-soft text-error",
  expired: "border-border-strong bg-surface-muted text-muted",
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${className}`}>
      {label}
    </span>
  );
}


function SummaryCards({ summary }: { summary: AdminPaymentsSummary }) {
  const totalAmountLabel = summary.successfulAmountByCurrency.length > 0
    ? summary.successfulAmountByCurrency.map((entry) => formatAmount(entry.amount, entry.currency)).join(" · ")
    : "—";

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-success/40 bg-success-soft/40 p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-success">Successful payments</p>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5 text-success">
            <circle cx="12" cy="12" r="9" /><path d="M9 12.5l2 2 4-4.5" />
          </svg>
        </div>
        <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight text-heading">{summary.successfulPayments}</p>
        <p className="mt-1 text-[11px] leading-snug text-muted">Settled by Stripe&rsquo;s verified webhook</p>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Successful amount</p>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5 text-muted">
            <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
          </svg>
        </div>
        <p className="mt-2 break-words text-lg font-extrabold tabular-nums tracking-tight text-heading sm:text-xl">{totalAmountLabel}</p>
        <p className="mt-1 text-[11px] leading-snug text-muted">Per-currency totals across settled payments</p>
      </div>
      <div className="rounded-2xl border border-warning/40 bg-warning-soft/40 p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-warning">Pending payments</p>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5 text-warning">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight text-heading">{summary.pendingPayments}</p>
        <p className="mt-1 text-[11px] leading-snug text-muted">Awaiting Stripe&rsquo;s confirmation</p>
      </div>
      <div className="rounded-2xl border border-error/40 bg-error-soft/40 p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-error">Failed payments</p>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5 text-error">
            <circle cx="12" cy="12" r="9" /><path d="M9 15l6-6M9 9l6 6" />
          </svg>
        </div>
        <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight text-heading">{summary.failedPayments}</p>
        <p className="mt-1 text-[11px] leading-snug text-muted">{summary.expiredPayments} expired · not settled</p>
      </div>
    </div>
  );
}


function CopyReferenceButton({ value }: { value: string }) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Reference copied to clipboard.");
    } catch {
      toast.error("Couldn't copy to your clipboard.");
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy reference"
      title="Copy reference"
      className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-heading cursor-pointer active:scale-95"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
      </svg>
    </button>
  );
}


function PaymentRow({ payment }: { payment: AdminPayment }) {
  return (
    <li>
      <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs transition-shadow duration-200 hover:shadow-md">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Payment <code className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">{payment.id}</code>
              </p>
              {payment.reference && (
                <p className="inline-flex items-center text-[11px] text-muted">
                  Ref <code className="ml-1 select-all rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">{payment.reference.slice(0, 20)}{payment.reference.length > 20 ? "…" : ""}</code>
                  <CopyReferenceButton value={payment.reference} />
                </p>
              )}
            </div>
            <p className="mt-2 truncate text-sm font-bold text-heading">{payment.customerName ?? "Unknown customer"}</p>
            <p className="mt-0.5 truncate text-xs text-muted">{payment.customerEmail ?? "No email on file"}</p>
            <p className="mt-2 font-mono text-[10px] text-muted">Booking <span className="select-all text-foreground">{payment.bookingId}</span></p>
            {payment.paymentIntentId && (
              <p className="mt-0.5 font-mono text-[10px] text-muted">Intent <span className="select-all text-foreground">{payment.paymentIntentId}</span></p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <Badge label={STATUS_LABELS[payment.status]} className={STATUS_STYLES[payment.status]} />
            <p className="text-2xl font-extrabold tabular-nums tracking-tight text-heading">
              {formatAmount(payment.amount, payment.currency)}
            </p>
            <p className="text-[11px] tabular-nums text-muted">
              {payment.status === "succeeded" && payment.paidAt
                ? `Paid ${formatDateTime(payment.paidAt)}`
                : `Opened ${formatDateTime(payment.createdAt)}`}
            </p>
          </div>
        </div>
      </article>
    </li>
  );
}


function PaymentsSkeleton() {
  return (
    <div role="status" aria-label="Loading payments…" className="space-y-4">
      <span className="sr-only">Loading payments…</span>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl border border-border bg-surface" />
        ))}
      </div>
      <div aria-hidden="true" className="space-y-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}

function ErrorPanel({ error, onRetry }: { error: AdminPaymentsError; onRetry: () => void }) {
  const unauthorized = error.kind === "unauthorized";
  return (
    <div role="alert" className="rounded-2xl border border-error/40 bg-error-soft/60 px-5 py-10 text-center sm:px-8">
      <h2 className="text-lg font-bold text-heading">{unauthorized ? "Session expired" : "Couldn't load payments"}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{error.message}</p>
      <div className="mt-5">
        {unauthorized ? (
          <Link href="/sign-in" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm cursor-pointer transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:bg-primary-hover active:scale-[0.98]">Sign in again</Link>
        ) : (
          <button type="button" onClick={onRetry} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm cursor-pointer transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:bg-primary-hover active:scale-[0.98]">Try again</button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted/30 px-6 py-14 text-center">
      <h2 className="text-lg font-bold text-heading">No payments found</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        {filtered ? "No Stripe payments match your filters." : "No payments have been recorded yet — they appear here as customers check out."}
      </p>
      {filtered && (
        <button type="button" onClick={onClear} className="mt-5 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted cursor-pointer active:bg-surface-muted">Clear filters</button>
      )}
    </div>
  );
}


const DEFAULT_FILTERS: PaymentFilters = { search: "", status: "all", from: "", to: "" };

export default function AdminPayments() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const role = roleFromUser(user);

  const [filters, setFilters] = useState<PaymentFilters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: AdminPaymentsError }
    | { phase: "success"; data: PaymentsData }
  >({ phase: "loading" });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [filters.search]);

  useEffect(() => {
    if (isPending || !user || role !== "admin") return;
    const controller = new AbortController();
    let cancelled = false;
    const effective: PaymentFilters = {
      search: debouncedSearch,
      status: filters.status,
      from: filters.from,
      to: filters.to,
    };
    fetchAdminPayments(effective, page, controller.signal)
      .then((data) => { if (!cancelled) setState({ phase: "success", data }); })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          phase: "error",
          error: error instanceof AdminPaymentsError ? error : new AdminPaymentsError("server", "Something went wrong while loading payments. Please try again."),
        });
      });
    return () => { cancelled = true; controller.abort(); };
  }, [debouncedSearch, filters.status, filters.from, filters.to, page, reloadToken, isPending, user, role]);

  if (isPending) return <PaymentsSkeleton />;
  if (!user) return null;

  if (role !== "admin") {
    return (
      <section className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-heading">Admin access only</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">Payment reconciliation is available to administrators only.</p>
        <Link href="/dashboard" className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm cursor-pointer transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:bg-primary-hover active:scale-[0.98]">Back to your dashboard</Link>
      </section>
    );
  }

  const isLoading = state.phase === "loading";
  const totalItems = state.phase === "success" ? state.data.pagination.totalItems : null;
  const filtered = filters.search !== "" || filters.status !== "all" || filters.from !== "" || filters.to !== "";

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }

  const selectFilter = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setState({ phase: "loading" });
    setFilters((current) => ({ ...current, status: event.target.value as PaymentFilters["status"] }));
    setPage(1);
  };

  const dateFilter = (key: "from" | "to") => (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({ phase: "loading" });
    setFilters((current) => ({ ...current, [key]: event.target.value }));
    setPage(1);
  };

  return (
    <div>
      {state.phase === "success" && <SummaryCards summary={state.data.summary} />}
      {state.phase === "loading" && (
        <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl border border-border bg-surface" />
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid w-full gap-3 sm:grid-cols-2 xl:max-w-3xl">
          <div>
            <label htmlFor="admin-payment-search" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Search</label>
            <input
              id="admin-payment-search"
              type="search"
              value={filters.search}
              onChange={(event) => { setFilters((current) => ({ ...current, search: event.target.value })); setPage(1); }}
              placeholder="Customer, email, payment ref or ID…"
              className="mt-1.5 h-11 w-full rounded-lg border border-border-strong bg-surface px-4 text-sm text-foreground placeholder:text-muted outline-none transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="admin-payment-status" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Status</label>
              <select
                id="admin-payment-status"
                value={filters.status}
                onChange={selectFilter}
                className="mt-1.5 h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium text-foreground outline-none transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25 cursor-pointer"
              >
                <option value="all">All statuses</option>
                <option value="succeeded">Succeeded</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div>
              <label htmlFor="admin-payment-from" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">From</label>
              <input
                id="admin-payment-from"
                type="date"
                value={filters.from}
                onChange={dateFilter("from")}
                className="mt-1.5 h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-xs font-medium text-foreground outline-none transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25"
              />
            </div>
          </div>
          <div>
            <label htmlFor="admin-payment-to" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">To</label>
            <input
              id="admin-payment-to"
              type="date"
              value={filters.to}
              onChange={dateFilter("to")}
              className="mt-1.5 h-11 w-full rounded-lg border border-border-strong bg-surface px-4 text-sm text-foreground outline-none transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalItems !== null && <p aria-live="polite" className="text-xs font-medium tabular-nums text-muted sm:text-sm">{totalItems} payment{totalItems === 1 ? "" : "s"}</p>}
          <button
            type="button"
            onClick={() => { setState({ phase: "loading" }); setReloadToken((token) => token + 1); }}
            disabled={isLoading}
            aria-label="Refresh payments"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-200 enabled:hover:bg-surface-muted enabled:hover:text-heading disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`h-5 w-5 ${isLoading ? "animate-spin motion-reduce:animate-none" : ""}`}><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
          </button>
        </div>
      </div>

      <div className="mt-6" aria-busy={isLoading}>
        {state.phase === "loading" && <PaymentsSkeleton />}

        {state.phase === "error" && (
          <ErrorPanel error={state.error} onRetry={() => { setState({ phase: "loading" }); setReloadToken((token) => token + 1); }} />
        )}

        {state.phase === "success" && state.data.items.length === 0 && (
          <EmptyState filtered={filtered} onClear={clearFilters} />
        )}

        {state.phase === "success" && state.data.items.length > 0 && (
          <>
            <ul className="flex flex-col gap-4">
              {state.data.items.map((payment) => (
                <PaymentRow key={payment.id} payment={payment} />
              ))}
            </ul>

            <nav aria-label="Payments pagination" className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
              <button type="button" onClick={() => { setState({ phase: "loading" }); setPage(Math.max(1, state.data.pagination.currentPage - 1)); }} disabled={!state.data.pagination.hasPrevPage || isLoading} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer active:bg-surface-muted">Previous</button>
              <p className="text-center text-xs font-medium tabular-nums text-muted sm:text-sm">
                Page <span className="font-semibold text-heading">{state.data.pagination.currentPage}</span> of <span className="font-semibold text-heading">{Math.max(state.data.pagination.totalPages, 1)}</span>
              </p>
              <button type="button" onClick={() => { setState({ phase: "loading" }); setPage(state.data.pagination.currentPage + 1); }} disabled={!state.data.pagination.hasNextPage || isLoading} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer active:bg-surface-muted">Next</button>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
