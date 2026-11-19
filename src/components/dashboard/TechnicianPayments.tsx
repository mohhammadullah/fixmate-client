"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { API_BASE } from "@/lib/api";

/** Types — mirror the backend contract exactly.
 *  GET /api/payments/technician (verifyToken + verifyTechnician) returns
 *  { success, data, summary, pagination }. Mongo dates serialize as
 *  strings; `amount` is in major currency units; `currency` is lowercase
 *  ISO 4217. One entry per completed booking owned by the caller.
 *  Stripe internals (checkout URLs, payment intent ids) and customer
 *  contact details are never returned by the endpoint. */

export const TECHNICIAN_PAYMENT_STATUSES = ["paid", "unpaid"] as const;
export type TechnicianPaymentStatus = (typeof TECHNICIAN_PAYMENT_STATUSES)[number];
export type TechnicianPaymentFilter = TechnicianPaymentStatus | "all";

export interface TechnicianPaymentEntry {
  bookingId: string;
  serviceTitle: string;
  customerName: string | null;
  amount: number;
  amountMinor: number;
  currency: string;
  status: TechnicianPaymentStatus;
  reference: string | null;
  completedAt: string;
  paidAt: string | null;
}

export interface TechnicianPaymentsSummary {
  totalCompletedBookings: number;
  paidCount: number;
  unpaidCount: number;
  /** Settled money per currency — a booking settles at most once. */
  paidAmountByCurrency: Array<{ currency: string; amount: number }>;
  /** Outstanding final amounts per currency for completed, unpaid bookings. */
  unpaidAmountByCurrency: Array<{ currency: string; amount: number }>;
}

export interface PaymentsPagination {
  currentPage: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface TechnicianPaymentsData {
  items: TechnicianPaymentEntry[];
  summary: TechnicianPaymentsSummary;
  pagination: PaymentsPagination;
}

type ErrorKind = "unauthorized" | "forbidden" | "network" | "server" | "parse";

class TechnicianPaymentsError extends Error {
  readonly kind: ErrorKind;
  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.name = "TechnicianPaymentsError";
    this.kind = kind;
  }
}

const PAGE_SIZE = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new TechnicianPaymentsError("parse", "The server returned an unexpected payment payload.");
  }
  return value;
}

function requiredFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TechnicianPaymentsError("parse", "The server returned an unexpected payment payload.");
  }
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseEntry(raw: unknown): TechnicianPaymentEntry {
  if (!isRecord(raw)) {
    throw new TechnicianPaymentsError("parse", "The server returned an unexpected payment payload.");
  }
  const status = raw.status;
  if (typeof status !== "string" || !(TECHNICIAN_PAYMENT_STATUSES as readonly string[]).includes(status)) {
    throw new TechnicianPaymentsError("parse", "The server returned an unknown payment status.");
  }
  return {
    bookingId: requiredString(raw, "bookingId"),
    serviceTitle: requiredString(raw, "serviceTitle"),
    customerName: nullableString(raw.customerName),
    amount: requiredFiniteNumber(raw, "amount"),
    amountMinor: requiredFiniteNumber(raw, "amountMinor"),
    currency: requiredString(raw, "currency").toLowerCase(),
    status: status as TechnicianPaymentStatus,
    reference: nullableString(raw.reference),
    completedAt: requiredString(raw, "completedAt"),
    paidAt: raw.paidAt == null ? null : nullableString(raw.paidAt),
  };
}

function parseCurrencyBuckets(raw: unknown): Array<{ currency: string; amount: number }> {
  if (!Array.isArray(raw)) {
    throw new TechnicianPaymentsError("parse", "The server returned an unexpected summary payload.");
  }
  return raw.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.currency !== "string" ||
      entry.currency.length === 0 ||
      typeof entry.amount !== "number" ||
      !Number.isFinite(entry.amount)
    ) {
      throw new TechnicianPaymentsError("parse", "The server returned an unexpected summary payload.");
    }
    return { currency: entry.currency.toLowerCase(), amount: entry.amount };
  });
}

