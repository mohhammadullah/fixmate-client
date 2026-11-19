import { authClient } from "@/lib/auth-client";
import { API_BASE } from "@/lib/api";

/**
 * FixMate — shared Stripe Checkout initiation.
 *
 * This is the ONLY payment-start path used by the app. It is reused by the
 * booking details screen and the My Bookings list card. The browser only
 * ever forwards the booking reference — amount, currency and identity are
 * resolved server-side from the booking record, so a tampered client can
 * never influence what is charged.
 *
 * The JWT is fetched per request cycle and never stored, logged or
 * persisted anywhere. Identity comes only from the verified JWT; no
 * client-supplied customer identity is ever sent.
 */

export type CheckoutSessionErrorKind =
  | "unauthorized"
  | "network"
  | "server"
  | "parse"
  | "conflict";

export class CheckoutSessionError extends Error {
  readonly kind: CheckoutSessionErrorKind;
  constructor(kind: CheckoutSessionErrorKind, message: string) {
    super(message);
    this.name = "CheckoutSessionError";
    this.kind = kind;
  }
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Retrieve a short-lived JWT from the Better Auth server (`/api/auth/token`,
 *  session-cookie gated). Returns the token string only. */
async function fetchAccessToken(): Promise<string> {
  let response: {
    data: unknown;
    error: null | ({ status: number } & Record<string, unknown>);
  };
  try {
    // `Res` tells the unschema'd endpoint what the 200 body looks like;
    // the shape is narrowed at runtime below regardless.
    response = await authClient.$fetch<{ token: string }>("/token", {
      method: "GET",
    });
  } catch {
    throw new CheckoutSessionError(
      "network",
      "Couldn't reach the FixMate server to verify your session. Check your connection and try again."
    );
  }

  if (response.error) {
    const status = response.error.status;
    if (status === 401 || status === 403) {
      throw new CheckoutSessionError(
        "unauthorized",
        "Your session has expired. Sign in again to pay for this booking."
      );
    }
    throw new CheckoutSessionError(
      "server",
      "We couldn't verify your session with FixMate right now. Please try again."
    );
  }

  // `data` is typed from the generic above but the endpoint lives outside
  // the typed client surface — narrow it honestly anyway.
  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new CheckoutSessionError(
      "parse",
      "The FixMate server returned an unexpected session-token response."
    );
  }
  return data.token;
}

/** POST /api/payments/checkout-session — amount is server-side (from the
 *  booking); the browser only forwards the booking reference. Returns the
 *  hosted Stripe Checkout URL to hard-navigate to. */
export async function createCheckoutSession(bookingId: string): Promise<string> {
  const token = await fetchAccessToken();

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/payments/checkout-session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      // The booking reference only — amount/currency/identity are never
      // sent from the browser.
      body: JSON.stringify({ bookingId }),
    });
  } catch {
    throw new CheckoutSessionError(
      "network",
      "Couldn't reach the payment service. Check your connection and try again."
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON body — handled by the status checks below.
  }

  const serverMessage =
    isRecord(body) && typeof body.message === "string" && body.message.length > 0 && body.message.length <= 200
      ? body.message
      : null;

  if (response.status === 401) {
    throw new CheckoutSessionError(
      "unauthorized",
      "Your session has expired. Sign in again to pay for this booking."
    );
  }

  if (response.status === 409) {
    throw new CheckoutSessionError(
      "conflict",
      serverMessage ?? "This booking can't be paid right now."
    );
  }

  if (!response.ok) {
    throw new CheckoutSessionError(
      "server",
      serverMessage ?? "Couldn't start the payment. Please try again."
    );
  }

  const data = isRecord(body) ? body.data : null;
  const url = isRecord(data) && typeof data.url === "string" ? data.url : null;

  if (!url || !url.startsWith("https://")) {
    throw new CheckoutSessionError(
      "parse",
      "The server returned an unexpected checkout response."
    );
  }

  return url;
}

/* --------------------------- Customer refunds --------------------------- */

export type RefundStatus = "pending" | "succeeded" | "failed" | "rejected";

/** Customer-safe refund view from POST /api/payments/:paymentId/refunds. */
export interface CustomerRefund {
  id: string;
  paymentId: string;
  amountMinor: number;
  amount: number;
  currency: string;
  reason: string;
  status: RefundStatus;
  requestedAt: string;
  decidedAt?: string;
  decisionNote?: string;
  failureReason?: string;
}

