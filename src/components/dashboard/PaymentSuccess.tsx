"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import {
  PAYMENT_STATUSES,
  type PaymentStatus,
} from "@/components/dashboard/MyBookings";
import {
  roleFromUser,
} from "@/components/dashboard/DashboardSidebar";
import {
  PAYMENT_SYNC_INTERVAL_MS,
  resolvePollDecision,
} from "@/lib/payment-sync";

/** Payment success — the redirect alone never marks anything paid. Stripe redirected the browser here; the authoritative state lives in the FixMate backend, where the Stripe webhook reconciles the payment. This screen polls the booking until its paymentStatus flips to "paid", and stays honest until then. */

const OBJECT_ID_HEX_REGEX = /^[0-9a-fA-F]{24}$/;

type SuccessState =
  | { phase: "loading" }
  | { phase: "invalid" }
  | { phase: "error"; kind: "unauthorized" | "network" | "server" | "notfound" }
  | { phase: "confirmed"; paymentStatus: PaymentStatus; finalAmount?: number }
  | { phase: "awaiting" };

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fetchAccessToken(): Promise<string | null> {
  try {
    const response = await authClient.$fetch<{ token: string }>("/token", {
      method: "GET",
    });
    if (response.error) return null;
    const data: unknown = response.data;
    if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
      return null;
    }
    return data.token;
  } catch {
    return null;
  }
}

interface BookingStatusSnapshot {
  paymentStatus: PaymentStatus;
  finalAmount?: number;
}

/** Fetches the booking the way the Booking Details screen does — the
 *  response is parsed defensively and never trusted beyond the fields we
 *  read. Throws on failure; callers decide what to render. */
async function fetchBookingPaymentState(
  bookingId: string,
  signal: AbortSignal
): Promise<BookingStatusSnapshot> {
  const token = await fetchAccessToken();
  if (!token) {
    throw new Error("unauthorized");
  }

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE}/api/bookings/${encodeURIComponent(bookingId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        signal,
      }
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("network");
  }

  if (response.status === 401) throw new Error("unauthorized");
  if (response.status === 404) throw new Error("notfound");

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON body — treated as a server error below.
  }

  if (!response.ok || !isRecord(body) || body.success !== true || !isRecord(body.data)) {
    throw new Error("server");
  }

  const data = body.data;
  const paymentStatus = data.paymentStatus;
  if (
    typeof paymentStatus !== "string" ||
    !(PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)
  ) {
    throw new Error("server");
  }

  const finalAmount =
    typeof data.finalAmount === "number" && Number.isFinite(data.finalAmount)
      ? data.finalAmount
      : undefined;

  return { paymentStatus: paymentStatus as PaymentStatus, finalAmount };
}

const amountFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function formatAmount(value: number): string {
  return amountFormatter.format(value);
}

function ConfirmationIcon() {
  return (
    <div
      aria-hidden="true"
      className="flex h-16 w-16 items-center justify-center rounded-2xl border border-success/40 bg-success-soft text-success"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-8 w-8"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
  );
}

function HourglassIcon() {
  return (
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
        <path d="M6 2h12M6 22h12M8 2v4l4 4 4-4V2M8 22v-4l4-4 4 4v4" />
      </svg>
    </div>
  );
}

