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
