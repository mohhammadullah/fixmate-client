"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { API_BASE } from "@/lib/api";

interface InvoiceData {
  number: string;
  issuedAt: string;
  currency: string;
  serviceAmount: number;
  discountAmount: number;
  discountCode?: string;
  taxAmount: number;
  totalAmount: number;
  paymentStatus: "unpaid" | "paid" | "refunded" | "partially_refunded";
  paidAt?: string;
  paymentReference?: string;
  customerName: string;
  customerEmail?: string;
  technicianName: string;
  serviceTitle: string;
  serviceCategory: string;
  serviceLocation: string;
  bookingReference: string;
}

export default function InvoiceView({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; message: string }
    | { phase: "success"; data: InvoiceData }
  >({ phase: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const run = async () => {
      setState({ phase: "loading" });
      try {
        const tokenResponse = await authClient.$fetch<{ token: string }>("/token", { method: "GET" });
        if (!active || controller.signal.aborted) return;
        const token = (tokenResponse.data as { token?: unknown } | null)?.token;
        if (typeof token !== "string" || !token) {
          throw new Error("Your session has expired. Sign in again.");
        }

        const response = await fetch(
          `${API_BASE}/api/bookings/${encodeURIComponent(bookingId)}/invoice`,
          {
            headers: { authorization: `Bearer ${token}`, accept: "application/json" },
            signal: controller.signal,
          }
        );
        const body = (await response.json().catch(() => null)) as {
          success?: boolean;
          data?: InvoiceData;
          message?: string;
        } | null;
        if (!active || controller.signal.aborted) return;
        if (!response.ok || !body?.success || !body.data) {
          throw new Error(body?.message ?? `Could not load the invoice (${response.status}).`);
        }
        setState({ phase: "success", data: body.data });
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          phase: "error",
          message: error instanceof Error ? error.message : "Could not load the invoice.",
        });
      }
    };

    void run();

    return () => {
      active = false;
      controller.abort();
    };
  }, [bookingId, reloadToken]);

  function load() {
    setReloadToken((token) => token + 1);
  }

  if (state.phase === "loading") {
    return (
      <div role="status" aria-label="Loading invoice…" className="mx-auto max-w-3xl p-6">
        <span className="sr-only">Loading invoice…</span>
        <div className="h-10 w-56 animate-pulse rounded bg-surface-muted" />
        <div className="mt-4 h-64 animate-pulse rounded-2xl bg-surface-muted/70" />
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
        <h1 className="text-lg font-bold text-heading">Invoice unavailable</h1>
        <p className="mt-1.5 text-sm text-muted">{state.message}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 cursor-pointer rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Try again
        </button>
      </div>
    );
  }

  const invoice = state.data;
  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: invoice.currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(value);
  const formatDate = (iso?: string) =>
    iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)) : "—";

  return (
    <div className="mx-auto max-w-3xl print:max-w-none">
      {/* Screen-only toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          FixMate Invoice
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-heading transition-colors hover:bg-surface-muted"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V2h12v7" /><path d="M6 18H3a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-3" /><rect x="6" y="14" width="12" height="8" rx="1" /></svg>
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Printable invoice sheet */}
      <article
        aria-labelledby="invoice-number"
        className="rounded-2xl border border-border bg-surface p-6 shadow-xs print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-8"
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-xl font-extrabold tracking-tight">
              <span className="text-heading">Fix</span>
              <span className="text-accent-strong dark:text-accent">Mate</span>
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Official Invoice</p>
          </div>
          <div className="text-right">
            <h1 id="invoice-number" className="font-mono text-lg font-bold text-heading">
              {invoice.number}
            </h1>
            <p className="mt-1 text-xs text-muted">Issued {formatDate(invoice.issuedAt)}</p>
            <p className="text-xs text-muted">Booking ref <span className="font-mono">{invoice.bookingReference.slice(0, 8)}…</span></p>
          </div>
        </div>

        {/* Parties */}
        <div className="grid gap-6 border-b border-border py-6 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Billed to</p>
            <p className="mt-1.5 font-bold text-heading">{invoice.customerName}</p>
            {invoice.customerEmail && <p className="text-xs text-muted">{invoice.customerEmail}</p>}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Service by</p>
            <p className="mt-1.5 font-bold text-heading">{invoice.technicianName}</p>
            <p className="text-xs text-muted">{invoice.serviceCategory} · {invoice.serviceLocation}</p>
          </div>
        </div>

        {/* Service line */}
        <div className="border-b border-border py-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Service</p>
          <p className="mt-1.5 font-semibold text-heading">{invoice.serviceTitle}</p>
        </div>

        {/* Amounts */}
        <dl className="flex flex-col gap-2 py-6 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Service amount</dt>
            <dd className="tabular-nums text-heading">{formatMoney(invoice.serviceAmount)}</dd>
          </div>
          {invoice.discountAmount > 0 && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">
                Discount{invoice.discountCode ? ` (${invoice.discountCode})` : ""}
              </dt>
              <dd className="tabular-nums text-success">−{formatMoney(invoice.discountAmount)}</dd>
            </div>
          )}
          {invoice.taxAmount > 0 && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Tax (inclusive)</dt>
              <dd className="tabular-nums text-muted">incl. {formatMoney(invoice.taxAmount)}</dd>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-4 border-t border-border pt-4">
            <dt className="text-base font-extrabold text-heading">Total {invoice.currency.toUpperCase()}</dt>
            <dd className="text-xl font-extrabold tabular-nums text-accent-strong dark:text-accent">
              {formatMoney(invoice.totalAmount)}
            </dd>
          </div>
        </dl>

        {/* Payment status */}
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Payment status</p>
              <p className={`mt-0.5 font-bold ${invoice.paymentStatus === "paid" ? "text-success" : invoice.paymentStatus === "refunded" ? "text-warning" : "text-warning"}`}>
                {invoice.paymentStatus === "paid"
                  ? "Paid"
                  : invoice.paymentStatus === "refunded"
                    ? "Refunded"
                    : invoice.paymentStatus === "partially_refunded"
                      ? "Partially refunded"
                      : "Unpaid"}
              </p>
            </div>
            <div className="text-right text-xs text-muted">
              {invoice.paidAt && (
                <p>Paid on {formatDate(invoice.paidAt)}</p>
              )}
              {invoice.paymentReference && (
                <p className="mt-0.5 font-mono">Ref {invoice.paymentReference}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[10px] leading-4 text-muted">
          This invoice was generated by FixMate from the underlying booking and payment
          records. Invoice amounts are immutable — corrections are reflected via refunds,
          never by editing this document.
        </p>
      </article>
    </div>
  );
}
