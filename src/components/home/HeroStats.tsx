import {
  BadgeCheck,
  CalendarCheck,
  CloudOff,
  Star,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { fetchHomeSummary } from "@/lib/home-api";

/**
 * Live platform statistics for the hero — computed from MongoDB on the
 * server (GET /api/home/summary, public + aggregate only). Every number is
 * real; on failure the panel degrades to an honest "unavailable" state
 * rather than ever showing invented figures.
 */

const numberFormatter = new Intl.NumberFormat("en-US");

function StatTile({
  icon: Icon,
  value,
  suffix,
  label,
  subtext,
}: {
  icon: LucideIcon;
  value: string;
  suffix?: string;
  label: string;
  subtext?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-navy-950/60 p-3.5 ring-1 ring-inset ring-white/[0.03] transition-colors duration-300 hover:border-accent-500/25 sm:p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-500/10 text-accent-400 ring-1 ring-inset ring-accent-400/25">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-extrabold leading-none tracking-tight text-white tabular-nums sm:text-[1.7rem]">
        {value}
        {suffix ? (
          <span className="ml-1 text-sm font-bold text-navy-100/45">{suffix}</span>
        ) : null}
      </p>
      <p className="mt-1.5 text-[10px] font-semibold uppercase leading-4 tracking-[0.13em] text-navy-100/60">
        {label}
      </p>
      {subtext ? (
        <p className="mt-0.5 text-[10px] font-medium tabular-nums text-navy-100/40">
          {subtext}
        </p>
      ) : null}
    </div>
  );
}

export function HeroStatsSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-md rounded-3xl border border-white/10 bg-navy-900/50 p-4 sm:p-5 lg:max-w-none"
    >
      <div className="h-4 w-40 animate-pulse rounded bg-navy-800" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-white/[0.06] bg-navy-950/60 p-3.5 sm:p-4"
          >
            <div className="h-9 w-9 animate-pulse rounded-xl bg-navy-800" />
            <div className="mt-3 h-7 w-16 animate-pulse rounded bg-navy-800" />
            <div className="mt-2 h-3 w-24 animate-pulse rounded bg-navy-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function HeroStats() {
  const result = await fetchHomeSummary();

  if (!result.ok) {
    return (
      <div
        role="alert"
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-navy-900/50 p-6 text-center lg:max-w-none"
      >
        <span
          aria-hidden="true"
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-navy-800 text-accent-400 ring-1 ring-inset ring-accent-400/20"
        >
          <CloudOff className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <p className="mt-4 text-sm font-bold text-white">
          Live platform stats are temporarily unavailable
        </p>
        <p className="mt-1.5 text-xs leading-5 text-navy-100/60">
          We keep every repair verified and every review genuine — the numbers
          will be back in a moment.
        </p>
        <Link
          href="/services"
          className="mt-4 inline-flex text-xs font-semibold text-accent-400 transition-colors hover:text-accent-500"
        >
          Browse services instead →
        </Link>
      </div>
    );
  }

  const { stats } = result;

  return (
    <div
      role="region"
      aria-label="Live platform statistics"
      className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-navy-800/60 via-navy-900/60 to-navy-950/80 p-4 shadow-[0_24px_60px_-24px_rgba(2,12,27,0.9)] ring-1 ring-inset ring-white/[0.04] sm:p-5 lg:max-w-none"
    >
      {/* Ambient glow — decorative only */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-accent-600/10 blur-3xl"
      />

      <div className="relative flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              aria-hidden="true"
              className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-60"
            />
            <span
              aria-hidden="true"
              className="relative inline-flex h-2 w-2 rounded-full bg-accent-400"
            />
          </span>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-navy-100/60">
            Live Platform Activity
          </p>
        </div>
        <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-navy-100/35">
          Real data
        </p>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile
          icon={Wrench}
          value={numberFormatter.format(stats.completedRepairs)}
          label="Completed Repairs"
          subtext="jobs delivered"
        />
        <StatTile
          icon={BadgeCheck}
          value={numberFormatter.format(stats.verifiedTechnicians)}
          label="Verified Technicians"
          subtext="approved & vetted"
        />
        <StatTile
          icon={CalendarCheck}
          value={numberFormatter.format(stats.totalBookings)}
          label="Total Bookings"
          subtext="all time"
        />
        <StatTile
          icon={Star}
          value={stats.averageRating !== null ? stats.averageRating.toFixed(1) : "—"}
          suffix={stats.averageRating !== null ? "/ 5" : undefined}
          label="Avg. Customer Rating"
          subtext={
            stats.totalReviews > 0
              ? `${numberFormatter.format(stats.totalReviews)} genuine ${
                  stats.totalReviews === 1 ? "review" : "reviews"
                }`
              : "no reviews yet"
          }
        />
      </div>
    </div>
  );
}
