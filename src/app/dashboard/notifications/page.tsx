"use client";

import { authClient } from "@/lib/auth-client";
import { roleFromUser } from "@/components/dashboard/DashboardSidebar";
import NotificationCenter from "@/components/dashboard/NotificationCenter";

export default function NotificationsPage() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div role="status" aria-label="Loading…" className="p-8">
        <span className="sr-only">Loading…</span>
        <div className="mx-auto h-8 w-48 animate-pulse rounded bg-surface-muted" />
      </div>
    );
  }

  if (!session?.user) return null; // dashboard layout redirects

  const role = roleFromUser(session.user);

  return (
    <>
      {/* Navy page banner — matches dashboard page convention */}
      <section className="relative overflow-hidden border-b border-border bg-navy-950">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-500/15 blur-3xl"
        />
        <div className="container-page py-8 lg:py-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-400">
            Account
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#f2f7fd] sm:text-3xl">
            Notifications
          </h1>
          <p className="mt-1.5 max-w-lg text-sm leading-6 text-slate-300">
            Booking updates, payment confirmations, refund decisions and repair
            progress — all in one place.
          </p>
          {role && (
            <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-slate-400">
              {role === "customer" ? "Customer" : role === "technician" ? "Technician" : "Administrator"} workspace
            </p>
          )}
        </div>
      </section>

      <div className="container-page py-8">
        <NotificationCenter />
      </div>
    </>
  );
}