function parseSummary(raw: unknown): TechnicianPaymentsSummary {
  if (!isRecord(raw)) {
    throw new TechnicianPaymentsError("parse", "The server returned an unexpected summary payload.");
  }
  return {
    totalCompletedBookings: requiredFiniteNumber(raw, "totalCompletedBookings"),
    paidCount: requiredFiniteNumber(raw, "paidCount"),
    unpaidCount: requiredFiniteNumber(raw, "unpaidCount"),
    paidAmountByCurrency: parseCurrencyBuckets(raw.paidAmountByCurrency),
    unpaidAmountByCurrency: parseCurrencyBuckets(raw.unpaidAmountByCurrency),
  };
}

function parsePagination(raw: unknown): PaymentsPagination {
  if (!isRecord(raw)) {
    throw new TechnicianPaymentsError("parse", "The server returned an unexpected pagination payload.");
  }
  const currentPage = requiredFiniteNumber(raw, "currentPage");
  const limit = requiredFiniteNumber(raw, "limit");
  const totalItems = requiredFiniteNumber(raw, "totalItems");
  const totalPages = requiredFiniteNumber(raw, "totalPages");
  if (typeof raw.hasNextPage !== "boolean" || typeof raw.hasPrevPage !== "boolean") {
    throw new TechnicianPaymentsError("parse", "The server returned an unexpected pagination payload.");
  }
  return { currentPage, limit, totalItems, totalPages, hasNextPage: raw.hasNextPage, hasPrevPage: raw.hasPrevPage };
}

function parseResponse(body: unknown): TechnicianPaymentsData {
  if (!isRecord(body)) {
    throw new TechnicianPaymentsError("parse", "The server returned an unexpected response.");
  }
  if (body.success !== true) {
    const message =
      typeof body.message === "string" && body.message.length > 0 && body.message.length <= 200
        ? body.message
        : "The server couldn't load your payments.";
    throw new TechnicianPaymentsError("server", message);
  }
  if (!Array.isArray(body.data)) {
    throw new TechnicianPaymentsError("parse", "The server returned an unexpected payments payload.");
  }
  return {
    items: body.data.map(parseEntry),
    summary: parseSummary(body.summary),
    pagination: parsePagination(body.pagination),
  };
}

/** Retrieve a short-lived JWT from the Better Auth server (`/api/auth/token`,
 *  session-cookie gated). Returns the token string only. */
async function fetchAccessToken(): Promise<string> {
  let response: { data: unknown; error: null | ({ status: number } & Record<string, unknown>) };
  try {
    response = await authClient.$fetch<{ token: string }>("/token", { method: "GET" });
  } catch {
    throw new TechnicianPaymentsError(
      "network",
      "Couldn't reach the FixMate server to verify your session. Check your connection and try again."
    );
  }

  if (response.error) {
    if (response.error.status === 401 || response.error.status === 403) {
      throw new TechnicianPaymentsError(
        "unauthorized",
        "Your session has expired. Sign in again to view your payments."
      );
    }
    throw new TechnicianPaymentsError(
      "server",
      "We couldn't verify your session with FixMate right now. Please try again."
    );
  }

  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new TechnicianPaymentsError(
      "parse",
      "The FixMate server returned an unexpected session-token response."
    );
  }
  return data.token;
}

