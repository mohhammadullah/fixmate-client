"use client";

import { API_BASE } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

/** Client-side notification API helpers — JWT fetched per request cycle. */

export type NotificationType =
  | "booking_requested"
  | "booking_accepted"
  | "booking_rejected"
  | "booking_cancelled"
  | "booking_started"
  | "booking_completed"
  | "payment_confirmed"
  | "refund_requested"
  | "refund_approved"
  | "refund_rejected"
  | "refund_succeeded"
  | "refund_failed"
  | "service_moderation"
  | "application_reviewed"
  | "admin_operational";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  bookingId?: string;
  serviceId?: string;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage {
  data: AppNotification[];
  unreadCount: number;
  pagination: {
    currentPage: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

class NotificationsError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "NotificationsError";
    this.status = status;
  }
}
export { NotificationsError };

async function fetchAccessToken(): Promise<string> {
  const response = await authClient.$fetch<{ token: string }>("/token", {
    method: "GET",
  });
  const token = (response.data as { token?: unknown } | null)?.token;
  if (typeof token !== "string" || !token) {
    throw new NotificationsError(401, "Your session has expired. Sign in again.");
  }
  return token;
}

export async function fetchNotifications(params: {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
} = {}): Promise<NotificationPage> {
  const token = await fetchAccessToken();
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.unreadOnly) search.set("unreadOnly", "true");

  const qs = search.toString();
  const response = await fetch(
    `${API_BASE}/api/notifications${qs ? `?${qs}` : ""}`,
    { headers: { authorization: `Bearer ${token}`, accept: "application/json" } }
  );

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
        : "Could not load notifications.";
    throw new NotificationsError(response.status, message);
  }

  return body as NotificationPage;
}

export async function fetchUnreadCount(): Promise<number> {
  const token = await fetchAccessToken();
  const response = await fetch(`${API_BASE}/api/notifications/unread-count`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!response.ok) throw new NotificationsError(response.status, "Could not load unread count.");
  const body = (await response.json()) as { data?: { unreadCount?: number } };
  return body?.data?.unreadCount ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const token = await fetchAccessToken();
  const response = await fetch(
    `${API_BASE}/api/notifications/${encodeURIComponent(id)}/read`,
    { method: "PATCH", headers: { authorization: `Bearer ${token}` } }
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new NotificationsError(response.status, body?.message ?? "Could not mark notification as read.");
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const token = await fetchAccessToken();
  const response = await fetch(`${API_BASE}/api/notifications/read-all`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new NotificationsError(response.status, body?.message ?? "Could not mark all as read.");
  }
}
