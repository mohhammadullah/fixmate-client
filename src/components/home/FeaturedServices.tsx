import Link from "next/link";
import ServiceCard from "@/components/services/ServiceCard";
import { fetchNewestServices } from "@/lib/public-services";

/**
 * Featured Repair Services — real data from the existing public services
 * API (GET /api/services?limit=6&sort=newest), which only ever returns
 * approved + available services. Six cards max, each linking to the service
 * details page. No sample/fabricated services are ever inserted; failures
 * surface an honest error state.
 */

export function FeaturedServicesSkeleton() {
  return (
    <section
      id="featured-services"
      aria-labelledby="featured-services-heading"
      className="scroll-mt-24 border-t border-border"
    >
      <div className="container-page py-14 lg:py-20">
        <div className="max-w-2xl">
          <span className="h-5 w-24 animate-pulse rounded-full bg-surface-muted" />
          <span
            id="featured-services-heading"
            className="mt-4 block h-9 w-80 animate-pulse rounded-lg bg-surface-muted"
          />
          <span className="mt-3 block h-4 w-96 max-w-full animate-pulse rounded bg-surface-muted" />
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              aria-hidden="true"
              className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs"
            >
              <div className="h-48 animate-pulse bg-surface-muted" />
              <div className="space-y-3 p-5">
                <div className="h-5 w-3/4 animate-pulse rounded bg-surface-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-surface-muted" />
                <div className="flex gap-3 border-y border-border py-3">
                  <div className="h-8 w-24 animate-pulse rounded bg-surface-muted" />
                  <div className="h-8 w-24 animate-pulse rounded bg-surface-muted" />
                </div>
                <div className="h-4 w-28 animate-pulse rounded bg-surface-muted" />
              </div>
            </div>
          ))}
        </div>
        <span role="status" className="sr-only">
          Loading featured servicesâ€¦
        </span>
      </div>
    </section>
  );
}

export default async function FeaturedServices() {
  const result = await fetchNewestServices(6);

  return (
    <section
      id="featured-services"
      aria-labelledby="featured-services-heading"
      className="scroll-mt-24 border-t border-border"
    >
      <div className="container-page py-14 lg:py-20">
        {/* Section header */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent">
              Featured
            </span>
            <h2
              id="featured-services-heading"
              className="mt-4 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl"
            >
              Featured Repair Services
            </h2>
            <p className="mt-2 text-base text-muted">
              Approved, available services from verified technicians â€” with
              upfront hourly rates and genuine customer ratings.
            </p>
          </div>
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-sm font-semibold text-accent-strong transition-colors duration-200 hover:text-accent-600 dark:text-accent dark:hover:text-accent-400"
          >
            View all services
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>

        {/* Content states */}
        {!result.ok ? (
          <div
            role="alert"
            className="mx-auto mt-10 max-w-lg rounded-2xl border border-border bg-surface p-8 text-center shadow-xs"
          >
            <span
              aria-hidden="true"
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-error-soft text-error"
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16h.01" />
              </svg>
            </span>
            <h3 className="mt-4 text-base font-bold text-heading">
              We couldn&rsquo;t load featured services
            </h3>
            <p className="mt-1.5 text-sm leading-6 text-muted">
              The services list is unavailable right now. Please try again in a
              moment.
            </p>
            <Link
              href="/services"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary-hover"
            >
              Browse all services
            </Link>
          </div>
        ) : result.services.length === 0 ? (
          <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-dashed border-border-strong bg-surface/50 p-10 text-center">
            <span
              aria-hidden="true"
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50 text-accent-strong dark:bg-surface-muted dark:text-accent"
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="7" width="18" height="13" rx="2" />
                <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M12 12v3" />
              </svg>
            </span>
            <h3 className="mt-4 text-base font-bold text-heading">
              No featured services yet
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted">
              Approved services from verified technicians will appear here as
              soon as they&rsquo;re listed and available.
            </p>
            <Link
              href="/services"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary-hover"
            >
              Explore services
            </Link>
          </div>
        ) : (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.services.map((service) => (
              <li key={service._id} className="h-full">
                <ServiceCard service={service} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
