import Link from "next/link";
import ReviewCard from "@/components/reviews/ReviewCard";
import { fetchReviews } from "@/lib/reviews";

/**
 * What Our Customers Say — up to the 3 most recent real customer reviews
 * from the public GET /api/reviews endpoint (newest first). Every rating,
 * comment, name, date and service shown here comes from a completed
 * FixMate booking review. No placeholder testimonials are ever rendered;
 * when no reviews exist yet, an honest empty state is shown instead.
 * The full set lives on the public /reviews page.
 */

export function TestimonialsSkeleton() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="border-t border-border"
    >
      <div className="container-page py-14 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mx-auto block h-6 w-28 animate-pulse rounded-full bg-surface-muted" />
          <span
            id="testimonials-heading"
            className="mx-auto mt-4 block h-9 w-80 animate-pulse rounded-lg bg-surface-muted"
          />
          <span className="mx-auto mt-3 block h-4 w-72 animate-pulse rounded bg-surface-muted" />
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              aria-hidden="true"
              className="rounded-2xl border border-border bg-surface p-6 shadow-xs"
            >
              <div className="h-4 w-28 animate-pulse rounded bg-surface-muted" />
              <div className="mt-4 space-y-2">
                <div className="h-3.5 w-full animate-pulse rounded bg-surface-muted" />
                <div className="h-3.5 w-11/12 animate-pulse rounded bg-surface-muted" />
                <div className="h-3.5 w-4/5 animate-pulse rounded bg-surface-muted" />
              </div>
              <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
                <div className="h-11 w-11 animate-pulse rounded-full bg-surface-muted" />
                <div className="space-y-2">
                  <div className="h-3.5 w-32 animate-pulse rounded bg-surface-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <span role="status" className="sr-only">
          Loading customer reviews…
        </span>
      </div>
    </section>
  );
}

export default async function Testimonials() {
  const result = await fetchReviews(1, 3);

  return (
    <section
      aria-labelledby="testimonials-heading"
      className="border-t border-border"
    >
      <div className="container-page py-14 lg:py-20">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent">
            Testimonials
          </span>
          <h2
            id="testimonials-heading"
            className="mt-4 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl"
          >
            What Our Customers Say
          </h2>
          <p className="mt-2 text-base text-muted">
            Real reviews from customers who booked and completed repairs
            through FixMate.
          </p>
        </div>

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
              We couldn&rsquo;t load customer reviews
            </h3>
            <p className="mt-1.5 text-sm leading-6 text-muted">
              Reviews will appear here once they&rsquo;re available again.
            </p>
            <Link
              href="/reviews"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary-hover"
            >
              Browse all reviews
            </Link>
          </div>
        ) : result.data.reviews.length === 0 ? (
          /* Honest empty state — no placeholder testimonials */
          <figure className="mx-auto mt-10 grid max-w-5xl overflow-hidden rounded-2xl border border-border bg-surface shadow-lg sm:mt-12 lg:grid-cols-2">
            <div
              aria-hidden="true"
              className="relative flex min-h-56 items-center justify-center overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-10 sm:min-h-72"
            >
              <div className="absolute -left-16 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-accent-500/15 blur-3xl" />
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent-400/10 blur-3xl" />
              <svg
                viewBox="0 0 120 120"
                width="150"
                height="150"
                fill="none"
                role="presentation"
                className="relative"
              >
                <circle cx="60" cy="60" r="52" stroke="#2fb8f5" strokeWidth="1.6" strokeDasharray="5 7" opacity="0.7" />
                <circle cx="60" cy="60" r="34" stroke="#2fb8f5" strokeWidth="1.2" strokeDasharray="3 6" opacity="0.5" />
                <rect x="38" y="42" width="44" height="32" rx="6" fill="#0d1f36" stroke="#2fb8f5" strokeWidth="2" />
                <path d="M50 74l-4 9 13-9" stroke="#2fb8f5" strokeWidth="2" strokeLinejoin="round" />
                <path d="M48 54h24M48 62h14" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
              </svg>
            </div>
            <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-12">
              <span aria-hidden="true" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-strong dark:text-accent">
                Customer Stories
              </span>
              <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">
                No reviews yet
              </h3>
              <p className="mt-4 max-w-md text-base leading-7 text-muted">
                When FixMate customers complete a repair and leave a review,
                their real experiences will appear here.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/reviews"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-accent-strong transition-colors duration-200 hover:text-accent-600 dark:text-accent dark:hover:text-accent-400"
                >
                  See all reviews
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </Link>
              </div>
            </div>
          </figure>
        ) : (
          <>
            <ul className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {result.data.reviews.map((review) => (
                <ReviewCard key={`${review.createdAt}-${review.customer.name}`} review={review} />
              ))}
            </ul>

            <div className="mt-8 flex justify-center">
              <Link
                href="/reviews"
                className="inline-flex items-center gap-2 rounded-full border border-accent-500/40 bg-accent-50 px-6 py-3 text-sm font-semibold text-accent-strong shadow-xs transition-all duration-200 hover:bg-accent-100 hover:shadow-sm active:scale-[0.98] dark:border-accent-500/30 dark:bg-accent-400/10 dark:text-accent"
              >
                View All Reviews
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-4 w-4"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
