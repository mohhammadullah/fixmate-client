import ReviewAvatar from "@/components/home/ReviewAvatar";
import type { CustomerReview } from "@/lib/reviews";

/**
 * Shared customer-review card — identical visual language everywhere
 * (homepage testimonials and the public /reviews page).
 */

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatReviewDate(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? "" : dateFormatter.format(new Date(time));
}

export function StarRating({ rating }: { rating: number }) {
  return (
    <div
      role="img"
      aria-label={`Rated ${rating} out of 5 stars`}
      className="flex items-center gap-0.5"
    >
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < rating;
        return (
          <svg
            key={index}
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill={filled ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`h-4 w-4 ${filled ? "text-warning" : "text-border-strong"}`}
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        );
      })}
    </div>
  );
}

export default function ReviewCard({ review }: { review: CustomerReview }) {
  return (
    <li className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-500/40 hover:shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <StarRating rating={review.rating} />
        <time
          dateTime={review.createdAt}
          className="text-[11px] font-medium tabular-nums text-muted"
        >
          {formatReviewDate(review.createdAt)}
        </time>
      </div>

      <blockquote className="mt-4 flex-1">
        <p className="text-sm leading-6 text-foreground">
          &ldquo;{review.comment}&rdquo;
        </p>
      </blockquote>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        <span className="text-accent-strong dark:text-accent">
          {review.service.title}
        </span>
        {" · "}Repaired by {review.technician.name}
      </p>

      <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
        <ReviewAvatar name={review.customer.name} image={review.customer.image} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-heading">
            {review.customer.name}
          </p>
          <p className="truncate text-[11px] text-muted">
            {review.service.category}
          </p>
        </div>
      </div>
    </li>
  );
}
