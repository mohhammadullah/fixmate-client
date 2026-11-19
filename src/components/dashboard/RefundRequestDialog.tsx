"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  requestCustomerRefund,
  RefundRequestError,
  type CustomerRefund,
} from "@/lib/payments";
import {
  getRefundReasonError,
  REFUND_REASON_MAX,
  REFUND_REASON_MIN,
} from "@/lib/refund-eligibility";

/** Customer refund-request dialog. Follows the project's existing custom
 *  dialog convention (focus trap, Escape, scroll lock, no browser alerts).
 *  Submitting only records a request for admin review — it never refunds
 *  money immediately. */

const MIN_REASON = REFUND_REASON_MIN;
const MAX_REASON = REFUND_REASON_MAX;

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

export default function RefundRequestDialog({
  paymentId,
  amount,
  currency,
  onDismiss,
  onSuccess,
}: {
  paymentId: string;
  amount: number;
  currency: string;
  onDismiss: () => void;
  onSuccess: (refund: CustomerRefund) => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const onDismissRef = useRef(onDismiss);
  const busyRef = useRef(false);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const trimmed = reason.trim();
  const validationError = getRefundReasonError(reason);
  const canSubmit = !validationError && !submitting;

  // Mount-only: focus the reason field, lock body scroll, Escape to dismiss
  // and a Tab focus trap inside the dialog.
  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    textareaRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) onDismissRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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

  async function handleSubmit() {
    if (busyRef.current || validationError) return;
    busyRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const refund = await requestCustomerRefund(paymentId, trimmed);
      toast.success("Refund request submitted. An admin will review it shortly.");
      onSuccess(refund);
    } catch (caught) {
      const message =
        caught instanceof RefundRequestError
          ? caught.message
          : "Couldn't submit the refund request. Please try again.";
      setError(message);
      toast.error(message);
      busyRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6">
      <div
        aria-hidden="true"
        onClick={() => {
          if (!busyRef.current) onDismiss();
        }}
        className="absolute inset-0 bg-navy-950/70 backdrop-blur-[2px]"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-request-title"
        aria-describedby="refund-request-description"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id="refund-request-title"
              className="text-base font-bold leading-snug text-heading"
            >
              Request a refund
            </h2>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              FixMate · Payment history
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            disabled={submitting}
            aria-label="Close dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors duration-200 enabled:hover:bg-surface-muted enabled:hover:text-heading enabled:active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <p id="refund-request-description" className="text-sm leading-relaxed text-foreground">
            This submits a refund request for admin review. It does{" "}
            <span className="font-semibold text-heading">not</span> refund money
            immediately — an administrator will approve or reject it after
            reviewing your reason.
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface-muted/40 px-4 py-3 text-xs">
            <div className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Payment</dt>
              <dd className="mt-0.5 truncate font-medium text-heading">{paymentId}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Amount</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-heading">
                {formatAmount(amount, currency)}
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <label htmlFor="refund-reason" className="text-xs font-semibold text-heading">
              Reason for your request
            </label>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              Between {MIN_REASON} and {MAX_REASON} characters.
            </p>
            <textarea
              ref={textareaRef}
              id="refund-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              maxLength={MAX_REASON}
              disabled={submitting}
              aria-invalid={Boolean(validationError && trimmed.length > 0) || undefined}
              aria-describedby="refund-reason-count"
              placeholder="Explain why you're requesting a refund…"
              className="mt-2 w-full resize-y rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-heading outline-none transition-colors placeholder:text-muted focus:border-accent-500 disabled:cursor-not-allowed disabled:opacity-70"
            />
            <p
              id="refund-reason-count"
              aria-live="polite"
              className={`mt-1 text-[11px] tabular-nums ${trimmed.length > MAX_REASON || (trimmed.length > 0 && trimmed.length < MIN_REASON) ? "text-error" : "text-muted"}`}
            >
              {trimmed.length}/{MAX_REASON} characters
            </p>
          </div>

          {error && (
            <div role="alert" className="mt-4 rounded-xl border border-error/40 bg-error-soft/60 px-4 py-3 text-xs leading-relaxed text-error">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onDismiss}
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted enabled:active:bg-surface-muted cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-live="polite"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 enabled:hover:bg-primary-hover enabled:active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && (
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" strokeOpacity="0.3" />
                <path d="M21 12a9 9 0 0 0-9-9" />
              </svg>
            )}
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </div>
      </div>
    </div>
  );
}
