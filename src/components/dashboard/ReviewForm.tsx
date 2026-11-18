"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  REVIEW_COMMENT_MAX,
  getCommentError,
  isValidRating,
} from "@/lib/review";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

/**
 * Customer review form for an eligible (completed, not-yet-reviewed)
 * booking. Eligibility is verified again server-side; this component only
 * ever renders for the booking owner. On success the parent refreshes the
 * booking so the submitted review replaces the form.
 */
export default function ReviewForm({
  bookingId,
  onSubmitted,
}: {
  bookingId: string;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [commentTouched, setCommentTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const commentError = getCommentError(comment);
  const starsToShow = hoveredRating ?? rating;
  const canReview = isValidRating(rating) && commentError === null;

  function handleStarKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const key = event.key;
    if (
      key === "ArrowRight" ||
      key === "ArrowUp" ||
      key === "ArrowLeft" ||
      key === "ArrowDown" ||
      key === "Home" ||
      key === "End"
    ) {
      event.preventDefault();
      setRating((current) => {
        switch (key) {
          case "ArrowRight":
          case "ArrowUp":
            return Math.min(5, current + 1);
          case "ArrowLeft":
          case "ArrowDown":
            return Math.max(1, current - 1);
          case "Home":
            return 1;
          case "End":
            return 5;
        }
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    setCommentTouched(true);
    if (!canReview || isSubmitting) return;
    setConfirming(true);
  }

  async function submitReview() {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Short-lived JWT — fetched per request, never stored or logged.
      const tokenResponse = await authClient.$fetch<{ token: string }>("/token", {
        method: "GET",
      });
      const token =
        tokenResponse.data &&
        typeof (tokenResponse.data as { token?: unknown }).token === "string"
          ? (tokenResponse.data as { token: string }).token
          : null;

      if (!token) {
        toast.error("Your session has expired. Sign in again to submit your review.");
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(
        `${API_BASE}/api/bookings/${encodeURIComponent(bookingId)}/review`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rating, comment: comment.trim() }),
        },
      );

      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      const message =
        body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string"
          ? ((body as { message: string }).message as string)
          : null;

      if (response.status === 201) {
        toast.success("Thanks! Your review has been published.");
        setConfirming(false);
        onSubmitted();
        return;
      }

      if (response.status === 409) {
        // The booking was already reviewed elsewhere — refresh so the UI
        // swaps to the existing review instead of showing a stale form.
        toast.error(message ?? "This booking has already been reviewed.");
        setConfirming(false);
        onSubmitted();
        return;
      }

      if (response.status === 401 || response.status === 403) {
        toast.error(message ?? "You are not allowed to review this booking.");
        setConfirming(false);
        setIsSubmitting(false);
        return;
      }

      if (response.status === 400) {
        const errors =
          body &&
          typeof body === "object" &&
          Array.isArray((body as { errors?: unknown }).errors)
            ? ((body as { errors: Array<{ message?: unknown }> }).errors
                .map((entry) => (typeof entry?.message === "string" ? entry.message : null))
                .filter((entry): entry is string => Boolean(entry))
                .join(" ") || null)
            : null;
        toast.error(errors ?? message ?? "Please check your review and try again.");
        setConfirming(false);
        setIsSubmitting(false);
        return;
      }

      toast.error(message ?? "Something went wrong while submitting your review. Please try again.");
      setConfirming(false);
      setIsSubmitting(false);
    } catch {
      toast.error("Couldn't reach the FixMate server. Check your connection and try again.");
      setConfirming(false);
      setIsSubmitting(false);
    }
  }

  const showCommentError = (commentTouched || submitAttempted) && commentError !== null;
  const showRatingError = submitAttempted && !isValidRating(rating);

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-2xl border border-accent-500/25 bg-accent-50/40 p-5 dark:bg-surface-muted/40 sm:p-6">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-accent-strong dark:text-accent">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="currentColor"
          aria-hidden="true"
          className="h-4 w-4"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        Rate Your Repair
      </h3>
      <p className="mt-1.5 text-xs leading-5 text-muted">
        Share an honest review of the completed repair. It will appear publicly
        with your display name.
      </p>

      {/* Star rating — radiogroup semantics with arrow-key support */}
      <div className="mt-4">
        <span id="review-rating-label" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Your rating
        </span>
        <div
          role="radiogroup"
          aria-labelledby="review-rating-label"
          onKeyDown={handleStarKeyDown}
          className="mt-1.5 flex items-center gap-1.5"
        >
          {[1, 2, 3, 4, 5].map((value) => {
            const filled = starsToShow >= value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
                tabIndex={rating === 0 ? (value === 1 ? 0 : -1) : rating === value ? 0 : -1}
                onClick={() => setRating(value)}
                onMouseEnter={() => setHoveredRating(value)}
                onMouseLeave={() => setHoveredRating(null)}
                onFocus={() => setHoveredRating(value)}
                onBlur={() => setHoveredRating(null)}
                className="cursor-pointer rounded-lg p-1 transition-transform duration-100 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 active:scale-95"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="30"
                  height="30"
                  fill={filled ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={`h-7 w-7 transition-colors duration-150 ${filled ? "text-warning" : "text-border-strong"}`}
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            );
          })}
          <span className="ml-2 text-xs font-medium tabular-nums text-muted" aria-live="polite">
            {rating > 0 ? `${rating} / 5` : "Select a rating"}
          </span>
        </div>
        {showRatingError && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-error">
            Please select a rating between 1 and 5 stars.
          </p>
        )}
      </div>

      {/* Comment */}
      <div className="mt-4">
        <label
          htmlFor="review-comment"
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted"
        >
          Your review
        </label>
        <textarea
          id="review-comment"
          name="comment"
          rows={4}
          required
          maxLength={REVIEW_COMMENT_MAX}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          onBlur={() => setCommentTouched(true)}
          placeholder="How did the repair go? Was the technician professional, punctual and fair?"
          aria-invalid={showCommentError}
          aria-describedby={showCommentError ? "review-comment-error" : "review-comment-hint"}
          className="mt-1.5 w-full resize-y rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-6 text-foreground placeholder:text-muted transition-colors duration-200 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
        />
        <div className="mt-1 flex items-center justify-between gap-3">
          {showCommentError ? (
            <p id="review-comment-error" role="alert" className="text-xs font-medium text-error">
              {commentError}
            </p>
          ) : (
            <p id="review-comment-hint" className="text-[11px] text-muted">
              Minimum 10 characters.
            </p>
          )}
          <span className="text-[11px] tabular-nums text-muted">
            {comment.length}/{REVIEW_COMMENT_MAX}
          </span>
        </div>
      </div>

      {/* Submit / inline confirmation step */}
      {!confirming ? (
        <button
          type="submit"
          className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] sm:w-auto"
        >
          Submit review
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
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4 20-7z" />
          </svg>
        </button>
      ) : (
        <div
          role="alertdialog"
          aria-label="Confirm review submission"
          className="mt-4 rounded-xl border border-warning/40 bg-warning-soft p-4"
        >
          <p className="text-sm font-semibold text-heading">Submit this review?</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Your review publishes publicly under your display name and cannot
            be edited later.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void submitReview()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary-hover disabled:cursor-wait disabled:opacity-70"
            >
              {isSubmitting ? "Submitting…" : "Confirm & submit"}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setConfirming(false)}
              className="inline-flex cursor-pointer items-center rounded-full border border-border-strong bg-surface px-5 py-2 text-xs font-semibold text-foreground transition-colors duration-200 hover:bg-surface-muted disabled:opacity-70"
            >
              Go back
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
