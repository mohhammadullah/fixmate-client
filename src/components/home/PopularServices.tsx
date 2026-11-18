import Link from "next/link";
import {
  AirVent,
  ArrowRight,
  Laptop,
  Refrigerator,
  Smartphone,
  Star,
  Tv,
  WashingMachine,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { fetchPopularServices } from "@/lib/home-api";

/**
 * Popular Repair Services — the four service categories customers review the
 * most, computed from genuine MongoDB review data (GET
 * /api/home/popular-services). Ranking = most genuine reviews first, then
 * higher average rating, then category name (deterministic). No category is
 * hardcoded and no rating or count is fabricated; when fewer than four
 * eligible categories have reviews, only the real ones are shown.
 *
 * Cards carry no images — Lucide line icons keep the section compact and fast.
 */

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

interface CategoryPresentation {
  icon: LucideIcon;
  description: string;
}

const CATEGORY_PRESENTATION: Record<string, CategoryPresentation> = {
  Smartphone: { icon: Smartphone, description: "Screens, batteries & software" },
  "Laptop & PC": { icon: Laptop, description: "Computers, parts & upgrades" },
  AC: { icon: AirVent, description: "Cooling & ventilation" },
  Refrigerator: { icon: Refrigerator, description: "Fridges & freezers" },
  TV: { icon: Tv, description: "Displays & home theatre" },
  "Washing Machine": { icon: WashingMachine, description: "Washers & dryers" },
  Electrical: { icon: Zap, description: "Wiring, switches & lights" },
};

// Unmapped legacy categories that still carry genuine reviews keep their
// stored name and a neutral icon/description rather than being hidden.
const FALLBACK_PRESENTATION: CategoryPresentation = {
  icon: Wrench,
  description: "Home appliances & more",
};

function presentationFor(category: string): CategoryPresentation {
  return CATEGORY_PRESENTATION[category] ?? FALLBACK_PRESENTATION;
}

function categoryFilterHref(category: string): string {
  return `/services?category=${encodeURIComponent(category)}`;
}

/** Five stars with a clipped filled layer for fractional ratings. */
function RatingStars({ rating }: { rating: number }) {
  const clamped = Math.min(5, Math.max(0, rating));
  const stars = (filled: boolean) =>
    Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        aria-hidden="true"
        strokeWidth={1.5}
        fill={filled ? "currentColor" : "none"}
        className="h-3.5 w-3.5"
      />
    ));

  return (
    <span
      role="img"
      aria-label={`Rated ${clamped.toFixed(1)} out of 5 stars`}
      className="relative inline-flex shrink-0"
    >
      <span className="flex items-center gap-[2px] text-border-strong">
        {stars(false)}
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${(clamped / 5) * 100}%` }}
      >
        <span className="flex w-max items-center gap-[2px] text-warning">
          {stars(true)}
        </span>
      </span>
    </span>
  );
}

export function PopularServicesSkeleton() {
  return (
    <section
      aria-labelledby="popular-services-heading"
      className="border-t border-border"
    >
      <div className="container-page py-12 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="block h-5 w-36 animate-pulse rounded-full bg-surface-muted" />
            <span
              id="popular-services-heading"
              className="mt-3 block h-8 w-64 animate-pulse rounded-lg bg-surface-muted"
            />
            <span className="mt-2 block h-4 w-96 max-w-full animate-pulse rounded bg-surface-muted" />
          </div>
          <span className="h-5 w-36 animate-pulse rounded bg-surface-muted" />
        </div>
        <ul className="mt-6 grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <li
              key={index}
              aria-hidden="true"
              className="flex h-full flex-col rounded-2xl border border-border bg-surface p-4 sm:p-5"
            >
              <div className="flex items-start justify-between">
                <div className="h-11 w-11 animate-pulse rounded-xl bg-surface-muted" />
                <div className="h-4 w-4 animate-pulse rounded bg-surface-muted" />
              </div>
              <div className="mt-3 h-4 w-32 animate-pulse rounded bg-surface-muted" />
              <div className="mt-2 h-3 w-40 animate-pulse rounded bg-surface-muted" />
              <div className="mt-auto flex gap-2 pt-5">
                <div className="h-4 w-28 animate-pulse rounded bg-surface-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-surface-muted" />
              </div>
            </li>
          ))}
        </ul>
        <span role="status" className="sr-only">
          Loading popular services…
        </span>
      </div>
    </section>
  );
}

export default async function PopularServices() {
  const result = await fetchPopularServices();
  const categories = result.ok ? result.categories : [];

  return (
    <section
      aria-labelledby="popular-services-heading"
      className="border-t border-border"
    >
      <div className="container-page py-12 lg:py-16">
        {/* Section header — View All Services aligned right on desktop */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50 px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent">
              Popular Services
            </span>
            <h2
              id="popular-services-heading"
              className="mt-3 text-xl font-extrabold tracking-tight text-heading sm:text-2xl"
            >
              Popular Repair Services
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Explore our most requested repair services based on real customer
              experiences.
            </p>
          </div>
          <Link
            href="/services"
            className="group inline-flex shrink-0 items-center gap-1.5 pb-1 text-xs font-semibold text-accent-strong transition-colors duration-200 hover:text-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-accent dark:hover:text-accent-400 sm:text-sm"
          >
            View All Services
            <ArrowRight
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
              strokeWidth={2.2}
              aria-hidden="true"
            />
          </Link>
        </div>

        {!result.ok ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-border bg-surface p-6 text-center"
          >
            <p className="text-sm font-semibold text-heading">
              We couldn&rsquo;t load popular services right now.
            </p>
            <Link
              href="/services"
              className="mt-3 inline-flex text-xs font-semibold text-accent-strong hover:text-accent-600 dark:text-accent"
            >
              Browse all services
            </Link>
          </div>
        ) : categories.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border-strong bg-background/60 px-6 py-10 text-center">
            <p className="text-sm font-semibold text-heading">
              No popular services yet
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-muted">
              Categories will appear here once genuine customer reviews are in
              for approved and available services.
            </p>
            <Link
              href="/services"
              className="mt-4 inline-flex text-xs font-semibold text-accent-strong hover:text-accent-600 dark:text-accent"
            >
              Explore services
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 lg:grid-cols-4">
            {categories.map(({ category, reviewCount, averageRating }) => {
              const { icon: Icon, description } = presentationFor(category);

              return (
                <li key={category}>
                  <Link
                    href={categoryFilterHref(category)}
                    aria-label={`Browse ${category} services — rated ${averageRating.toFixed(
                      1
                    )} out of 5 from ${NUMBER_FORMAT.format(
                      reviewCount
                    )} genuine ${reviewCount === 1 ? "review" : "reviews"}`}
                    className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-4 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-accent-500/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        aria-hidden="true"
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-strong ring-1 ring-inset ring-accent-100 transition-all duration-200 group-hover:bg-accent-100 group-hover:text-accent-600 group-hover:shadow-[0_0_18px_-4px_rgba(14,165,233,0.45)] dark:bg-accent-400/10 dark:text-accent dark:ring-accent-400/20 dark:group-hover:bg-accent-400/15 dark:group-hover:text-accent-400 dark:group-hover:shadow-[0_0_18px_-4px_rgba(56,189,248,0.4)]"
                      >
                        <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={1.7} />
                      </span>
                      <ArrowRight
                        aria-hidden="true"
                        strokeWidth={2.2}
                        className="h-4 w-4 text-muted/70 transition-all duration-200 group-hover:translate-x-1 group-hover:text-accent-strong dark:group-hover:text-accent"
                      />
                    </div>

                    <h3 className="mt-3 text-sm font-bold leading-snug text-heading sm:text-[15px]">
                      {category}
                    </h3>
                    <p className="mt-1 text-[11px] leading-4 text-muted">
                      {description}
                    </p>

                    <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-4">
                      <RatingStars rating={averageRating} />
                      <span className="text-xs font-extrabold tabular-nums text-heading">
                        {averageRating.toFixed(1)}
                      </span>
                      <span className="text-[11px] font-medium tabular-nums text-muted">
                        · {NUMBER_FORMAT.format(reviewCount)}{" "}
                        {reviewCount === 1 ? "review" : "reviews"}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