export type RefundRequestErrorKind =
  | "unauthorized"
  | "network"
  | "server"
  | "parse"
  | "validation"
  | "conflict"
  | "notfound";

export class RefundRequestError extends Error {
  readonly kind: RefundRequestErrorKind;
  constructor(kind: RefundRequestErrorKind, message: string) {
    super(message);
    this.name = "RefundRequestError";
    this.kind = kind;
  }
}

const REFUND_STATUSES: readonly RefundStatus[] = [
  "pending",
  "succeeded",
  "failed",
  "rejected",
];

function parseRefund(data: unknown): CustomerRefund {
  if (!isRecord(data) || typeof data.id !== "string" || !data.id) {
    throw new RefundRequestError("parse", "The server returned an unexpected refund response.");
  }
  const status = data.status;
  if (typeof status !== "string" || !REFUND_STATUSES.includes(status as RefundStatus)) {
    throw new RefundRequestError("parse", "The server returned an unexpected refund status.");
  }
  if (
    typeof data.amountMinor !== "number" ||
    !Number.isFinite(data.amountMinor) ||
    typeof data.amount !== "number" ||
    !Number.isFinite(data.amount) ||
    typeof data.currency !== "string" ||
    typeof data.reason !== "string" ||
    typeof data.paymentId !== "string" ||
    typeof data.requestedAt !== "string"
  ) {
    throw new RefundRequestError("parse", "The server returned an unexpected refund response.");
  }
  return {
    id: data.id,
    paymentId: data.paymentId,
    amountMinor: data.amountMinor,
    amount: data.amount,
    currency: data.currency,
    reason: data.reason,
    status: status as RefundStatus,
    requestedAt: data.requestedAt,
    ...(typeof data.decidedAt === "string" ? { decidedAt: data.decidedAt } : {}),
    ...(typeof data.decisionNote === "string" ? { decisionNote: data.decisionNote } : {}),
    ...(typeof data.failureReason === "string" ? { failureReason: data.failureReason } : {}),
  };
}

/** POST /api/payments/:paymentId/refunds — the customer's own succeeded
 *  payment only. The browser sends just the reason; the server computes the
 *  amount, currency, ownership and idempotency. */
export async function requestCustomerRefund(
  paymentId: string,
  reason: string
): Promise<CustomerRefund> {
  let token: string;
  try {
    token = await fetchAccessToken();
  } catch (error) {
    if (error instanceof CheckoutSessionError) {
      const kind: RefundRequestErrorKind =
        error.kind === "unauthorized" ? "unauthorized" : error.kind === "network" ? "network" : "server";
      throw new RefundRequestError(kind, error.message);
    }
    throw new RefundRequestError("network", "Couldn't verify your session. Try again.");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/payments/${encodeURIComponent(paymentId)}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ reason }),
    });
  } catch {
    throw new RefundRequestError(
      "network",
      "Couldn't reach the FixMate server. Check your connection and try again."
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON response — handled by the status checks below.
  }

  const serverMessage =
    isRecord(body) && typeof body.message === "string" && body.message.length > 0 && body.message.length <= 200
      ? body.message
      : null;

  if (response.status === 401 || response.status === 403) {
    throw new RefundRequestError("unauthorized", "Your session has expired. Sign in again.");
  }
  if (response.status === 400) {
    const issue =
      isRecord(body) && Array.isArray(body.errors) && body.errors.length > 0 && isRecord(body.errors[0])
        ? body.errors[0].message
        : null;
    throw new RefundRequestError(
      "validation",
      typeof issue === "string" && issue.length > 0 && issue.length <= 200
        ? issue
        : serverMessage ?? "Check the reason and try again."
    );
  }
  if (response.status === 404) {
    throw new RefundRequestError("notfound", serverMessage ?? "Payment not found.");
  }
  if (response.status === 409) {
    throw new RefundRequestError("conflict", serverMessage ?? "This payment can't be refunded right now.");
  }
  if (!response.ok) {
    throw new RefundRequestError("server", serverMessage ?? "Couldn't submit the refund request. Try again.");
  }

  return parseRefund(isRecord(body) ? body.data : null);
}
