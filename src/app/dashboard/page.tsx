"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import {
  navItemsForRole,
  roleFromUser,
  ROLE_LABELS,
  type DashboardRole,
} from "@/components/dashboard/DashboardSidebar";

const ROLE_DESCRIPTIONS: Record<DashboardRole, string> = {
  customer:
    "Track your repair requests, follow each job from booking to fixed, and review your payment history — all in one place.",
  technician:
    "Review incoming service requests, manage the services you offer, and stay on top of the work assigned to you.",
  admin:
    "Oversee users, services, bookings and payments across the FixMate platform.",
};

const FALLBACK_DESCRIPTION =
  "Your account's role isn't recognized yet, so this workspace is limited until it's sorted out.";

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function DashboardPage() {
  // The layout gates rendering on the session, so this resolves instantly —
  // but stay defensive in case the page is ever rendered on its own.
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const role = roleFromUser(user);

  if (isPending) {
    return (
      <div role="status" aria-label="Loading your dashboard…" className="p-4 sm:p-8">
        <span className="sr-only">Loading your dashboard…</span>
        <div aria-hidden="true" className="space-y-6">
          <div className="h-44 animate-pulse rounded-2xl bg-surface-muted/70" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl bg-surface-muted/70"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Signed out — the layout is redirecting; render nothing private.
  if (!user) return null;

  const displayName = user.name?.trim() || user.email || "there";
  const description = role ? ROLE_DESCRIPTIONS[role] : FALLBACK_DESCRIPTION;
  const items = navItemsForRole(role);

  return (
    <>
      {/* ============ Welcome hero — cinematic navy band ============ */}
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
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-600/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 left-1/4 h-72 w-72 rounded-full bg-accent-400/10 blur-3xl"
        />

        <div className="relative px-4 py-10 sm:px-8 sm:py-14">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-400 sm:text-[11px]">
              FixMate Dashboard
            </p>
            {role && (
              <span className="inline-flex items-center rounded-full border border-accent-400/30 bg-accent-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-400">
                {ROLE_LABELS[role]}
              </span>
            )}
          </div>
          <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-[1.15] tracking-tight text-[#f2f7fd] sm:text-4xl xl:text-5xl">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-accent-400 via-accent-500 to-accent-600 bg-clip-text text-transparent">
              {displayName}
            </span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#a8bdd4] sm:text-base">
            {description}
          </p>
        </div>
      </section>

      {/* ============ Available navigation ============ */}
      <section aria-labelledby="dashboard-nav-heading" className="px-4 pt-8 sm:px-8 sm:pt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-strong dark:text-accent">
              Your navigation
            </p>
            <h2
              id="dashboard-nav-heading"
              className="mt-1.5 text-xl font-bold tracking-tight text-heading sm:text-2xl"
            >
              What you can do here
            </h2>
          </div>
          <p className="hidden text-xs text-muted sm:block">
            {items.length} {items.length === 1 ? "section" : "sections"} available
          </p>
        </div>

        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group flex h-full items-start gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-500/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-accent-400 ring-1 ring-inset ring-accent-400/25 transition-colors duration-200"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-heading">
                        {item.label}
                      </span>
                      <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-accent-strong dark:group-hover:text-accent" />
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted">
                      {item.description}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ============ Honest empty state ============ */}
      <section
        aria-labelledby="dashboard-empty-heading"
        className="px-4 py-8 sm:px-8 sm:py-10"
      >
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-border-strong bg-surface-muted/30 px-6 py-12 text-center sm:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-56 w-72 -translate-x-1/2 rounded-full bg-accent-500/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-900 text-accent-400 ring-1 ring-inset ring-accent-400/30"
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
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <h2
            id="dashboard-empty-heading"
            className="relative mt-6 text-xl font-bold tracking-tight text-heading sm:text-2xl"
          >
            Nothing here yet — and that&apos;s the truth
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            Your repair requests, bookings and payments will appear in this
            space once the FixMate features are connected to live data. Until
            then, this dashboard intentionally shows no statistics, bookings or
            earnings — only what&apos;s real.
          </p>
          <Link
            href="/services"
            className="relative mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md"
          >
            Explore our services
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