export default function PaymentSuccess({
  bookingId: rawBookingId,
}: {
  bookingId?: string;
}) {
  const bookingId =
    rawBookingId && OBJECT_ID_HEX_REGEX.test(rawBookingId) ? rawBookingId : null;

  const [state, setState] = useState<SuccessState>(
    bookingId ? { phase: "loading" } : { phase: "invalid" }
  );
  const attemptsRef = useRef(0);
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const role = roleFromUser(user);

  useEffect(() => {
    if (!bookingId) return undefined;
    if (isPending) return undefined;
    if (!user) return undefined; // signed out — layout redirects
    if (role !== "customer") return undefined; // access denied is rendered below

    const controller = new AbortController();
    let cancelled = false;
    let timeout: number | undefined;

    const poll = async () => {
      attemptsRef.current += 1;
      try {
        const snapshot = await fetchBookingPaymentState(bookingId, controller.signal);
        if (cancelled) return;
        const decision = resolvePollDecision(snapshot.paymentStatus, attemptsRef.current);
        if (decision === "confirmed") {
          setState({ phase: "confirmed", paymentStatus: "paid", finalAmount: snapshot.finalAmount });
          return;
        }
        if (decision === "awaiting") {
          setState({ phase: "awaiting" });
          return;
        }
        timeout = window.setTimeout(poll, PAYMENT_SYNC_INTERVAL_MS);
      } catch (error: unknown) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "server";
        const kind =
          message === "unauthorized" || message === "notfound" || message === "network"
            ? message
            : "server";
        setState({ phase: "error", kind });
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
      controller.abort();
    };
  }, [bookingId, isPending, user, role]);

  if (isPending) {
    return (
      <div role="status" aria-label="Loading payment status…" className="space-y-4 py-4">
        <span className="sr-only">Loading payment status…</span>
        <div className="h-16 w-16 animate-pulse rounded-2xl bg-surface-muted" />
        <div className="h-6 w-64 animate-pulse rounded bg-surface-muted" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-surface-muted" />
      </div>
    );
  }

  // Signed out — the layout is redirecting; render nothing private.
  if (!user) return null;

  if (role !== "customer") {
    return (
      <div role="alert" className="rounded-2xl border border-warning/40 bg-warning-soft px-5 py-6 text-sm text-warning">
        This page confirms customer payments. Your account doesn&apos;t have customer access,
        so there is nothing to show here.
      </div>
    );
  }

  if (state.phase === "invalid") {
    return (
      <div role="alert" className="rounded-2xl border border-warning/40 bg-warning-soft px-5 py-8 text-center">
        <h2 className="text-lg font-bold text-heading">We couldn&apos;t match that payment link</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          The booking reference is missing or malformed. Your payment itself is handled by
          Stripe — check your payment history or booking details to see its real status.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard/bookings" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]">
            Go to My Bookings
          </Link>
          <Link href="/dashboard/payments" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted cursor-pointer active:bg-surface-muted">
            Payment history
          </Link>
        </div>
      </div>
    );
  }

  if (state.phase === "loading") {
    return (
      <div role="status" aria-label="Confirming your payment…" className="flex flex-col items-start gap-5 py-4">
        <span className="sr-only">Confirming your payment…</span>
        <HourglassIcon />
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-heading">
            Confirming your payment securely…
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
            Stripe has processed the transaction and is now notifying FixMate. We verify
            the payment server-side before marking your booking as paid — this usually
            takes a few seconds.
          </p>
        </div>
        <div className="h-2 w-56 animate-pulse rounded-full bg-surface-muted" aria-hidden="true" />
      </div>
    );
  }

  if (state.phase === "error") {
    const unauthorized = state.kind === "unauthorized";
    const notfound = state.kind === "notfound";
    return (
      <div role="alert" className="rounded-2xl border border-error/40 bg-error-soft/60 px-5 py-10 text-center sm:px-8">
        <h2 className="text-lg font-bold text-heading">
          {unauthorized ? "Session expired" : notfound ? "Booking not found" : "Couldn't confirm your payment"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          {unauthorized
            ? "Sign in again — then check your payment history to see the payment's real status."
            : notfound
              ? "We couldn't find this booking. Check your payment history for the payment's real status."
              : "The connection dropped before we could read your booking. Your payment itself is processed by Stripe, not lost — check your payment history to see its status."}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {unauthorized ? (
            <Link href="/sign-in" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]">
              Sign in again
            </Link>
          ) : (
            <Link href="/dashboard/payments" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]">
              Payment history
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (state.phase === "awaiting") {
    return (
      <div className="flex flex-col items-start gap-5 py-4">
        <HourglassIcon />
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-heading">
            Your payment is being confirmed
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
            Stripe processed the transaction and is notifying FixMate securely. This page
            couldn&apos;t see the confirmation yet — but nothing is marked paid until our
            server verifies the webhook from Stripe, so it may take a moment. No need to
            pay again; you can check your <Link href="/dashboard/payments" className="font-semibold text-heading underline decoration-border-strong underline-offset-4 hover:text-accent-strong dark:hover:text-accent cursor-pointer">payment history</Link> or{" "}
            <Link href={`/dashboard/bookings/${bookingId}`} className="font-semibold text-heading underline decoration-border-strong underline-offset-4 hover:text-accent-strong dark:hover:text-accent cursor-pointer">booking details</Link> anytime.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]"
          >
            Check again
          </button>
          <Link href="/dashboard/payments" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted cursor-pointer active:bg-surface-muted">
            Payment history
          </Link>
        </div>
      </div>
    );
  }

  // phase === "confirmed"
  return (
    <div className="flex flex-col items-start gap-5 py-4">
      <ConfirmationIcon />
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-heading">
          Payment confirmed
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
          {typeof state.finalAmount === "number" ? (
            <>Your payment of <span className="font-semibold tabular-nums text-heading">{formatAmount(state.finalAmount)}</span> has been received and verified server-side. </>
          ) : (
            <>Your payment has been received and verified server-side. </>
          )}
          Thank you — the booking is now marked as paid. A receipt will appear in your payment history.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={`/dashboard/bookings/${bookingId}`} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]">
          View booking
        </Link>
        <Link href="/dashboard/payments" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted cursor-pointer active:bg-surface-muted">
          Payment history
        </Link>
      </div>
    </div>
  );
}
