"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchAdminRefunds,
  decideRefund,
  type AdminRefund,
} from "@/lib/admin-api";
import { formatMinorUnits } from "@/lib/currency";

const STATUS_TABS = [
  { value: "pending", label: "Pending" },
  { value: "succeeded", label: "Approved" },
  { value: "failed", label: "Failed" },
  { value: "rejected", label: "Rejected" },
] as const;

const STATUS_STYLES: Record<AdminRefund["status"], string> = {
  pending: "border-warning/40 bg-warning-soft text-warning",
  succeeded: "border-success/40 bg-success-soft text-success",
  failed: "border-error/40 bg-error-soft text-error",
  rejected: "border-muted/40 bg-surface-muted text-muted",
};

export default function AdminRefunds() {
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]["value"]>("pending");
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; message: string }
    | { phase: "success"; refunds: AdminRefund[] }
  >({ phase: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async (status: string) => {
    setState({ phase: "loading" });
    try {
      const refunds = await fetchAdminRefunds(status);
      setState({ phase: "success", refunds });
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "Could not load refunds.",
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchAdminRefunds(tab)
      .then((refunds) => {
        if (cancelled) return;
        setState({ phase: "success", refunds });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          phase: "error",
          message: error instanceof Error ? error.message : "Could not load refunds.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [tab]);

  async function handleDecision(refund: AdminRefund, decision: "approve" | "reject") {
    if (busyId) return;
    setBusyId(refund.id);
    try {
      const updated = await decideRefund(refund.paymentId, refund.id, decision, notes[refund.id]);
      toast.success(
        decision === "approve"
          ? `Refund of ${formatMinorUnits(updated.amountMinor, updated.currency)} processed via Stripe.`
          : "Refund request rejected."
      );
      await load(tab);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not apply the decision.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {/* Tabs */}
      <div role="tablist" aria-label="Refund status" className="flex flex-wrap gap-2">
        {STATUS_TABS.map((entry) => {
          const active = tab === entry.value;
          return (
            <button
              key={entry.value}
              role="tab"
              aria-selected={active}
              onClick={() => {
                setState({ phase: "loading" });
                setTab(entry.value);
              }}
              className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-surface text-muted hover:bg-surface-muted hover:text-heading"
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {state.phase === "loading" ? (
        <div role="status" aria-label="Loading refunds…" className="mt-6 space-y-3">
          <span className="sr-only">Loading refunds…</span>
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-36 animate-pulse rounded-2xl border border-border bg-surface" />
          ))}
        </div>
      ) : state.phase === "error" ? (
        <div role="alert" className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-error">{state.message}</p>
          <button
            type="button"
            onClick={() => void load(tab)}
            className="mt-4 cursor-pointer rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            Try again
          </button>
        </div>
      ) : state.refunds.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border-strong bg-surface/50 p-10 text-center">
          <h2 className="text-base font-bold text-heading">No {tab} refunds</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted">
            {tab === "pending"
              ? "Refund requests awaiting review will appear here."
              : "Nothing to show for this filter yet."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
          {state.refunds.map((refund) => (
            <li
              key={refund.id}
              className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-extrabold tabular-nums text-heading">
                    {formatMinorUnits(refund.amountMinor, refund.currency)}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-muted">
                    requested {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(refund.requestedAt))}
                  </p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[refund.status]}`}>
                  {refund.status}
                </span>
              </div>

              <blockquote className="mt-3 border-l-2 border-border-strong pl-3 text-xs leading-5 text-foreground">
                {refund.reason}
              </blockquote>

              {refund.stripeRefundId && (
                <p className="mt-2 font-mono text-[10px] text-muted">Stripe ref {refund.stripeRefundId}</p>
              )}
              {refund.failureReason && (
                <p role="alert" className="mt-2 rounded-lg border border-error/40 bg-error-soft/50 px-2.5 py-1.5 text-[11px] leading-snug text-error">
                  {refund.failureReason}
                </p>
              )}
              {refund.decisionNote && (
                <p className="mt-2 text-[11px] leading-snug text-muted">Decision note: {refund.decisionNote}</p>
              )}

              {(refund.status === "pending" || refund.status === "failed") && (
                <div className="mt-4 border-t border-border pt-4">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted" htmlFor={`note-${refund.id}`}>
                    Decision note (optional)
                  </label>
                  <input
                    id={`note-${refund.id}`}
                    type="text"
                    value={notes[refund.id] ?? ""}
                    maxLength={300}
                    onChange={(event) => setNotes((current) => ({ ...current, [refund.id]: event.target.value }))}
                    placeholder="e.g. Approved after inspection, or reason for rejection…"
                    className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted focus:border-accent-500 focus:outline-none"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => handleDecision(refund, "reject")}
                      className="cursor-pointer rounded-full border border-error/40 bg-error-soft/50 px-4 py-2 text-xs font-semibold text-error transition-colors hover:bg-error-soft disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyId === refund.id ? "Working…" : "Reject"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => handleDecision(refund, "approve")}
                      className="cursor-pointer rounded-full bg-success px-5 py-2 text-xs font-semibold text-background transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyId === refund.id ? "Working…" : "Approve & refund"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
