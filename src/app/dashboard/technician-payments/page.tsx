"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { roleFromUser } from "@/components/dashboard/DashboardSidebar";
import TechnicianPayments from "@/components/dashboard/TechnicianPayments";

/**
 * Technician-only Payment History page.
 *
 * The dashboard layout has already confirmed the session; this page adds
 * the technician role check. Customer/admin accounts (or unknown roles)
 * see an honest access-denied panel instead of the data — and, as always,
 * the backend remains the real authority (`verifyTechnician` on the
 * endpoint, ownership scoped to the verified JWT).
 */

function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading your payments…" className="p-4 sm:p-8">
      <span className="sr-only">Loading your payments…</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="h-24 animate-pulse rounded-2xl bg-surface-muted/70" />
        <div className="h-11 w-56 animate-pulse rounded-lg bg-surface-muted" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl bg-surface-muted/70" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl bg-surface-muted/70" />
          ))}
        </div>
      </div>
    </div>
  );
}

function AccessDenied({ role }: { role: "customer" | "admin" | null }) {
  const roleLabel = role === "customer" ? "customer" : role === "admin" ? "admin" : null;
  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
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
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      </div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-heading">
        This page is for technician accounts
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {roleLabel
          ? `You're signed in with a ${roleLabel} account, so Technician Payment History isn't available here. Your dashboard only shows the sections your role can use.`
          : "Your account's role isn't recognized, so this section isn't available. Please contact FixMate support if this looks wrong."}
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] active:bg-primary-hover"
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
        Back to your dashboard
      </Link>
    </section>
  );
}

export default function TechnicianPaymentsPage() {
  // Session atom is already resolved by the layout — this resolves instantly.
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const role = roleFromUser(user);

  if (isPending) return <PageSkeleton />;

  // Signed out — the layout is redirecting; render nothing private.
  if (!user) return null;

  // Technician-only gate. Known non-technician roles (and unknown roles)
  // are refused here; the backend enforces the same rule independently.
  if (role !== "technician") return <AccessDenied role={role} />;

  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-navy-950 text-[#dbe4ef]">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(56,189,248,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.055) 1px, transparent 1px)",
            backgroundSize: "46px 46px",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-600/20 blur-3xl"
        />
        <div className="relative px-4 py-8 sm:px-8 sm:py-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-400 sm:text-[11px]">
            Dashboard · Technician Payments
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#f2f7fd] sm:text-3xl xl:text-4xl">
            Payment{" "}
            <span className="bg-gradient-to-r from-accent-400 via-accent-500 to-accent-600 bg-clip-text text-transparent">
              History
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#a8bdd4]">
            Every settlement for your completed repairs — paid and outstanding
            amounts, per booking, with a reference for each settled payment.
          </p>
        </div>
      </section>

      <section aria-label="Your technician payments" className="px-4 py-6 sm:px-8 sm:py-8">
        <TechnicianPayments />
      </section>
    </>
  );
}
