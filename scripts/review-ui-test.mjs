/**
 * FixMate review-flow UI logic test.
 *
 * Verifies the pure eligibility/validation helpers that drive the customer
 * review form (src/lib/review.ts). The backend enforces the same rules
 * independently — these checks keep the client from offering a form the
 * server would reject, and keep client validation messages honest.
 *
 * Usage: node scripts/review-ui-test.mjs
 */
import {
  REVIEW_COMMENT_MIN,
  REVIEW_COMMENT_MAX,
  isValidRating,
  getCommentError,
  getReviewEligibility,
} from "../src/lib/review.ts";

let failures = 0;
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => { failures += 1; console.log(`  FAIL  ${msg}`); };
const check = (cond, msg) => (cond ? pass(msg) : fail(msg));

console.log("Review-flow UI logic test\n");

// --- Rating validation ---
check(isValidRating(1), "rating 1 is valid");
check(isValidRating(5), "rating 5 is valid");
check(isValidRating(3), "rating 3 is valid");
check(!isValidRating(0), "rating 0 is invalid");
check(!isValidRating(6), "rating 6 is invalid");
check(!isValidRating(3.5), "fractional rating is invalid");
check(!isValidRating(Number.NaN), "NaN rating is invalid");
check(!isValidRating(Number.POSITIVE_INFINITY), "Infinity rating is invalid");

// --- Comment validation ---
check(getCommentError("x".repeat(REVIEW_COMMENT_MIN)) === null, "comment at minimum length is valid");
check(getCommentError("x".repeat(REVIEW_COMMENT_MAX)) === null, "comment at maximum length is valid");
check(getCommentError("short") !== null, "comment below minimum is rejected");
check(getCommentError("x".repeat(REVIEW_COMMENT_MAX + 1)) !== null, "comment above maximum is rejected");
check(getCommentError("   padded but valid for sure   ") === null, "surrounding whitespace is trimmed");
check(getCommentError("         ") !== null, "whitespace-only comment is rejected");

// --- Eligibility ---
check(getReviewEligibility("completed", null) === "eligible", "completed booking without a review is eligible");
check(getReviewEligibility("completed", undefined) === "eligible", "undefined review still eligible");
check(getReviewEligibility("completed", { rating: 4 }) === "already-reviewed", "completed booking with a review is not eligible");
check(getReviewEligibility("requested", null) === "not-completed", "requested booking is not eligible");
check(getReviewEligibility("accepted", null) === "not-completed", "accepted booking is not eligible");
check(getReviewEligibility("in-progress", null) === "not-completed", "in-progress booking is not eligible");
check(getReviewEligibility("cancelled", null) === "not-completed", "cancelled booking is not eligible");
check(getReviewEligibility("rejected", null) === "not-completed", "rejected booking is not eligible");

console.log(`\n${failures === 0 ? "REVIEW UI CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
