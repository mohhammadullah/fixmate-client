"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { roleFromUser, type DashboardRole } from "@/components/dashboard/DashboardSidebar";

/**
 * Client-side role guard mirroring the server-side middleware. Used by
 * dashboard pages that are technician/admin/customer only. Security lives
 * on the API; this is UX-level access control.
 */
export function RoleGate({
  role,
  children,
}: {
  role: DashboardRole;
  children: ReactNode;
}) {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const currentRole = roleFromUser(user);

  if (isPending) {
    return (
      <div role="status" aria-label="Loading…" className="space-y-4">
        <span className="sr-only">Loading…</span>
        <div className="h-24 animate-pulse rounded-2xl bg-surface-muted/70" />
        <div className="h-40 animate-pulse rounded-2xl bg-surface-muted/60" />
      </div>
    );
  }

  if (!user) return null; // dashboard layout redirects signed-out users

  if (currentRole !== role) {
    const label = role === "technician" ? "technician" : role === "admin" ? "admin" : "customer";
    return (
      <section className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
        <div aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl border border-warning/40 bg-warning-soft text-warning">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
        </div>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-heading">This page is for {label} accounts</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Your account doesn&apos;t have access to this section. The FixMate server enforces the same rule independently.
        </p>
        <Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
          Back to your dashboard
        </Link>
      </section>
    );
  }

  return <>{children}</>;
}
