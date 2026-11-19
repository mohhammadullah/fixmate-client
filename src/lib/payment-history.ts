/**
 * FixMate — customer payment-history contract parsing (pure, no React/network).
 *
 * Mirrors the actual GET /api/payments/my response (verifyToken +
 * verifyCustomer): { success, data, pagination }, with Mongo dates serialized
 * as strings; `amount` is in major currency units; `currency` is lowercase
 * ISO 4217; Stripe internals (session ids, checkout URLs, refund ids, coupon
 * secrets) are never returned by this customer-facing API.
 *
 * Embedded customer refunds (the `refunds` array on a payment) are NOT
 * guaranteed to carry `paymentId` — the refund lives inside the payment
 * document, and the customer-facing DTO deliberately exposes ids only for
 * inclusions listed in the backend's `toCustomerRefundDTO`. `paymentId` is
 * passed through when present (e.g. submission echoes), never required.
 */

export const PAYMENT_RECORD_STATUSES = [
  "pending",
  "succeeded",
  "failed",
  "expired",
] as const;
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

export const REFUND_STATUSES = ["pending", "succeeded", "failed", "rejected"] as const;
export type RefundRecordStatus = (typeof REFUND_STATUSES)[number];

/** Customer-safe refund shape as embedded in GET /api/payments/my. */
export interface CustomerHistoryRefund {
  id: string;
  /** Present only when the server includes it — never required. */
  paymentId?: string;
  amountMinor: number;
  amount: number;
  currency: string;
  reason: string;
  status: RefundRecordStatus;
  requestedAt: string;
  decidedAt?: string;
  decisionNote?: string;
  failureReason?: string;
}

export interface CustomerPayment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentRecordStatus;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  /** Customer-safe refund records from the payment API, when any exist. */
  refunds?: CustomerHistoryRefund[];
}

export interface PaymentsPagination {
  currentPage: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaymentsPageData {
  items: CustomerPayment[];
  pagination: PaymentsPagination;
}

export type PaymentsErrorKind = "unauthorized" | "network" | "server" | "parse";

export class PaymentsError extends Error {
  readonly kind: PaymentsErrorKind;
  constructor(kind: PaymentsErrorKind, message: string) {
    super(message);
    this.name = "PaymentsError";
    this.kind = kind;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new PaymentsError("parse", "The server returned an unexpected payment payload.");
  }
  return value;
}

function requiredFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PaymentsError("parse", "The server returned an unexpected payment payload.");
  }
  return value;
}

function requiredEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[]
): T {
  const value = record[key];
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new PaymentsError("parse", "The server returned an unknown value in a payment field.");
  }
  return value as T;
}

/** Parses one customer-safe refund object embedded in GET /api/payments/my.
 *  Accepts every legitimate refund state/shape the backend produces:
 *  pending (id, amount, amountMinor, currency, reason, status, requestedAt),
 *  succeeded/rejected/failed (plus decidedAt / decisionNote / failureReason).
 *  `paymentId` is passed through when present — it is NOT required. */
export function parseRefund(raw: unknown): CustomerHistoryRefund {
  if (!isRecord(raw)) {
    throw new PaymentsError("parse", "The server returned an unexpected refund payload.");
  }
  const status = raw.status;
  if (
    typeof status !== "string" ||
    !(REFUND_STATUSES as readonly string[]).includes(status) ||
    typeof raw.id !== "string" ||
    raw.id.length === 0 ||
    typeof raw.amount !== "number" ||
    !Number.isFinite(raw.amount) ||
    typeof raw.amountMinor !== "number" ||
    !Number.isFinite(raw.amountMinor) ||
    typeof raw.currency !== "string" ||
    raw.currency.length === 0 ||
    typeof raw.reason !== "string" ||
    typeof raw.requestedAt !== "string" ||
    Number.isNaN(Date.parse(raw.requestedAt))
  ) {
    throw new PaymentsError("parse", "The server returned an unexpected refund payload.");
  }
  return {
    id: raw.id,
    // Echoed when the server includes it — never required by the contract.
    ...(typeof raw.paymentId === "string" && raw.paymentId.length > 0 ? { paymentId: raw.paymentId } : {}),
    amount: raw.amount,
    amountMinor: raw.amountMinor,
    currency: raw.currency,
    reason: raw.reason,
    requestedAt: raw.requestedAt,
    status: status as CustomerHistoryRefund["status"],
    ...(typeof raw.decidedAt === "string" && !Number.isNaN(Date.parse(raw.decidedAt)) ? { decidedAt: raw.decidedAt } : {}),
    ...(typeof raw.decisionNote === "string" ? { decisionNote: raw.decisionNote } : {}),
    ...(typeof raw.failureReason === "string" ? { failureReason: raw.failureReason } : {}),
  };
}

export function parsePayment(raw: unknown): CustomerPayment {
  if (!isRecord(raw)) {
    throw new PaymentsError("parse", "The server returned an unexpected payment payload.");
  }

  const paidAt = raw.paidAt;
  if (paidAt !== undefined && paidAt !== null && typeof paidAt !== "string") {
    throw new PaymentsError("parse", "The server returned an unexpected payment payload.");
  }
  if (raw.refunds !== undefined && !Array.isArray(raw.refunds)) {
    throw new PaymentsError("parse", "The server returned an unexpected refund payload.");
  }

  return {
    id: requiredString(raw, "id"),
    bookingId: requiredString(raw, "bookingId"),
    amount: requiredFiniteNumber(raw, "amount"),
    currency: requiredString(raw, "currency").toLowerCase(),
    status: requiredEnum(raw, "status", PAYMENT_RECORD_STATUSES),
    createdAt: requiredString(raw, "createdAt"),
    updatedAt: requiredString(raw, "updatedAt"),
    ...(typeof paidAt === "string" ? { paidAt } : {}),
    ...(Array.isArray(raw.refunds) && raw.refunds.length > 0
      ? { refunds: raw.refunds.map(parseRefund) }
      : {}),
  };
}

export function parsePagination(raw: unknown): PaymentsPagination {
  if (!isRecord(raw)) {
    throw new PaymentsError("parse", "The server returned an unexpected pagination payload.");
  }
  const currentPage = requiredFiniteNumber(raw, "currentPage");
  const limit = requiredFiniteNumber(raw, "limit");
  const totalItems = requiredFiniteNumber(raw, "totalItems");
  const totalPages = requiredFiniteNumber(raw, "totalPages");
  if (typeof raw.hasNextPage !== "boolean" || typeof raw.hasPrevPage !== "boolean") {
    throw new PaymentsError("parse", "The server returned an unexpected pagination payload.");
  }
  return {
    currentPage,
    limit,
    totalItems,
    totalPages,
    hasNextPage: raw.hasNextPage,
    hasPrevPage: raw.hasPrevPage,
  };
}

export function parsePaymentsResponse(body: unknown): PaymentsPageData {
  if (!isRecord(body)) {
    throw new PaymentsError("parse", "The server returned an unexpected response.");
  }
  if (body.success !== true) {
    const message =
      typeof body.message === "string" && body.message.length > 0 && body.message.length <= 200
        ? body.message
        : "The server couldn't load your payments.";
    throw new PaymentsError("server", message);
  }
  if (!Array.isArray(body.data)) {
    throw new PaymentsError("parse", "The server returned an unexpected payments payload.");
  }
  return {
    items: body.data.map(parsePayment),
    pagination: parsePagination(body.pagination),
  };
}
