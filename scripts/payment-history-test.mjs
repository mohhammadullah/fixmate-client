/**
 * FixMate payment-history contract regression test (no browser, no network).
 *
 * Reproduces the production failure: after a customer submits a refund
 * request, GET /api/payments/my returns the payment with an embedded refund
 * that carries NO `paymentId` (the customer-facing refund DTO deliberately
 * embeds the refund inside the payment and exposes only ids listed in
 * `toCustomerRefundDTO`). The customer parser must accept every legitimate
 * refund state — pending, succeeded, rejected, failed — exactly as the
 * backend defines them.
 *
 * Usage: node scripts/payment-history-test.mjs
 */
import { parsePaymentsResponse, PaymentsError } from "../src/lib/payment-history.ts";

let failures = 0;
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => { failures += 1; console.log(`  FAIL  ${msg}`); };
const check = (cond, msg) => (cond ? pass(msg) : fail(msg));

const PAYMENT = {
  id: "6a1b2c3d4e5f6a7b8c9d0e1f",
  bookingId: "6a1b2c3d4e5f6a7b8c9d0e2a",
  amount: 150,
  currency: "usd",
  status: "succeeded",
  createdAt: "2026-11-19T10:00:00.000Z",
  updatedAt: "2026-11-19T10:05:00.000Z",
  paidAt: "2026-11-19T10:05:00.000Z",
};
const PAGINATION = {
  currentPage: 1,
  limit: 10,
  totalItems: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

/** Exact shape of a pending refund embedded in GET /api/payments/my — no paymentId. */
const REFUNDS = {
  pending: {
    id: "refund0000000000000001",
    amountMinor: 15000,
    amount: 150,
    currency: "usd",
    reason: "The repair failed after a week — requesting a refund.",
    status: "pending",
    requestedAt: "2026-11-19T11:00:00.000Z",
  },
  succeeded: {
    id: "refund0000000000000002",
    amountMinor: 15000,
    amount: 150,
    currency: "usd",
    reason: "The repair failed after a week — requesting a refund.",
    status: "succeeded",
    requestedAt: "2026-11-19T11:00:00.000Z",
    decidedAt: "2026-11-19T12:00:00.000Z",
    decisionNote: "Approved — refund processed.",
  },
  rejected: {
    id: "refund0000000000000003",
    amountMinor: 15000,
    amount: 150,
    currency: "usd",
    reason: "The repair failed after a week — requesting a refund.",
    status: "rejected",
    requestedAt: "2026-11-19T11:00:00.000Z",
    decidedAt: "2026-11-19T12:00:00.000Z",
    decisionNote: "Insufficient evidence of defect.",
  },
  failed: {
    id: "refund0000000000000004",
    amountMinor: 15000,
    amount: 150,
    currency: "usd",
    reason: "The repair failed after a week — requesting a refund.",
    status: "failed",
    requestedAt: "2026-11-19T11:00:00.000Z",
    decidedAt: "2026-11-19T12:00:00.000Z",
    failureReason: "Stripe rejected the refund.",
  },
  /** Same shape, with a paymentId included (echo) — must also be accepted. */
  withPaymentId: {
    id: "refund0000000000000005",
    paymentId: "6a1b2c3d4e5f6a7b8c9d0e1f",
    amountMinor: 15000,
    amount: 150,
    currency: "usd",
    reason: "The repair failed after a week — requesting a refund.",
    status: "pending",
    requestedAt: "2026-11-19T11:00:00.000Z",
  },
};

const envelopeWith = (refunds) => ({
  success: true,
  data: [{ ...PAYMENT, ...(refunds ? { refunds: Array.isArray(refunds) ? refunds : [refunds] } : {}) }],
  pagination: { ...PAGINATION },
});

console.log("Payment history contract test\n");

console.log("[regression: refund DTO without paymentId — the production failure]");
{
  try {
    const parsed = parsePaymentsResponse(envelopeWith(REFUNDS.pending));
    const refunds = parsed.items[0]?.refunds ?? [];
    check(refunds.length === 1 && refunds[0].status === "pending", "pending refund parses (no paymentId on the wire)");
    check(refunds[0].amount === 150 && refunds[0].amountMinor === 15000, "amount fields preserved (major + minor)");
    check(refunds[0].paymentId === undefined, "missing paymentId is tolerated, not fabricated");
    check(typeof refunds[0].id === "string" && refunds[0].reason.length > 0, "id and reason preserved");
  } catch (error) {
    fail(`pending refund rejected: ${error instanceof Error ? error.message : error}`);
  }
}

console.log("\n[official refund lifecycle states all parse]");
for (const [label, refund] of Object.entries(REFUNDS)) {
  try {
    const parsed = parsePaymentsResponse(envelopeWith(refund));
    const parsedRefund = parsed.items[0]?.refunds?.[0];
    check(parsedRefund?.status === refund.status, `${label} refund (${refund.status}) parses`);
    if (refund.decidedAt) check(parsedRefund?.decidedAt === refund.decidedAt, `${label} decidedAt preserved`);
    if (refund.decisionNote) check(parsedRefund?.decisionNote === refund.decisionNote, `${label} decisionNote preserved`);
    if (refund.failureReason) check(parsedRefund?.failureReason === refund.failureReason, `${label} failureReason preserved`);
  } catch (error) {
    fail(`${label} refund rejected: ${error instanceof Error ? error.message : error}`);
  }
}

console.log("\n[happy path still parses]");
{
  try {
    const parsed = parsePaymentsResponse(envelopeWith(null));
    check(parsed.items.length === 1 && parsed.items[0].status === "succeeded", "payment without refunds parses");
    check(parsed.items[0].refunds === undefined, "absent refunds key tolerated");
    check(parsed.items[0].paidAt === PAYMENT.paidAt, "paidAt preserved");
    check(parsed.pagination.totalItems === 1 && parsed.pagination.hasNextPage === false, "pagination parses");
  } catch (error) {
    fail(`payment without refunds rejected: ${error instanceof Error ? error.message : error}`);
  }
}
{
  // Empty refunds array — a legitimate state (no records attached).
  try {
    const body = envelopeWith(null);
    body.data[0].refunds = [];
    const parsed = parsePaymentsResponse(body);
    check(parsed.items[0].refunds === undefined, "empty refunds array parses (renders as no refunds)");
  } catch (error) {
    fail(`empty refunds array rejected: ${error instanceof Error ? error.message : error}`);
  }
}

console.log("\n[malformed payloads are still rejected]");
{
  const badCases = [
    ["refund missing amountMinor", (b) => { delete b.data[0].refunds[0].amountMinor; return b; }],
    ["refund with unknown status", (b) => { b.data[0].refunds[0].status = "bogus"; return b; }],
    ["refund with non-string requestedAt", (b) => { b.data[0].refunds[0].requestedAt = 123; return b; }],
    ["refund with garbage requestedAt", (b) => { b.data[0].refunds[0].requestedAt = "not a date"; return b; }],
    ["refund with non-finite amount", (b) => { b.data[0].refunds[0].amount = Number.NaN; return b; }],
    ["missing id", (b) => { delete b.data[0].id; return b; }],
    ["bad payment status enum", (b) => { b.data[0].status = "mystery"; return b; }],
    ["refunds not an array", (b) => { b.data[0].refunds = "oops"; return b; }],
    ["pagination missing hasNextPage", (b) => { delete b.pagination.hasNextPage; return b; }],
    ["envelope without data array", (b) => { b.data = null; return b; }],
  ];
  for (const [label, mutate] of badCases) {
    const mutated = mutate(structuredClone(envelopeWith(REFUNDS.pending)));
    let threw = false;
    try {
      parsePaymentsResponse(mutated);
    } catch (error) {
      threw = error instanceof PaymentsError;
    }
    check(threw, `${label} -> rejected`);
  }
}

console.log("\n[ownership/privacy fields are not fabricated]");
{
  const parsed = parsePaymentsResponse(envelopeWith(REFUNDS.pending));
  const refund = parsed.items[0]?.refunds?.[0];
  check(!("stripeRefundId" in (refund ?? {})) && !("idempotencyKey" in (refund ?? {})) && !("decidedBy" in (refund ?? {})), "no Stripe/internal fields leak into the client model");
}

console.log(`\n${failures === 0 ? "PAYMENT-HISTORY CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
