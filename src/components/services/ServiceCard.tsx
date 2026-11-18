"use client";

import { useState } from "react";
import Link from "next/link";
import { initialsFor } from "@/lib/initials";

/**
 * Shared public service card — renders a real approved + available service
 * with its actual aggregated rating (computed server-side from stored
 * booking reviews) and the technician's public display name. Used by the
 * homepage Featured Repair Services grid and the /services listing so both
 * render identical, trustworthy data.
 */
export interface ServiceCardData {
  _id: string;
  title: string;
  category: string;
  location: string;
  image: string;
  hourlyRate: number;
  maxCapacity: number;
  amenities: string[];
  technicianName: string;
  rating: {
    averageRating: number | null;
    reviewCount: number;
  };
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export default function ServiceCard({ service }: { service: ServiceCardData }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = service.image.length > 0 && !imageFailed;
  const shownAmenities = service.amenities.slice(0, 3);
  const hiddenAmenities = service.amenities.length - shownAmenities.length;
  const technicianName = service.technicianName.trim() || "FixMate Technician";
  const { averageRating, reviewCount } = service.rating;
  const hasRating = reviewCount > 0 && averageRating !== null;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-500/40 hover:shadow-lg">
      <Link
        href={`/services/${service._id}`}
        aria-label={`View details for ${service.title}`}
        className="relative block h-48 w-full overflow-hidden bg-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500"
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- backend image URLs are remote and not known at build time, so next/image remotePatterns can't be configured.
          <img
            src={service.image}
            alt={service.title}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-12 w-12 text-accent-400/60"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-navy-950/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-100 backdrop-blur-sm">
          {service.category}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-bold leading-snug text-heading sm:text-lg">
          <Link
            href={`/services/${service._id}`}
            className="transition-colors duration-200 hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:hover:text-accent"
          >
            {service.title}
          </Link>
        </h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0"
          >
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="min-w-0 truncate">{service.location}</span>
        </p>

        {/* Actual rating from stored reviews — never a placeholder */}
        <p className="mt-2.5 flex items-center gap-1.5 text-xs">
          {hasRating ? (
            <>
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="currentColor"
                aria-hidden="true"
                className="h-3.5 w-3.5 text-warning"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="font-bold tabular-nums text-heading">
                {averageRating.toFixed(1)}
              </span>
              <span className="text-muted">
                ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
              </span>
            </>
          ) : (
            <span className="text-muted">No reviews yet</span>
          )}
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-3 border-y border-border py-3.5 text-xs">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Hourly rate
            </dt>
            <dd className="mt-0.5 text-sm font-bold tabular-nums text-heading">
              {formatAmount(service.hourlyRate)}
              <span className="ml-1 text-[11px] font-medium text-muted">/hr</span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Max capacity
            </dt>
            <dd className="mt-0.5 text-sm font-bold tabular-nums text-heading">
              {service.maxCapacity}
            </dd>
          </div>
        </dl>

        {service.amenities.length > 0 && (
          <ul aria-label="Amenities" className="mt-3 flex flex-wrap gap-1.5">
            {shownAmenities.map((amenity) => (
              <li
                key={amenity}
                className="rounded-full border border-border-strong bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-foreground"
              >
                {amenity}
              </li>
            ))}
            {hiddenAmenities > 0 && (
              <li
                title={service.amenities.join(", ")}
                className="rounded-full border border-border-strong bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted"
              >
                +{hiddenAmenities} more
              </li>
            )}
          </ul>
        )}

        {/* Technician — public display name only */}
        <div className="mt-3 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-800 text-[9px] font-bold tracking-wide text-accent-400 ring-1 ring-inset ring-accent-400/30 dark:bg-navy-700 dark:text-accent-400"
          >
            {initialsFor(technicianName)}
          </span>
          <span className="min-w-0">
            <span className="block text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-muted">
              Technician
            </span>
            <span className="mt-1 block truncate text-xs font-semibold text-heading">
              {technicianName}
            </span>
          </span>
        </div>

        <Link
          href={`/services/${service._id}`}
          aria-label={`View details for ${service.title}`}
          className="mt-auto inline-flex w-fit items-center gap-2 pt-5 text-xs font-semibold text-accent-strong transition-colors duration-200 hover:text-accent-600 dark:text-accent dark:hover:text-accent-400 cursor-pointer"
        >
          View Details
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-3.5 w-3.5"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </article>
  );
}
