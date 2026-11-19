"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { API_BASE } from "@/lib/api";
import { canRequestRefund, refundStateLabel } from "@/lib/refund-eligibility";
import {
  PAYMENT_RECORD_STATUSES,
  PaymentsError,
  isRecord,
  parsePaymentsResponse,
  type CustomerPayment,
  type PaymentsPageData,
  type PaymentRecordStatus,
} from "@/lib/payment-history";
import RefundRequestDialog from "@/components/dashboard/RefundRequestDialog";

/** Payment record lifecycle — mirrors the backend enum exactly. */
export { PAYMENT_RECORD_STATUSES };
export type { CustomerPayment, PaymentsPageData, PaymentRecordStatus };

const PAGE_SIZE = 10;

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
    throw new PaymentsError(
      "network",
      "Couldn't reach the FixMate server to verify your session. Check your connection and try again."
    );
  }

  if (response.error) {
    const status = response.error.status;
    if (status === 401 || status === 403) {
      throw new PaymentsError(
        "unauthorized",
        "Your session has expired. Sign in again to view your payments."
      );
    }
    throw new PaymentsError(
      "server",
      "We couldn't verify your session with FixMate right now. Please try again."
    );
  }

  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new PaymentsError(
      "parse",
      "The FixMate server returned an unexpected session-token response."
    );
  }
  return data.token;
}

async function fetchMyPayments(options: {
  page: number;
  limit: number;
  signal: AbortSignal;
}): Promise<PaymentsPageData> {
  const token = await fetchAccessToken();

  const params = new URLSearchParams({
    page: String(options.page),
    limit: String(options.limit),
  });

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/payments/my?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new PaymentsError(
      "network",
      "Couldn't reach the FixMate server. Check your connection and try again."
    );
  }

  if (response.status === 401) {
    throw new PaymentsError(
      "unauthorized",
      "Your session has expired. Sign in again to view your payments."
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
    throw new PaymentsError("server", message);
  }

  return parsePaymentsResponse(body);
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

function formatPaymentDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return `${dateFormatter.format(date)} · ${timeFormatter.format(date)}`;
}

