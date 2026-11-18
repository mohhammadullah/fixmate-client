"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchAdminBooking, type AdminBookingDetail } from "@/lib/admin-api";
import BookingTimeline from "@/components/dashboard/BookingTimeline";

export default function AdminBookingDetails({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; message: string }
    | { phase: "success"; booking: AdminBookingDetail }
  >({ phase: "loading" });

  const load = useCallback(async () => {
    try {
      const booking = await fetchAdminBooking(bookingId);
      setState({ phase: "success", booking });
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "Could not load the booking.",
      });
    }
  }, [bookingId]);

  useEffect(() => {
    let cancelled = false;

    fetchAdminBooking(bookingId)
      .then((booking) => {
        if (cancelled) return;
        setState({ phase: "success", booking });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          phase: "error",
          message: error instanceof Error ? error.message : "Could not load the booking.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (state.phase === "loading") {
    return (
      <div role="status" aria-label="Loading booking…" className="space-y-4">
        <span className="sr-only">Loading booking…</span>
        <div className="h-36 animate-pulse rounded-2xl border border-border bg-surface" />
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm font-medium text-error">{state.message}</p>
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

  const { booking } = state;
  const timeline = booking.timeline ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Summary */}
        <section aria-labelledby="admin-booking-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <h2 id="admin-booking-heading" className="text-lg font-extrabold tracking-tight text-heading">
            {booking.service.title}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {booking.service.category}
            {booking.service.location && <> · {booking.service.location}</>}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Customer</p>
              <p className="mt-1 font-semibold text-heading">{booking.customer.name}</p>
              {booking.customer.email && <p className="text-xs text-muted">{booking.customer.email}</p>}
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Technician</p>
              <p className="mt-1 font-semibold text-heading">{booking.technician.name}</p>
              {booking.technician.email && <p className="text-xs text-muted">{booking.technician.email}</p>}
            </div>
          </div>
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-4 text-xs">
            <div><dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Status</dt><dd className="mt-0.5 font-semibold text-heading">{booking.status}</dd></div>
            <div><dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Payment</dt><dd className="mt-0.5 font-semibold text-heading">{booking.paymentStatus}</dd></div>
            <div><dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Hourly rate</dt><dd className="mt-0.5 font-semibold tabular-nums text-heading">${booking.hourlyRate}</dd></div>
            {typeof booking.finalAmount === "number" && (
              <div><dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Final amount</dt><dd className="mt-0.5 font-semibold tabular-nums text-heading">${booking.finalAmount}</dd></div>
            )}
            {booking.schedule && (
              <div><dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Appointment</dt><dd className="mt-0.5 font-semibold text-heading">{booking.schedule.date} · {booking.schedule.slotStart}–{booking.schedule.slotEnd} ({booking.schedule.timezone})</dd></div>
            )}
          </dl>
          {booking.problemDescription && (
            <p className="mt-4 whitespace-pre-line border-t border-border pt-4 text-xs leading-6 text-foreground">
              {booking.problemDescription}
            </p>
          )}
        </section>

        {/* Timeline */}
        <section aria-labelledby="admin-timeline-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <h2 id="admin-timeline-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
            Booking timeline
          </h2>
          <BookingTimeline events={timeline} />
        </section>
      </div>

      {/* Sidebar: invoice + back link */}
      <aside className="space-y-6">
        {booking.invoice && (
          <section aria-labelledby="admin-invoice-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
            <h2 id="admin-invoice-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
              Invoice
            </h2>
            <p className="mt-2 font-mono text-sm font-bold text-heading">{booking.invoice.number}</p>
            <dl className="mt-2 flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between gap-2"><dt className="text-muted">Service</dt><dd className="tabular-nums text-heading">${booking.invoice.serviceAmount.toFixed(2)}</dd></div>
              {booking.invoice.discountAmount > 0 && (
                <div className="flex items-center justify-between gap-2"><dt className="text-muted">Discount{booking.invoice.discountCode ? ` (${booking.invoice.discountCode})` : ""}</dt><dd className="tabular-nums text-success">−${booking.invoice.discountAmount.toFixed(2)}</dd></div>
              )}
              <div className="flex items-center justify-between gap-2 border-t border-border pt-2"><dt className="font-semibold text-heading">Total</dt><dd className="font-bold tabular-nums text-heading">{booking.invoice.currency.toUpperCase()} {booking.invoice.totalAmount.toFixed(2)}</dd></div>
              <div className="flex items-center justify-between gap-2"><dt className="text-muted">Status</dt><dd className="capitalize text-heading">{booking.invoice.paymentStatus.replace(/_/g, " ")}</dd></div>
            </dl>
          </section>
        )}

        <Link
          href="/dashboard/admin/bookings"
          className="inline-flex items-center gap-2 text-xs font-semibold text-accent-strong hover:text-accent-600 dark:text-accent"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
          Back to all bookings
        </Link>
      </aside>
    </div>
  );
}
