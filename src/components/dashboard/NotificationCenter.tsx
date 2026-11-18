"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  NotificationsError,
} from "@/lib/notifications";
import { getSocket } from "@/lib/socket";
import { formatDateTime } from "@/lib/time";

const PAGE_SIZE = 15;

export default function NotificationCenter() {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; message: string }
    | { phase: "success"; items: AppNotification[]; unreadCount: number; page: number; totalPages: number }
  >({ phase: "loading" });
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  async function load(page: number) {
    try {
      const result = await fetchNotifications({ page, limit: PAGE_SIZE });
      setState({
        phase: "success",
        items: result.data,
        unreadCount: result.unreadCount,
        page,
        totalPages: Math.max(1, result.pagination.totalPages),
      });
    } catch (error) {
      setState({
        phase: "error",
        message:
          error instanceof NotificationsError
            ? error.message
            : "Could not load notifications. Please try again.",
      });
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetchNotifications({ page: 1, limit: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setState({
          phase: "success",
          items: result.data,
          unreadCount: result.unreadCount,
          page: 1,
          totalPages: Math.max(1, result.pagination.totalPages),
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          phase: "error",
          message:
            error instanceof NotificationsError
              ? error.message
              : "Could not load notifications. Please try again.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);
  // Live updates from the socket.
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void (async () => {
      const socket = await getSocket();
      if (!socket || cancelled) return;
      const handler = (incoming: AppNotification) => {
        setState((current) => {
          if (current.phase !== "success" || current.page !== 1) return current;
          if (current.items.some((n) => n.id === incoming.id)) return current;
          return {
            ...current,
            items: [incoming, ...current.items].slice(0, PAGE_SIZE),
            unreadCount: current.unreadCount + 1,
          };
        });
      };
      socket.on("notification", handler);
      cleanup = () => socket.off("notification", handler);
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  async function handleMarkOne(notification: AppNotification) {
    if (notification.readAt) return;
    setState((current) =>
      current.phase === "success"
        ? {
            ...current,
            items: current.items.map((n) =>
              n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n
            ),
            unreadCount: Math.max(0, current.unreadCount - 1),
          }
        : current
    );
    try {
      await markNotificationRead(notification.id);
    } catch {
      toast.error("Could not mark as read. Please try again.");
      void load(state.phase === "success" ? state.page : 1);
    }
  }

  async function handleMarkAll() {
    setIsMarkingAll(true);
    try {
      await markAllNotificationsRead();
      toast.success("All notifications marked as read.");
      void load(state.phase === "success" ? state.page : 1);
    } catch {
      toast.error("Could not mark all as read.");
    } finally {
      setIsMarkingAll(false);
    }
  }

  if (state.phase === "loading") {
    return (
      <div role="status" aria-label="Loading notifications…" className="space-y-3">
        <span className="sr-only">Loading notifications…</span>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
            <span className="h-10 w-10 animate-pulse rounded-full bg-surface-muted" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="block h-4 w-2/3 animate-pulse rounded bg-surface-muted" />
              <span className="block h-3 w-1/2 animate-pulse rounded bg-surface-muted" />
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
        <h2 className="text-base font-bold text-heading">Couldn&apos;t load notifications</h2>
        <p className="mt-1.5 text-sm text-muted">{state.message}</p>
        <button
          type="button"
          onClick={() => void load(1)}
          className="mt-4 cursor-pointer rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Try again
        </button>
      </div>
    );
  }

  const { items, unreadCount, page, totalPages } = state;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {unreadCount > 0 ? (
            <>
              <span className="font-bold text-heading">{unreadCount}</span> unread{" "}
              {unreadCount === 1 ? "notification" : "notifications"}
            </>
          ) : (
            "You're all caught up"
          )}
        </p>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={isMarkingAll}
            className="cursor-pointer rounded-full border border-border px-4 py-2 text-xs font-semibold text-heading transition-colors hover:bg-surface-muted disabled:opacity-60"
          >
            {isMarkingAll ? "Marking…" : "Mark all as read"}
          </button>
        )}
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-dashed border-border-strong bg-surface/50 p-10 text-center">
          <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50 text-accent-strong dark:bg-surface-muted dark:text-accent">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
          </span>
          <h2 className="mt-4 text-base font-bold text-heading">Nothing here yet</h2>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            Booking updates, payment confirmations and refund decisions will land here.
          </p>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-2" role="list">
          {items.map((notification) => {
            const unread = !notification.readAt;
            const href = notification.bookingId
              ? `/dashboard/bookings/${notification.bookingId}`
              : "/dashboard/notifications";
            return (
              <li key={notification.id}>
                <div
                  className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors duration-150 ${
                    unread ? "border-accent-500/30 bg-accent-50/40 dark:bg-surface-muted/40" : "border-border bg-surface"
                  }`}
                >
                  <Link href={href} className="flex min-w-0 flex-1 items-start gap-3 focus-visible:outline-none">
                    <span aria-hidden="true" className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${unread ? "bg-accent-500 text-accent-foreground" : "bg-surface-muted text-muted"}`}>
                      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-heading">{notification.title}</span>
                        {unread && <span aria-label="Unread" className="h-2 w-2 rounded-full bg-accent-500" />}
                      </span>
                      <span className="mt-0.5 block text-sm leading-6 text-foreground">{notification.body}</span>
                      <time dateTime={notification.createdAt} className="mt-1 block text-[10px] font-medium uppercase tracking-wider text-muted">
                        {formatDateTime(notification.createdAt)}
                      </time>
                    </span>
                  </Link>
                  {unread && (
                    <button
                      type="button"
                      onClick={() => void handleMarkOne(notification)}
                      aria-label="Mark as read"
                      title="Mark as read"
                      className="shrink-0 cursor-pointer rounded-lg p-2 text-muted transition-colors hover:bg-surface-muted hover:text-heading"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Notifications pagination" className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => void load(page - 1)}
            className="cursor-pointer rounded-full border border-border px-4 py-2 text-xs font-semibold text-heading transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-xs font-medium tabular-nums text-muted">Page {page} of {totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => void load(page + 1)}
            className="cursor-pointer rounded-full border border-border px-4 py-2 text-xs font-semibold text-heading transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  );
}
