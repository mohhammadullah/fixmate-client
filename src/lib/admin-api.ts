"use client";

import { API_BASE } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

/** Shared helpers for the admin dashboards — JWT fetched per request. */

async function fetchAccessToken(): Promise<string> {
  const response = await authClient.$fetch<{ token: string }>("/token", {
    method: "GET",
  });
  const token = (response.data as { token?: unknown } | null)?.token;
  if (typeof token !== "string" || !token) {
    throw new Error("Your session has expired. Sign in again.");
  }
  return token;
}

export async function adminRequest<T>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {}
): Promise<T> {
  const token = await fetchAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message =
      body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string"
        ? ((body as { message: string }).message as string)
        : `Request failed (${response.status}).`;
    throw new AdminRequestError(response.status, message, body);
  }
  return body as T;
}

export class AdminRequestError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "AdminRequestError";
    this.status = status;
    this.body = body;
  }
}

/* ------------------------------- Refunds -------------------------------- */

export interface AdminRefund {
  id: string;
  paymentId: string;
  amountMinor: number;
  amount: number;
  currency: string;
  reason: string;
  status: "pending" | "succeeded" | "failed" | "rejected";
  stripeRefundId?: string;
  requestedAt: string;
  decidedAt?: string;
  decisionNote?: string;
  failureReason?: string;
  paymentStatus?: string;
  paymentAmount?: number;
}

export async function fetchAdminRefunds(status: string): Promise<AdminRefund[]> {
  const body = await adminRequest<{ data: AdminRefund[] }>(`/api/admin/refunds?status=${encodeURIComponent(status)}`);
  return body.data;
}

export async function decideRefund(
  paymentId: string,
  refundId: string,
  decision: "approve" | "reject",
  note?: string
): Promise<AdminRefund> {
  const body = await adminRequest<{ data: AdminRefund }>(
    `/api/admin/refunds/${encodeURIComponent(paymentId)}/${encodeURIComponent(refundId)}/decide`,
    { method: "POST", body: { decision, ...(note && note.trim() ? { note: note.trim() } : {}) } }
  );
  return body.data;
}

/* ------------------------------- Coupons -------------------------------- */

export interface AdminCoupon {
  code: string;
  kind: "fixed" | "percent";
  value: number;
  currency?: string;
  minBookingAmount: number;
  maxDiscount?: number;
  startsAt: string;
  expiresAt: string;
  globalLimit?: number;
  perCustomerLimit: number;
  categories?: string[];
  active: boolean;
  usageCount: number;
}

export async function fetchAdminCoupons(): Promise<{ coupons: AdminCoupon[]; isMainAdmin: boolean }> {
  const body = await adminRequest<{ data: AdminCoupon[]; isMainAdmin?: boolean }>("/api/admin/coupons");
  return { coupons: body.data, isMainAdmin: Boolean(body.isMainAdmin) };
}

export async function createCoupon(input: {
  code: string;
  kind: "fixed" | "percent";
  value: number;
  currency?: string;
  minBookingAmount: number;
  maxDiscount?: number;
  startsAt: string;
  expiresAt: string;
  globalLimit?: number;
  perCustomerLimit: number;
}): Promise<AdminCoupon> {
  const body = await adminRequest<{ data: AdminCoupon }>("/api/admin/coupons", {
    method: "POST",
    body: input,
  });
  return body.data;
}

export async function updateCoupon(code: string, updates: { active?: boolean; expiresAt?: string; perCustomerLimit?: number; globalLimit?: number | null }): Promise<AdminCoupon> {
  const body = await adminRequest<{ data: AdminCoupon }>(`/api/admin/coupons/${encodeURIComponent(code)}`, {
    method: "PATCH",
    body: updates,
  });
  return body.data;
}

export async function disableCoupon(code: string): Promise<void> {
  await adminRequest(`/api/admin/coupons/${encodeURIComponent(code)}`, { method: "DELETE" });
}

/* ------------------------------ Analytics ------------------------------- */

export interface AdminAnalyticsData {
  range: { from: string; to: string };
  users: { total: number; customers: number; technicians: number; admins: number; activeTechnicians: number; busyTechnicians: number };
  services: { approved: number; pending: number; rejected: number };
  bookings: { total: number; byStatus: Record<string, number>; completed: number; cancelled: number };
  payments: {
    byCurrency: Array<{
      currency: string;
      succeededMinor: number;
      succeededCount: number;
      refundMinor: number;
      refundCount: number;
      netMinor: number;
      pendingMinor: number;
      pendingCount: number;
      failedCount: number;
    }>;
    totalRefundedMinorByCurrency: Array<{
      currency: string;
      succeededMinor: number;
      succeededCount: number;
      pendingCount: number;
      failedCount: number;
      rejectedCount: number;
    }>;
  };
  coupons: { redemptions: number; discountMinorByCurrency: Array<{ currency: string; discountMinor: number }> };
  technicianPerformance: Array<{
    technicianId: string;
    name: string;
    completed: number;
    averageRating: number | null;
    reviewCount: number;
  }>;
  trends: {
    bookingsPerDay: Array<{ date: string; count: number }>;
    revenuePerDay: Array<{ date: string; currency: string; netMinor: number }>;
  };
  recentActivity: Array<{
    bookingId: string;
    serviceTitle?: string;
    type: string;
    at: string;
    by: string;
  }>;
}

export async function fetchAdminAnalytics(range?: { from?: string; to?: string }): Promise<AdminAnalyticsData> {
  const params = new URLSearchParams();
  if (range?.from) params.set("from", range.from);
  if (range?.to) params.set("to", range.to);
  const qs = params.toString();
  const body = await adminRequest<{ data: AdminAnalyticsData }>(`/api/admin/analytics${qs ? `?${qs}` : ""}`);
  return body.data;
}

/* -------------------------- Admin booking detail ------------------------ */

export interface AdminBookingDetail {
  id: string;
  service: {
    title: string;
    category: string;
    location: string;
    image: string;
    hourlyRate: number;
  };
  customer: { name: string; email?: string };
  technician: { name: string; email?: string };
  problemDescription: string;
  status: string;
  paymentStatus: string;
  hourlyRate: number;
  finalAmount?: number;
  schedule?: {
    date: string;
    slotStart: string;
    slotEnd: string;
    durationMinutes: number;
    timezone: string;
  };
  invoice?: {
    number: string;
    issuedAt: string;
    currency: string;
    serviceAmount: number;
    discountAmount: number;
    discountCode?: string;
    taxAmount: number;
    totalAmount: number;
    paymentStatus: string;
    paidAt?: string;
    bookingReference: string;
  };
  timeline: Array<{ type: string; at: string; by: string; note?: string }>;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAdminBooking(id: string): Promise<AdminBookingDetail> {
  const body = await adminRequest<{ data: AdminBookingDetail }>(`/api/admin/bookings/${encodeURIComponent(id)}`);
  return body.data;
}
