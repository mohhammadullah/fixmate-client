"use client";

import { useCallback, useEffect, useState } from "react";

import ReviewCard from "@/components/reviews/ReviewCard";
import {
  fetchReviews,
  type CustomerReview,
} from "@/lib/reviews";

const PAGE_SIZE = 9;

interface ReviewsState {
  phase: "loading" | "ready" | "error";
  items: CustomerReview[];
  page: number;
  totalItems: number;
  hasMore: boolean;
}

export default function ReviewsExplorer() {
  const [state, setState] = useState<ReviewsState>({
    phase: "loading",
    items: [],
    page: 0,
    totalItems: 0,
    hasMore: false,
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Shared first-page loader used by the mount effect and the retry button.
  const loadFirstPage = useCallback(() => {
    fetchReviews(1, PAGE_SIZE)
      .then((result) => {
        if (!result.ok) {
          setState({ phase: "error", items: [], page: 0, totalItems: 0, hasMore: false });
          return;
        }
        setState({
          phase: "ready",
          items: result.data.reviews,
          page: 1,
          totalItems: result.data.pagination.totalItems,
          hasMore: result.data.pagination.hasNextPage,
        });
      })
      .catch(() =>
        setState({ phase: "error", items: [], page: 0, totalItems: 0, hasMore: false })
      );
  }, []);

  // Kick off the first load after mount; setState happens in .then callbacks.
  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  async function handleLoadMore() {
    if (isLoadingMore || state.phase !== "ready" || !state.hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = state.page + 1;
      const result = await fetchReviews(nextPage, PAGE_SIZE);
      if (!result.ok) return; // keep the current list; user can retry
      setState((current) => ({
        ...current,
        items: [...current.items, ...result.data.reviews],
        page: nextPage,
        totalItems: result.data.pagination.totalItems,
        hasMore: result.data.pagination.hasNextPage,
      }));
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (state.phase === "loading") {
    return (
      <div role="status" aria-label="Loading reviews…" className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <span className="sr-only">Loading reviews…</span>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} aria-hidden="true" className="rounded-2xl border border-border bg-surface p-6 shadow-xs">
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
    );
  }

  if (state.phase === "error") {
    return (
      <div
        role="alert"
        className="mx-auto max-w-lg rounded-2xl border border-border bg-surface p-8 text-center shadow-xs"
      >
        <span
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-error-soft text-error"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
        </span>
        <h2 className="mt-4 text-base font-bold text-heading">
          We couldn&rsquo;t load reviews
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-muted">
          Something went wrong on our side. Please try again in a moment.
        </p>
        <button
          type="button"
          onClick={() => {
            setState({ phase: "loading", items: [], page: 0, totalItems: 0, hasMore: false });
            loadFirstPage();
          }}
          className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Try again
        </button>
      </div>
    );
  }

  if (state.items.length === 0) {
    return (
      <figure className="mx-auto grid max-w-4xl overflow-hidden rounded-2xl border border-border bg-surface shadow-lg lg:grid-cols-2">
        <div
          aria-hidden="true"
          className="relative flex min-h-56 items-center justify-center overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-10 sm:min-h-72"
        >
          <div className="absolute -left-16 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-accent-500/15 blur-3xl" />
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent-400/10 blur-3xl" />
          <svg viewBox="0 0 120 120" width="150" height="150" fill="none" role="presentation" className="relative">
            <circle cx="60" cy="60" r="52" stroke="#2fb8f5" strokeWidth="1.6" strokeDasharray="5 7" opacity="0.7" />
            <circle cx="60" cy="60" r="34" stroke="#2fb8f5" strokeWidth="1.2" strokeDasharray="3 6" opacity="0.5" />
            <rect x="38" y="42" width="44" height="32" rx="6" fill="#0d1f36" stroke="#2fb8f5" strokeWidth="2" />
            <path d="M50 74l-4 9 13-9" stroke="#2fb8f5" strokeWidth="2" strokeLinejoin="round" />
            <path d="M48 54h24M48 62h14" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
          </svg>
        </div>
        <figcaption className="flex flex-col justify-center p-8 sm:p-10">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-strong dark:text-accent">
            Customer Stories
          </span>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">
            No reviews yet
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            When FixMate customers complete a repair and leave a review,
            their real experiences will appear here.
          </p>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted">
            Every review on this page comes from a genuine, completed booking —
            shared honestly, never invented.
          </p>
        </figcaption>
      </figure>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium tabular-nums text-muted" role="status">
        Showing {state.items.length} of {state.totalItems}{" "}
        {state.totalItems === 1 ? "review" : "reviews"}
      </p>

      <ul className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {state.items.map((review, index) => (
          <ReviewCard key={`${review.createdAt}-${index}`} review={review} />
        ))}
      </ul>

      <div className="mt-10 flex flex-col items-center gap-3">
        {state.hasMore && (
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            aria-busy={isLoadingMore}
            className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
          >
            {isLoadingMore ? (
              <>
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="animate-spin motion-reduce:animate-none"><circle cx="12" cy="12" r="9" strokeOpacity="0.3" /><path d="M21 12a9 9 0 0 0-9-9" /></svg>
                Loading more…
              </>
            ) : (
              <>
                Load more reviews
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
              </>
            )}
          </button>
        )}
        {!state.hasMore && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            That&rsquo;s everything — thanks for reading
          </p>
        )}
      </div>
    </div>
  );
}
