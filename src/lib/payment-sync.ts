/**
 * FixMate — payment synchronization state machine.
 *
 * Pure decision logic for the post-checkout polling loop. After Stripe
 * redirects the browser back to FixMate, the redirect itself is never
 * proof of payment: the only authority that may flip a booking to "paid"
 * is the server, via a verified Stripe webhook. The success page polls
 * the booking endpoint and asks this module what to do after each read.
 * Kept free of React and the network so it is trivially testable.
 */

export const PAYMENT_SYNC_MAX_ATTEMPTS = 8;
export const PAYMENT_SYNC_INTERVAL_MS = 3000;

export type PollDecision = "confirmed" | "awaiting" | "poll_again";

/** Decide what the success screen should do after one poll round-trip.
 *  - "confirmed": the backend reports the booking as paid (webhook won).
 *  - "awaiting": the read budget is exhausted; stay honest and show the
 *    processing state instead of a false success message.
 *  - "poll_again": payment not visible yet; keep waiting for the webhook. */
export function resolvePollDecision(
  paymentStatus: string,
  attemptsMade: number,
  maxAttempts: number = PAYMENT_SYNC_MAX_ATTEMPTS
): PollDecision {
  if (paymentStatus === "paid") return "confirmed";
  return attemptsMade >= maxAttempts ? "awaiting" : "poll_again";
}