async function fetchTechnicianPayments(options: {
  page: number;
  limit: number;
  filter: TechnicianPaymentFilter;
  signal: AbortSignal;
}): Promise<TechnicianPaymentsData> {
  const token = await fetchAccessToken();

  const params = new URLSearchParams({
    page: String(options.page),
    limit: String(options.limit),
  });
  if (options.filter !== "all") {
    params.set("status", options.filter);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/payments/technician?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new TechnicianPaymentsError(
      "network",
      "Couldn't reach the FixMate server. Check your connection and try again."
    );
  }

  if (response.status === 401) {
    throw new TechnicianPaymentsError(
      "unauthorized",
      "Your session has expired. Sign in again to view your payments."
    );
  }
  if (response.status === 403) {
    throw new TechnicianPaymentsError(
      "forbidden",
      "Technician access only. This account can't view technician payments."
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
        : "The server couldn't load your payments. Please try again.";
    throw new TechnicianPaymentsError("server", message);
  }

  return parseResponse(body);
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

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return `${dateFormatter.format(date)} · ${timeFormatter.format(date)}`;
}

/** Formats a major-unit amount with the ISO 4217 code from the API. Falls
 *  back to a plain number + code when the code isn't a known currency. */
function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(amount)} ${currency.toUpperCase()}`;
  }
}

/** Joins per-currency totals with " · " — different currencies are never
 *  summed into one meaningless number. */
function formatCurrencyBuckets(buckets: Array<{ currency: string; amount: number }>): string {
  if (buckets.length === 0) return "—";
  return buckets.map((entry) => formatAmount(entry.amount, entry.currency)).join(" · ");
}

const FILTERS: Array<{ value: TechnicianPaymentFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
];

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${className}`}
    >
      {label}
    </span>
  );
}

const STATUS_BADGE: Record<TechnicianPaymentStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "border-success/40 bg-success-soft text-success" },
  unpaid: { label: "Unpaid", className: "border-warning/40 bg-warning-soft text-warning" },
};

function ReferenceButton({ value }: { value: string }) {
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
      aria-label="Copy payment reference"
      title="Copy payment reference"
      className="mt-0.5 inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-md bg-surface-muted px-2 py-1 font-mono text-[10px] font-semibold text-foreground transition-colors duration-200 hover:bg-surface-muted/70 hover:text-heading active:scale-[0.97]"
    >
      <span className="select-all truncate">{value}</span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 text-muted"
      >
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
      </svg>
    </button>
  );
}

function SummaryCards({ summary }: { summary: TechnicianPaymentsSummary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div className="rounded-2xl border border-success/40 bg-success-soft/40 p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-success">Total paid</p>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5 text-success">
            <circle cx="12" cy="12" r="9" /><path d="M9 12.5l2 2 4-4.5" />
          </svg>
        </div>
        <p className="mt-2 break-words text-xl font-extrabold tabular-nums tracking-tight text-heading sm:text-2xl">
          {formatCurrencyBuckets(summary.paidAmountByCurrency)}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-muted">
          {summary.paidCount} settled {summary.paidCount === 1 ? "booking" : "bookings"}
        </p>
      </div>

      <div className="rounded-2xl border border-warning/40 bg-warning-soft/40 p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-warning">Total unpaid</p>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5 text-warning">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" />
          </svg>
        </div>
        <p className="mt-2 break-words text-xl font-extrabold tabular-nums tracking-tight text-heading sm:text-2xl">
          {formatCurrencyBuckets(summary.unpaidAmountByCurrency)}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-muted">
          {summary.unpaidCount} outstanding {summary.unpaidCount === 1 ? "booking" : "bookings"}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:col-span-2 xl:col-span-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Completed bookings</p>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5 text-muted">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight text-heading">
          {summary.totalCompletedBookings}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-muted">Paid and unpaid combined</p>
      </div>
    </div>
  );
}

function PaymentsSkeleton() {
  return (
    <div role="status" aria-label="Loading your payments…" className="space-y-4">
      <span className="sr-only">Loading your payments…</span>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl bg-surface-muted/70" />
        ))}
      </div>
      <div aria-hidden="true" className="space-y-4 pt-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-2xl border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}

