/**
 * FixMate — customer refund-request eligibility (pure decision logic).
 *
 * Mirrors the backend's requestRefund rules using ONLY data the customer API
 * actually returns (GET /api/payments/my -> PaymentDTO.refunds). It decides
 * when to offer the request action; the server always re-checks and remains
 * the authority. Kept free of React/network so it can be unit-tested.
 */

export const MAX_REFUNDS_PER_PAYMENT = 10;
export const REFUND_REASON_MIN = 10;
export const REFUND_REASON_MAX = 500;

/** Trimmed reason validation shared by the dialog and its tests. */
export function getRefundReasonError(reason: string): string | null {
  const length = reason.trim().length;
  if (length < REFUND_REASON_MIN) {
    return `Please enter at least ${REFUND_REASON_MIN} characters (${length}/${REFUND_REASON_MIN}).`;
  }
  if (length > REFUND_REASON_MAX) {
    return `Please use at most ${REFUND_REASON_MAX} characters (${length}/${REFUND_REASON_MAX}).`;
  }
  return null;
}

export interface RefundLike {
  status: string;
  /** Major currency units (same convention as PaymentDTO.amount). */
  amount: number;
}

export interface PaymentForRefundEligibility {
  status: string;
  /** Major currency units. */
  amount: number;
  refunds?: RefundLike[];
}

export function canRequestRefund(payment: PaymentForRefundEligibility): boolean {
  if (payment.status !== "succeeded") return false;

  const refunds = payment.refunds ?? [];
  // One pending request per payment (409 on the backend).
  if (refunds.some((refund) => refund.status === "pending")) return false;

  // Fully refunded payments cannot be requested again.
  const refunded = refunds
    .filter((refund) => refund.status === "succeeded")
    .reduce((sum, refund) => sum + refund.amount, 0);
  if (refunded >= payment.amount) return false;

  // Backend counts every record that is not "rejected" toward the cap.
  if (refunds.filter((refund) => refund.status !== "rejected").length >= MAX_REFUNDS_PER_PAYMENT) {
    return false;
  }

  return true;
}

export const REFUND_STATE_LABELS: Record<string, string> = {
  pending: "Refund pending",
  succeeded: "Refunded",
  failed: "Refund failed",
  rejected: "Refund request rejected",
};

/** Highest-priority refund state to surface on a payment row, if any. */
export function refundStateLabel(
  refunds: readonly RefundLike[] | undefined
): string | null {
  if (!refunds || refunds.length === 0) return null;
  const priority = ["pending", "succeeded", "failed", "rejected"];
  for (const status of priority) {
    if (refunds.some((refund) => refund.status === status)) {
      return REFUND_STATE_LABELS[status];
    }
  }
  return null;
}