/** Formats a major-unit amount with the ISO 4217 code from the API. Falls
 *  back to a plain decimal + code when the code isn't a known currency. */
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
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${className}`}
    >
      {label}
    </span>
  );
}


function PaymentsSkeleton() {
  return (
    <div role="status" aria-label="Loading your payments…" className="space-y-4">
      <span className="sr-only">Loading your payments…</span>
      <div aria-hidden="true" className="space-y-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}

function ErrorPanel({
  error,
  onRetry,
}: {
  error: PaymentsError;
  onRetry: () => void;
}) {
  const unauthorized = error.kind === "unauthorized";

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
        {unauthorized ? "Session expired" : "Couldn't load your payments"}
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
        {error.message}
      </p>
      <div className="mt-5">
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

function EmptyState() {
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
        No payments yet
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        Once you pay for a completed repair through Stripe Checkout, your
        receipts will show up here — amount, status and a link back to the
        booking.
      </p>
      <Link
        href="/dashboard/bookings"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]"
      >
        Go to My Bookings
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


function PaymentRow({
  payment,
  onRequestRefund,
}: {
  payment: CustomerPayment;
  onRequestRefund: (payment: CustomerPayment) => void;
}) {
  const isSucceeded = payment.status === "succeeded";
  const refundLabel = refundStateLabel(payment.refunds);
  const refundEligible = canRequestRefund(payment);

  return (
    <li>
      <article className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-xs transition-shadow duration-200 hover:shadow-md sm:flex-row sm:items-center sm:gap-6 sm:p-5">
        {/* Amount */}
        <div className="min-w-0 sm:w-44 sm:shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Amount
          </p>
          <p className="mt-0.5 text-2xl font-extrabold tabular-nums tracking-tight text-heading">
            {formatAmount(payment.amount, payment.currency)}
          </p>
        </div>

        {/* Reference + date */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <Badge
              label={STATUS_LABELS[payment.status]}
              className={STATUS_STYLES[payment.status]}
            />
            <p className="text-[11px] font-medium tabular-nums text-muted">
              {payment.status === "succeeded" && payment.paidAt
                ? `Paid ${formatPaymentDate(payment.paidAt)}`
                : `Opened ${formatPaymentDate(payment.createdAt)}`}
            </p>
            {refundLabel && (
              <Badge
                label={refundLabel}
                className="border-warning/40 bg-warning-soft text-warning"
              />
            )}
          </div>
          <p className="mt-2 truncate text-xs text-muted">
            Reference{" "}
            <code className="select-all rounded-md bg-surface-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
              {payment.id}
            </code>
          </p>
        </div>

        {/* Booking link */}
        <div className="shrink-0">
          <Link
            href={`/dashboard/bookings/${encodeURIComponent(payment.bookingId)}`}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-heading transition-colors duration-200 hover:border-accent-500/40 hover:bg-surface-muted cursor-pointer active:bg-surface-muted"
          >
            View booking
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-3.5 w-3.5"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          {isSucceeded && (
            <span className="sr-only">Payment succeeded</span>
          )}
          {refundEligible && (
            <button
              type="button"
              onClick={() => onRequestRefund(payment)}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted cursor-pointer active:bg-surface-muted"
            >
              Request refund
            </button>
          )}
        </div>
      </article>
    </li>
  );
}


export default function PaymentHistory() {
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [refundTarget, setRefundTarget] = useState<CustomerPayment | null>(null);

  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: PaymentsError }
    | { phase: "success"; data: PaymentsPageData }
  >({ phase: "loading" });

  const isLoading = state.phase === "loading";

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetchMyPayments({ page, limit: PAGE_SIZE, signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        setState({ phase: "success", data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof PaymentsError) {
          setState({ phase: "error", error });
          return;
        }
        setState({
          phase: "error",
          error: new PaymentsError(
            "server",
            "Something went wrong while loading your payments. Please try again."
          ),
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, reloadToken]);

  // Revalidate in the background when the window regains focus or
  // visibility — e.g. the customer returns from the Stripe Checkout tab
  // or restores this page from the back/forward cache. Keeps stale
  // "Pending" state from lingering; never flashes a skeleton.
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

  function beginLoading() {
    setState({ phase: "loading" });
  }

  function reload() {
    beginLoading();
    setReloadToken((token) => token + 1);
  }

  function goToPage(nextPage: number) {
    beginLoading();
    setPage(nextPage);
  }

  // Close only after the server confirmed the request, then re-fetch so the
  // pending state shown to the customer comes from the authoritative API.
  function handleRefundSuccess() {
    setRefundTarget(null);
    reload();
  }

  const totalItems = state.phase === "success" ? state.data.pagination.totalItems : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-strong dark:text-accent">
            Your payments
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-heading sm:text-xl">
            Receipts &amp; history
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {totalItems !== null && (
            <p aria-live="polite" className="text-xs font-medium tabular-nums text-muted sm:text-sm">
              {totalItems} {totalItems === 1 ? "payment" : "payments"}
            </p>
          )}
          <button
            type="button"
            onClick={reload}
            disabled={isLoading}
            aria-label="Refresh payments"
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

      <div className="mt-6" aria-busy={isLoading}>
        {state.phase === "loading" && <PaymentsSkeleton />}

        {state.phase === "error" && (
          <ErrorPanel error={state.error} onRetry={reload} />
        )}

        {state.phase === "success" && state.data.items.length === 0 && <EmptyState />}

        {state.phase === "success" && state.data.items.length > 0 && (
          <>
            <ul className="flex flex-col gap-4">
              {state.data.items.map((payment) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  onRequestRefund={setRefundTarget}
                />
              ))}
            </ul>

            <nav
              aria-label="Payments pagination"
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

      {refundTarget && (
        <RefundRequestDialog
          paymentId={refundTarget.id}
          amount={refundTarget.amount}
          currency={refundTarget.currency}
          onDismiss={() => setRefundTarget(null)}
          onSuccess={handleRefundSuccess}
        />
      )}
    </div>
  );
}