function ErrorPanel({
  error,
  onRetry,
}: {
  error: TechnicianPaymentsError;
  onRetry: () => void;
}) {
  const unauthorized = error.kind === "unauthorized";
  const forbidden = error.kind === "forbidden";

  return (
    <div role="alert" className="rounded-2xl border border-error/40 bg-error-soft/60 px-5 py-10 text-center sm:px-8">
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
        {unauthorized ? "Session expired" : forbidden ? "Technician access only" : "Couldn't load your payments"}
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">{error.message}</p>
      <div className="mt-5">
        {unauthorized ? (
          <Link
            href="/sign-in"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] active:bg-primary-hover"
          >
            Sign in again
          </Link>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] active:bg-primary-hover"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ filter }: { filter: TechnicianPaymentFilter }) {
  const filtered = filter !== "all";
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted/30 px-6 py-12 text-center sm:py-16">
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
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20M6 15h4" />
        </svg>
      </div>
      <h2 className="mt-6 text-xl font-bold tracking-tight text-heading">
        {filtered ? `No ${filter} payments yet` : "No completed jobs yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {filtered
          ? `None of your completed bookings are ${filter} right now. Switch the filter to see the others.`
          : "Once you complete a repair and mark it done, its settlement details will show up here — amount, status and the booking reference."}
      </p>
    </div>
  );
}

