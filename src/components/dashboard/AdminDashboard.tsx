"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { roleFromUser } from "@/components/dashboard/DashboardSidebar";
import { API_BASE } from "@/lib/api";
import { formatMinorUnits } from "@/lib/currency";

/** Admin dashboard statistics — GET /api/admin/dashboard/stats. */

interface AdminStats {
  totalUsers: number;
  totalCustomers: number;
  totalTechnicians: number;
  totalServices: number;
  pendingServiceApprovals: number;
  approvedServices: number;
  totalBookings: number;
  requestedBookings: number;
  inProgressBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  pendingTechnicianApplications: number;
  settledPaymentRevenue: SettledPaymentRevenue[];
}

interface SettledPaymentRevenue {
  currency: string;
  succeededPayments: number;
  grossMinor: number;
  refundedMinor: number;
  netMinor: number;
}

type ErrorKind = "unauthorized" | "forbidden" | "network" | "server" | "parse";

class AdminStatsError extends Error {
  readonly kind: ErrorKind;
  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.name = "AdminStatsError";
    this.kind = kind;
  }
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRevenue(raw: unknown): SettledPaymentRevenue[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): SettledPaymentRevenue[] => {
    if (!isRecord(entry)) return [];
    const currency = entry.currency;
    const fields = ["succeededPayments", "grossMinor", "refundedMinor", "netMinor"] as const;
    if (typeof currency !== "string" || !/^[a-z]{3}$/i.test(currency)) return [];
    if (!fields.every((key) => typeof entry[key] === "number" && Number.isFinite(entry[key]))) {
      return [];
    }
    return [{
      currency: currency.toLowerCase(),
      succeededPayments: entry.succeededPayments as number,
      grossMinor: entry.grossMinor as number,
      refundedMinor: entry.refundedMinor as number,
      netMinor: entry.netMinor as number,
    }];
  });
}

async function fetchAccessToken(): Promise<string> {
  let response: { data: unknown; error: null | ({ status: number } & Record<string, unknown>) };
  try {
    response = await authClient.$fetch<{ token: string }>("/token", { method: "GET" });
  } catch {
    throw new AdminStatsError("network", "Couldn't reach the FixMate server to verify your session. Check your connection and try again.");
  }
  if (response.error) {
    if (response.error.status === 401 || response.error.status === 403) {
      throw new AdminStatsError("unauthorized", "Your session has expired. Sign in again to view admin statistics.");
    }
    throw new AdminStatsError("server", "We couldn't verify your session right now. Please try again.");
  }
  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new AdminStatsError("server", "The FixMate server returned an unexpected session-token response.");
  }
  return data.token;
}

