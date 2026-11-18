/**
 * Pure helpers for the customer review flow. Kept free of React, network
 * and DOM dependencies so they can be unit-tested from plain Node
 * (see scripts/review-ui-test.mjs). Server-side enforcement happens in the
 * backend; these exist purely to drive accessible UI state.
 */

export const REVIEW_COMMENT_MIN = 10;
export const REVIEW_COMMENT_MAX = 1000;
export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;

/** Whole-number rating in [1, 5]. */
export function isValidRating(rating: number): boolean {
  return (
    typeof rating === "number" &&
    Number.isFinite(rating) &&
    Number.isInteger(rating) &&
    rating >= REVIEW_RATING_MIN &&
    rating <= REVIEW_RATING_MAX
  );
}

/** Validation message for a review comment, or null when valid. */
export function getCommentError(comment: string): string | null {
  const trimmed = comment.trim();
  if (trimmed.length < REVIEW_COMMENT_MIN) {
    return `Comment must be at least ${REVIEW_COMMENT_MIN} characters long.`;
  }
  if (trimmed.length > REVIEW_COMMENT_MAX) {
    return `Comment must be at most ${REVIEW_COMMENT_MAX} characters long.`;
  }
  return null;
}

export type ReviewEligibility = "eligible" | "already-reviewed" | "not-completed";

/**
 * Whether the owning customer may see the review form. Mirrors the
 * server-side rule: only completed bookings without a review are
 * eligible.
 */
export function getReviewEligibility(
  status: string,
  review: { rating: number } | null | undefined,
): ReviewEligibility {
  if (status !== "completed") return "not-completed";
  if (review) return "already-reviewed";
  return "eligible";
}
