/**
 * FixMate — payment synchronization decision test.
 *
 * Verifies the pure polling state machine that powers the Stripe
 * checkout-return success page (src/lib/payment-sync.ts): the screen may
 * only declare "confirmed" when the backend — the only authority that may
 * flip a booking to paid — reports paymentStatus "paid". Until then it
 * keeps polling, and after the read budget is exhausted (webhook delayed
 * or missing) it falls back to the honest "being confirmed" state instead
 * of a false success message.
 *
 * Usage: npm run test:payment-sync
 */
import {
  PAYMENT_SYNC_MAX_ATTEMPTS,
  PAYMENT_SYNC_INTERVAL_MS,
  resolvePollDecision,
} from "../src/lib/payment-sync.ts";

let failures = 0;
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => { failures += 1; console.log(`  FAIL  ${msg}`); };
const check = (cond, msg) => (cond ? pass(msg) : fail(msg));

console.log("Payment sync decision test\n");

// A verified-paid booking is confirmed at any point in the budget.
check(resolvePollDecision("paid", 1) === "confirmed", "paid on attempt 1 -> confirmed");
check(resolvePollDecision("paid", 4) === "confirmed", "paid mid-poll -> confirmed");
check(resolvePollDecision("paid", PAYMENT_SYNC_MAX_ATTEMPTS) === "confirmed", "paid on the final attempt -> confirmed");

// Pending, refunded and unknown states poll again within budget…
check(resolvePollDecision("unpaid", 1) === "poll_again", "unpaid on attempt 1 -> poll again");
check(resolvePollDecision("unpaid", PAYMENT_SYNC_MAX_ATTEMPTS - 1) === "poll_again", "unpaid just before the budget ends -> poll again");
check(resolvePollDecision("refunded", 2) === "poll_again", "refunded state is never shown as success");
check(resolvePollDecision("whatever", 2) === "poll_again", "unknown status is never shown as success");

// …and degrade to the honest "awaiting" state once the budget is spent.
check(resolvePollDecision("unpaid", PAYMENT_SYNC_MAX_ATTEMPTS) === "awaiting", "unpaid at the attempt limit -> awaiting");
check(resolvePollDecision("unpaid", PAYMENT_SYNC_MAX_ATTEMPTS + 1) === "awaiting", "unpaid beyond the attempt limit -> awaiting");
check(resolvePollDecision("pending", PAYMENT_SYNC_MAX_ATTEMPTS) === "awaiting", "pending at the attempt limit -> awaiting");

// The success page polls on a sane cadence: ~8 reads × 3s ≈ 24s of budget.
check(PAYMENT_SYNC_MAX_ATTEMPTS === 8, "8 poll attempts");
check(PAYMENT_SYNC_INTERVAL_MS === 3000, "3s poll interval");

console.log(`\n${failures === 0 ? "PAYMENT-SYNC CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