async function fetchStats(signal: AbortSignal): Promise<AdminStats> {
  const token = await fetchAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/admin/dashboard/stats`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AdminStatsError("network", "Couldn't reach the FixMate server. Check your connection and try again.");
  }
  if (response.status === 401) throw new AdminStatsError("unauthorized", "Your session has expired. Sign in again to view admin statistics.");
  if (response.status === 403) throw new AdminStatsError("forbidden", "Admin access only. This account can't view platform statistics.");

  let body: unknown = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === "string" ? body.message : "Couldn't load dashboard statistics. Please try again.";
    throw new AdminStatsError("server", message);
  }
  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) {
    throw new AdminStatsError("parse", "The server returned an unexpected statistics payload.");
  }
  const raw = body.data;
  const numberField = (key: keyof AdminStats): number => {
    const value = raw[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  return {
    totalUsers: numberField("totalUsers"),
    totalCustomers: numberField("totalCustomers"),
    totalTechnicians: numberField("totalTechnicians"),
    totalServices: numberField("totalServices"),
    pendingServiceApprovals: numberField("pendingServiceApprovals"),
    approvedServices: numberField("approvedServices"),
    totalBookings: numberField("totalBookings"),
    requestedBookings: numberField("requestedBookings"),
    inProgressBookings: numberField("inProgressBookings"),
    completedBookings: numberField("completedBookings"),
    cancelledBookings: numberField("cancelledBookings"),
    pendingTechnicianApplications: numberField("pendingTechnicianApplications"),
    settledPaymentRevenue: parseRevenue(raw.settledPaymentRevenue),
  };
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading dashboard statistics…" className="space-y-6">
      <span className="sr-only">Loading dashboard statistics…</span>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} aria-hidden="true" className="h-28 animate-pulse rounded-2xl border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}

function AccessDenied({ role }: { role: "customer" | "technician" | null }) {
  const label = role === "customer" ? "customer" : role === "technician" ? "technician" : null;
  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-extrabold tracking-tight text-heading">Admin access only</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {label ? `You're signed in with a ${label} account.` : "Your account role isn't recognized."} The admin overview is available to administrators only.
      </p>
      <Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm cursor-pointer transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:bg-primary-hover active:scale-[0.98]">Back to your dashboard</Link>
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 shadow-xs ${accent ? "border-accent-500/40 bg-accent-50/60 dark:border-accent-400/30 dark:bg-accent-400/10" : "border-border bg-surface"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold tabular-nums tracking-tight ${accent ? "text-accent-strong dark:text-accent" : "text-heading"}`}>
        {value.toLocaleString("en")}
      </p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

const QUICK_LINKS = [
  {
    label: "User Management",
    description: "Search accounts and manage roles.",
    href: "/dashboard/admin/users",
    icon: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  },
  {
    label: "All Bookings",
    description: "Review every repair request.",
    href: "/dashboard/admin/bookings",
    icon: <rect x="3" y="4" width="18" height="17" rx="2" />,
  },
  {
    label: "Payments",
    description: "Stripe checkout records and settlement.",
    href: "/dashboard/admin/payments",
    icon: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></>,
  },
  {
    label: "Service Moderation",
    description: "Review pending service submissions.",
    href: "/dashboard/admin/services",
    icon: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  },
  {
    label: "Technician Applications",
    description: "Approve or reject applicants.",
    href: "/dashboard/admin/technician-applications",
    icon: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4" />,
  },
];

export default function AdminDashboard() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const role = roleFromUser(user);

  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: AdminStatsError }
    | { phase: "success"; stats: AdminStats }
  >({ phase: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (isPending || !user || role !== "admin") return;
    const controller = new AbortController();
    let cancelled = false;
    fetchStats(controller.signal)
      .then((stats) => { if (!cancelled) setState({ phase: "success", stats }); })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          phase: "error",
          error: error instanceof AdminStatsError
            ? error
            : new AdminStatsError("server", "Something went wrong while loading statistics. Please try again."),
        });
      });
    return () => { cancelled = true; controller.abort(); };
  }, [isPending, user, role, reloadToken]);

  if (isPending) return <Skeleton />;
  if (!user) return null;
  if (role !== "admin") {
    return <AccessDenied role={role === "customer" || role === "technician" ? role : null} />;
  }
  if (state.phase === "loading") return <Skeleton />;

  if (state.phase === "error") {
    const unauthorized = state.error.kind === "unauthorized";
    return (
      <div role="alert" className="rounded-2xl border border-error/40 bg-error-soft/60 px-5 py-10 text-center">
        <h2 className="text-lg font-bold text-heading">{unauthorized ? "Session expired" : "Couldn't load statistics"}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{state.error.message}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {unauthorized ? (
            <Link href="/sign-in" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm cursor-pointer transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:bg-primary-hover active:scale-[0.98]">Sign in again</Link>
          ) : (
            <button type="button" onClick={() => { setState({ phase: "loading" }); setReloadToken((token) => token + 1); }} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm cursor-pointer transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:bg-primary-hover active:scale-[0.98]">Try again</button>
          )}
        </div>
      </div>
    );
  }

  const stats = state.stats;
  const allEmpty =
    stats.totalUsers === 0 && stats.totalServices === 0 && stats.totalBookings === 0;

  return (
    <div className="space-y-8">
      {allEmpty && (
        <div role="status" className="rounded-2xl border border-dashed border-border-strong bg-surface-muted/30 px-5 py-8 text-center text-sm text-muted">
          No platform data yet — statistics will populate as users, services and bookings are created.
        </div>
      )}

      <section aria-labelledby="admin-overview-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="admin-overview-heading" className="text-lg font-extrabold tracking-tight text-heading">Platform overview</h2>
            <p className="mt-1 text-xs text-muted">Live counts from the FixMate database.</p>
          </div>
          <button
            type="button"
            onClick={() => { setState({ phase: "loading" }); setReloadToken((token) => token + 1); }}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted cursor-pointer active:bg-surface-muted"
          >
            Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total users" value={stats.totalUsers} hint={`${stats.totalCustomers} customers · ${stats.totalTechnicians} technicians`} accent />
          <StatCard label="Total services" value={stats.totalServices} hint={`${stats.approvedServices} approved · ${stats.pendingServiceApprovals} pending`} />
          <StatCard label="Total bookings" value={stats.totalBookings} hint={`${stats.requestedBookings} requested · ${stats.inProgressBookings} in progress`} accent />
          <StatCard label="Pending applications" value={stats.pendingTechnicianApplications} hint="Awaiting admin review" />
          <StatCard label="Pending service approvals" value={stats.pendingServiceApprovals} hint="Awaiting moderation" accent />
        </div>
      </section>

      <section aria-labelledby="booking-summary-heading">
        <h2 id="booking-summary-heading" className="text-lg font-extrabold tracking-tight text-heading">Booking status summary</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Requested" value={stats.requestedBookings} />
          <StatCard label="In progress" value={stats.inProgressBookings} />
          <StatCard label="Completed" value={stats.completedBookings} />
          <StatCard label="Cancelled" value={stats.cancelledBookings} />
        </div>
      </section>

      <section aria-labelledby="revenue-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="revenue-heading" className="text-lg font-extrabold tracking-tight text-heading">Settled revenue</h2>
            <p className="mt-1 text-xs text-muted">
              Net of completed Stripe refunds, grouped by currency. Pending and rejected requests are excluded.
            </p>
          </div>
        </div>
        {stats.settledPaymentRevenue.length === 0 ? (
          <div role="status" className="mt-4 rounded-2xl border border-dashed border-border-strong bg-surface-muted/30 px-5 py-8 text-center text-sm text-muted">
            No settled payments yet — revenue will appear here after Stripe webhooks confirm payments.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stats.settledPaymentRevenue.map((revenue) => (
              <div key={revenue.currency} className="rounded-2xl border border-accent-500/40 bg-accent-50/60 p-5 shadow-xs dark:border-accent-400/30 dark:bg-accent-400/10">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Net revenue · {revenue.currency.toUpperCase()}
                </p>
                <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight text-accent-strong dark:text-accent">
                  {formatMinorUnits(revenue.netMinor, revenue.currency)}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-muted">
                  {revenue.succeededPayments} {revenue.succeededPayments === 1 ? "settled payment" : "settled payments"}
                  {" · "}{formatMinorUnits(revenue.refundedMinor, revenue.currency)} refunded
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="quick-links-heading">
        <h2 id="quick-links-heading" className="text-lg font-extrabold tracking-tight text-heading">Quick links</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-500/40 hover:shadow-md cursor-pointer active:scale-[0.98]">
                <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent-100 bg-accent-50 text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">{link.icon}</svg>
                </span>
                <span className="mt-3 text-sm font-bold text-heading">{link.label}</span>
                <span className="mt-1 text-xs leading-snug text-muted">{link.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Payment management" className="rounded-2xl border border-border bg-surface/60 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold tracking-tight text-heading">Payments live through Stripe</h2>
            <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted">
              Every checkout settled by Stripe webhooks — amounts, statuses and references —
              is reconciled on the Payments page.
            </p>
          </div>
          <Link href="/dashboard/admin/payments" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-accent-500/40 px-5 py-2.5 text-xs font-semibold text-accent-strong transition-colors duration-200 hover:bg-surface-muted dark:text-accent cursor-pointer active:bg-surface-muted">
            Open Payments
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
