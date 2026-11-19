/**
 * FixMate — customer refund UI logic test (no network, no database).
 * Verifies the eligibility rules that control the refund action and the
 * dialog's trimmed reason validation. Backend re-checks all of these.
 *
 * Usage: node scripts/refund-ui-test.mjs
 */
import {
  canRequestRefund,
  getRefundReasonError,
  MAX_REFUNDS_PER_PAYMENT,
  REFUND_REASON_MAX,
  REFUND_REASON_MIN,
  refundStateLabel,
} from "../src/lib/refund-eligibility.ts";

let failures = 0;
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.log(`  FAIL  ${msg}`);
};
const check = (cond, msg) => (cond ? pass(msg) : fail(msg));

const refund = (status, amount = 50) => ({ status, amount });
const payment = (overrides = {}) => ({
  status: "succeeded",
  amount: 100,
  refunds: [],
  ...overrides,
});

console.log("Refund UI logic test\n");

console.log("[eligibility]");
check(canRequestRefund(payment()), "succeeded payment with no refunds is eligible");
check(!canRequestRefund(payment({ status: "pending" })), "pending payment is not eligible");
check(!canRequestRefund(payment({ status: "failed" })), "failed payment is not eligible");
check(!canRequestRefund(payment({ status: "expired" })), "expired payment is not eligible");
check(
  !canRequestRefund(payment({ refunds: [refund("pending")] })),
  "payment with a pending refund request is not eligible"
);
check(
  !canRequestRefund(payment({ refunds: [refund("succeeded", 100)] })),
  "fully refunded payment is not eligible"
);
check(
  canRequestRefund(payment({ refunds: [refund("succeeded", 40)] })),
  "partially refunded payment remains eligible"
);
check(
  canRequestRefund(payment({ refunds: [refund("rejected")] })) === true,
  "rejected request alone does not block a new request (backend policy mirrored)"
);
check(
  !canRequestRefund(
    payment({ refunds: Array.from({ length: MAX_REFUNDS_PER_PAYMENT }, () => refund("failed")) })
  ),
  "refund record cap is respected"
);

console.log("\n[status labels]");
check(refundStateLabel([]) === null, "no refund records -> no label");
check(refundStateLabel([refund("rejected"), refund("pending")]) === "Refund pending", "pending wins over rejected");
check(refundStateLabel([refund("succeeded")]) === "Refunded", "succeeded refund label");

console.log("\n[reason validation]");
check(getRefundReasonError("x".repeat(REFUND_REASON_MIN)) === null, "minimum length accepted");
check(getRefundReasonError("x".repeat(REFUND_REASON_MAX)) === null, "maximum length accepted");
check(getRefundReasonError("x".repeat(REFUND_REASON_MIN - 1)) !== null, "shorter reason rejected");
check(getRefundReasonError("x".repeat(REFUND_REASON_MAX + 1)) !== null, "longer reason rejected");
check(getRefundReasonError("   short   ") !== null, "validation uses trimmed length");
check(getRefundReasonError("   " + "y".repeat(REFUND_REASON_MIN) + "   ") === null, "trimmed reason at minimum is valid");

console.log(`\n${failures === 0 ? "REFUND UI CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