/** Mobile card layout for a single entry. */
function EntryCard({ entry }: { entry: TechnicianPaymentEntry }) {
  const badge = STATUS_BADGE[entry.status];
  const activityDate = entry.status === "paid" && entry.paidAt ? entry.paidAt : entry.completedAt;

  return (
    <li>
      <article className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-xs transition-shadow duration-200 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-heading">{entry.serviceTitle}</h3>
            <p className="mt-0.5 truncate text-xs text-muted">
              {entry.customerName ?? "Customer"}
            </p>
          </div>
          <Badge label={badge.label} className={badge.className} />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Amount</p>
            <p className="mt-0.5 text-xl font-extrabold tabular-nums tracking-tight text-heading">
              {formatAmount(entry.amount, entry.currency)}
            </p>
          </div>
          <p className="text-[11px] font-medium tabular-nums text-muted">
            {entry.status === "paid" && entry.paidAt
              ? `Paid ${formatDateTime(entry.paidAt)}`
              : `Completed ${formatDateTime(activityDate)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
          <ReferenceButton value={entry.reference ?? entry.bookingId} />
          <span className="font-mono text-[10px] text-muted">
            {entry.reference ? "payment reference" : "booking id"}
          </span>
        </div>
      </article>
    </li>
  );
}

/** Desktop table row for a single entry. */
function EntryRow({ entry }: { entry: TechnicianPaymentEntry }) {
  const badge = STATUS_BADGE[entry.status];

  return (
    <tr className="border-t border-border align-top transition-colors duration-150 hover:bg-surface-muted/40">
      <td className="px-4 py-3">
        <p className="max-w-56 truncate text-sm font-semibold text-heading" title={entry.serviceTitle}>
          {entry.serviceTitle}
        </p>
        <p className="mt-0.5 max-w-56 truncate font-mono text-[10px] text-muted" title={entry.bookingId}>
          {entry.bookingId.slice(0, 8)}…
        </p>
      </td>
      <td className="px-4 py-3">
        <p className="max-w-40 truncate text-sm text-foreground" title={entry.customerName ?? "Customer"}>
          {entry.customerName ?? "—"}
        </p>
      </td>
      <td className="px-4 py-3 text-sm font-bold tabular-nums text-heading">
        {formatAmount(entry.amount, entry.currency)}
      </td>
      <td className="px-4 py-3">
        <Badge label={badge.label} className={badge.className} />
      </td>
      <td className="px-4 py-3 text-xs tabular-nums text-muted">
        {entry.status === "paid" && entry.paidAt
          ? formatDateTime(entry.paidAt)
          : `Completed ${formatDateTime(entry.completedAt)}`}
      </td>
      <td className="px-4 py-3">
        {entry.reference ? (
          <ReferenceButton value={entry.reference} />
        ) : (
          <span className="text-xs text-muted">—</span>
        )}
      </td>
    </tr>
  );
}

export default function TechnicianPayments() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<TechnicianPaymentFilter>("all");
  const [reloadToken, setReloadToken] = useState(0);

  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: TechnicianPaymentsError }
    | { phase: "success"; data: TechnicianPaymentsData }
  >({ phase: "loading" });

  const isLoading = state.phase === "loading";

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetchTechnicianPayments({ page, limit: PAGE_SIZE, filter, signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        setState({ phase: "success", data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof TechnicianPaymentsError) {
          setState({ phase: "error", error });
          toast.error(error.message);
          return;
        }
        setState({
          phase: "error",
          error: new TechnicianPaymentsError(
            "server",
            "Something went wrong while loading your payments. Please try again."
          ),
        });
        toast.error("Something went wrong while loading your payments.");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, filter, reloadToken]);

  // Revalidate in the background when the window regains focus or
  // visibility — e.g. a technician returns to this tab after a platform
  // update to the shared database. Never flashes a skeleton.
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
    setState({ phase: "loading" });
    setReloadToken((token) => token + 1);
  }

  function goToPage(nextPage: number) {
    setState({ phase: "loading" });
    setPage(nextPage);
  }

  function selectFilter(nextFilter: TechnicianPaymentFilter) {
    if (nextFilter === filter) return;
    setState({ phase: "loading" });
    setFilter(nextFilter);
    setPage(1);
  }

  const summary = state.phase === "success" ? state.data.summary : null;
  const totalItems = state.phase === "success" ? state.data.pagination.totalItems : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-strong dark:text-accent">
            Your earnings
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-heading sm:text-xl">
            Settlements &amp; history
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {totalItems !== null && (
            <p aria-live="polite" className="text-xs font-medium tabular-nums text-muted sm:text-sm">
              {totalItems} {totalItems === 1 ? "entry" : "entries"}
            </p>
          )}
          <button
            type="button"
            onClick={reload}
            disabled={isLoading}
            aria-label="Refresh payments"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-border text-muted transition-colors duration-200 enabled:hover:bg-surface-muted enabled:hover:text-heading enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
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

      {summary && (
        <div className="mt-6">
          <SummaryCards summary={summary} />
        </div>
      )}

      {/* Paid / Unpaid filter */}
      <div
        role="group"
        aria-label="Filter by payment status"
        className="mt-6 inline-flex rounded-full border border-border bg-surface-muted/50 p-1"
      >
        {FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => selectFilter(option.value)}
              className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 sm:px-5 sm:text-sm ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted hover:text-heading active:text-heading"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6" aria-busy={isLoading}>
        {state.phase === "loading" && <PaymentsSkeleton />}

        {state.phase === "error" && <ErrorPanel error={state.error} onRetry={reload} />}

        {state.phase === "success" && state.data.items.length === 0 && <EmptyState filter={filter} />}

        {state.phase === "success" && state.data.items.length > 0 && (
          <>
            {/* Mobile / tablet — cards */}
            <ul className="flex flex-col gap-4 lg:hidden">
              {state.data.items.map((entry) => (
                <EntryCard key={entry.bookingId} entry={entry} />
              ))}
            </ul>

            {/* Desktop — table */}
            <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface shadow-xs lg:block">
              <table className="w-full min-w-[880px] text-left">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                    <th scope="col" className="px-4 py-3">Service</th>
                    <th scope="col" className="px-4 py-3">Customer</th>
                    <th scope="col" className="px-4 py-3">Amount</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Date</th>
                    <th scope="col" className="px-4 py-3">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.items.map((entry) => (
                    <EntryRow key={entry.bookingId} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>

            <nav
              aria-label="Payments pagination"
              className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5"
            >
              <button
                type="button"
                onClick={() => goToPage(Math.max(1, state.data.pagination.currentPage - 1))}
                disabled={!state.data.pagination.hasPrevPage || isLoading}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted enabled:active:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
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
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted enabled:active:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
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

      <p className="mt-6 text-[11px] leading-snug text-muted">
        Settlements reflect the Stripe checkout flow only. Bookings you complete
        but the customer has not paid yet are shown as unpaid until Stripe&apos;s
        verified webhook records the payment.
      </p>
    </div>
  );
}
