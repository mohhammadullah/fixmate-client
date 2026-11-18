"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications";
import { getSocket } from "@/lib/socket";
import { formatRelativeTime } from "@/lib/time";

/**
 * Notification bell for the dashboard header: persistent unread badge,
 * latest-notifications dropdown, socket-powered live updates, mark-all-read,
 * full-page notification center for everything else.
 */
export default function NotificationBell() {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Initial badge load.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;

    fetchUnreadCount()
      .then((count) => {
        if (!cancelled) setUnreadCount(count);
      })
      .catch(() => {
        // Badge stays 0 on failure; the dropdown surfaces errors instead.
      });

    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  // Live updates: prepend socket notifications, keep the badge in sync.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const socket = await getSocket();
      if (!socket || cancelled) return;

      const handler = (incoming: AppNotification) => {
        setItems((current) =>
          current.some((n) => n.id === incoming.id)
            ? current
            : [incoming, ...current].slice(0, 10)
        );
        setUnreadCount((count) => count + 1);
      };
      socket.on("notification", handler);
      cleanup = () => socket.off("notification", handler);
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [signedIn]);

  const loadDropdown = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const page = await fetchNotifications({ limit: 8 });
      setItems(page.data);
      setUnreadCount(page.unreadCount);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load notifications."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Open/close the dropdown; outside click + Escape close it.
  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  function toggleDropdown() {
    setIsOpen((open) => {
      const next = !open;
      if (next) void loadDropdown();
      return next;
    });
  }

  async function handleMarkOne(notification: AppNotification) {
    if (notification.readAt) return;
    // Optimistic update; roll back on failure.
    setItems((current) =>
      current.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await markNotificationRead(notification.id);
    } catch {
      toast.error("Could not mark the notification as read.");
      setItems((current) =>
        current.map((n) => (n.id === notification.id ? notification : n))
      );
      setUnreadCount((count) => count + 1);
    }
  }

  async function handleMarkAll() {
    if (isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setItems((current) =>
        current.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
      toast.success("All notifications marked as read.");
    } catch {
      toast.error("Could not mark all notifications as read.");
    } finally {
      setIsMarkingAll(false);
    }
  }

  if (!signedIn) return null;

  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleDropdown}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="notification-menu"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-heading transition-all duration-200 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 active:scale-95"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface bg-error px-1 text-[9px] font-bold leading-none text-white"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id="notification-menu"
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-80 origin-top-right overflow-hidden rounded-2xl border border-border bg-surface shadow-lg sm:w-96"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-bold text-heading">Notifications</p>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  disabled={isMarkingAll}
                  className="cursor-pointer text-xs font-semibold text-accent-strong transition-colors hover:text-accent-600 disabled:cursor-wait disabled:opacity-60 dark:text-accent"
                >
                  {isMarkingAll ? "Marking…" : "Mark all read"}
                </button>
              )}
              <Link
                href="/dashboard/notifications"
                onClick={() => setIsOpen(false)}
                className="text-xs font-semibold text-muted transition-colors hover:text-heading"
              >
                View all →
              </Link>
            </div>
          </div>

          {/* Body */}
          {isLoading ? (
            <div className="p-4" role="status" aria-label="Loading notifications…">
              <span className="sr-only">Loading notifications…</span>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="flex items-start gap-3">
                    <span className="h-9 w-9 animate-pulse rounded-full bg-surface-muted" />
                    <span className="min-w-0 flex-1 space-y-2">
                      <span className="block h-3.5 w-3/4 animate-pulse rounded bg-surface-muted" />
                      <span className="block h-3 w-1/2 animate-pulse rounded bg-surface-muted" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : loadError ? (
            <div className="p-6 text-center">
              <p role="alert" className="text-sm font-medium text-error">{loadError}</p>
              <button
                type="button"
                onClick={() => void loadDropdown()}
                className="mt-3 cursor-pointer rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center">
              <span
                aria-hidden="true"
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50 text-accent-strong dark:bg-surface-muted dark:text-accent"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </span>
              <p className="mt-3 text-sm font-semibold text-heading">All quiet</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Booking updates, payments and refund decisions will appear here.
              </p>
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto" role="list">
              {items.map((notification) => {
                const unread = !notification.readAt;
                const href = notification.bookingId
                  ? `/dashboard/bookings/${notification.bookingId}`
                  : "/dashboard/notifications";
                return (
                  <li key={notification.id}>
                    <Link
                      href={href}
                      onClick={() => {
                        void handleMarkOne(notification);
                        setIsOpen(false);
                      }}
                      className="group flex items-start gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-muted/60 focus-visible:bg-surface-muted/60 focus-visible:outline-none"
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          unread ? "bg-accent-50 text-accent-strong dark:bg-accent-400/10 dark:text-accent" : "bg-surface-muted text-muted"
                        }`}
                      >
                        {notification.type.startsWith("refund") ? (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9" /><path d="M3 4v5h5" /><path d="M12 7v5l3 2" /></svg>
                        ) : notification.type.startsWith("payment") ? (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={`truncate text-xs font-bold ${unread ? "text-heading" : "text-foreground"}`}>
                            {notification.title}
                          </span>
                          {unread && (
                            <span
                              aria-label="Unread"
                              className="h-2 w-2 shrink-0 rounded-full bg-accent-500"
                            />
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs leading-5 text-muted">
                          {notification.body}
                        </span>
                        <span className="mt-1 block text-[10px] font-medium uppercase tracking-wider text-muted/70">
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
