"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { API_BASE } from "@/lib/api";
import { attachBookingChatSession, getSocket, type BookingChatMessage } from "@/lib/socket";

/**
 * Customer ↔ technician booking chat. REST for sending/history (rate-limited
 * server-side), Socket.IO for real-time delivery. Identity is derived from
 * the verified JWT — never from client-supplied sender ids.
 */

type ChatMessage = BookingChatMessage;

const PAGE_SIZE = 30;

export default function ChatPanel({
  bookingId,
  currentUserId,
}: {
  bookingId: string;
  currentUserId?: string;
}) {
  const { data: session } = authClient.useSession();
  const myId = currentUserId ?? session?.user?.id ?? null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);
  // Incremented by the retry button to retrigger the mount fetch.
  const [reloadToken, setReloadToken] = useState(0);

  const listRef = useRef<HTMLUListElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const fetchAccessToken = useCallback(async (): Promise<string> => {
    const response = await authClient.$fetch<{ token: string }>("/token", {
      method: "GET",
    });
    const token = (response.data as { token?: unknown } | null)?.token;
    if (typeof token !== "string" || !token) throw new Error("Session expired.");
    return token;
  }, []);

  const fetchPage = useCallback(
    async (before?: string) => {
      const token = await fetchAccessToken();
      const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (before) query.set("before", before);
      const response = await fetch(
        `${API_BASE}/api/bookings/${encodeURIComponent(bookingId)}/chat?${query.toString()}`,
        { headers: { authorization: `Bearer ${token}`, accept: "application/json" } }
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Could not load messages (${response.status}).`);
      }
      return (await response.json()) as { data: ChatMessage[]; hasMore: boolean; unreadCount: number };
    },
    [bookingId, fetchAccessToken]
  );

  const markRead = useCallback(async () => {
    try {
      const token = await fetchAccessToken();
      await fetch(`${API_BASE}/api/bookings/${encodeURIComponent(bookingId)}/chat/read`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
    } catch {
      // Non-fatal — unread badge will correct on next load.
    }
  }, [bookingId, fetchAccessToken]);

  useEffect(() => {
    let cancelled = false;

    fetchPage()
      .then((page) => {
        if (cancelled) return;
        setMessages([...page.data].reverse());
        setHasMore(page.hasMore);
        setIsLoading(false);
        void markRead();
        // Scroll to bottom on first load.
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : "Could not load the conversation."
        );
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchPage, markRead, reloadToken]);

  // Join the booking room for live delivery + listen for new messages/read receipts.
  // Named handlers are removed exactly on cleanup; reconnect re-joins the
  // active room. Effect dependencies keep closures current on booking switch.
  useEffect(() => {
    let cancelled = false;
    let detach: (() => void) | undefined;

    void (async () => {
      const socket = await getSocket();
      if (!socket || cancelled) return;

      detach = attachBookingChatSession(socket, {
        bookingId,
        onConnected: () => setConnected(true),
        onDisconnected: () => setConnected(false),
        onJoinError: (message) => {
          if (!cancelled) setLoadError(message);
        },
        onMessage: (incoming) => {
          // The boundary (attachBookingChatSession) already validates the
          // shape — belt and braces against a garbled payload ever reaching
          // state or the render path.
          if (
            !incoming ||
            typeof incoming.id !== "string" ||
            typeof incoming.senderId !== "string" ||
            typeof incoming.createdAt !== "string"
          ) {
            return;
          }
          setMessages((current) =>
            current.some((message) => message.id === incoming.id)
              ? current
              : [...current, incoming]
          );
          // Mark read if the message came from the other participant.
          if (incoming.senderId !== myId) {
            void markRead();
          }
        },
        onRead: (payload) => {
          const readBy = payload.readBy;
          if (!readBy || (myId && readBy === myId)) return;
          const readAt = payload.readAt ?? new Date().toISOString();
          setMessages((current) =>
            current.map((message) =>
              myId && message.senderId === myId && !message.readAt
                ? { ...message, readAt }
                : message
            )
          );
        },
      });
      setConnected(socket.connected);
    })();

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [bookingId, myId, markRead]);

  async function loadOlder() {
    const oldest = messages[0];
    if (!oldest) return;
    try {
      const page = await fetchPage(oldest.id);
      setMessages((current) => [...[...page.data].reverse(), ...current]);
      setHasMore(page.hasMore);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load older messages.");
    }
  }

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;

    setIsSending(true);
    try {
      const token = await fetchAccessToken();
      const response = await fetch(`${API_BASE}/api/bookings/${encodeURIComponent(bookingId)}/chat`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      const body = (await response.json().catch(() => null)) as { message?: string; data?: ChatMessage } | null;
      if (!response.ok) {
        toast.error(body?.message ?? "Could not send the message.");
        return;
      }
      // Append only if the socket hasn't already delivered it.
      const sent = body?.data;
      if (sent) {
        setMessages((current) =>
          current.some((message) => message.id === sent.id) ? current : [...current, sent]
        );
      }
      setDraft("");
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      });
    } catch {
      toast.error("Could not send the message. Check your connection.");
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <section
      aria-labelledby="booking-chat-heading"
      className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <h2 id="booking-chat-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
            Conversation
          </h2>
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-muted"}`}
            title={connected ? "Live" : "Reconnecting…"}
          />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
          {connected ? "Live" : "Reconnecting…"}
        </span>
      </div>

      {/* Messages */}
      {isLoading ? (
        <div role="status" aria-label="Loading conversation…" className="space-y-3 p-4">
          <span className="sr-only">Loading conversation…</span>
          {[1, 2, 3].map((n) => (
            <div key={n} className={`flex ${n % 2 ? "justify-start" : "justify-end"}`}>
              <span className="h-12 w-48 animate-pulse rounded-2xl bg-surface-muted" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div role="alert" className="p-6 text-center">
          <p className="text-sm font-medium text-error">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setLoadError(null);
              setReloadToken((token) => token + 1);
            }}
            className="mt-3 cursor-pointer rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {hasMore && (
            <button
              type="button"
              onClick={loadOlder}
              className="mx-auto mt-2 block cursor-pointer text-[11px] font-semibold text-accent-strong hover:text-accent-600 dark:text-accent"
            >
              Load older messages
            </button>
          )}
          <ul
            ref={listRef}
            role="log"
            aria-live="polite"
            aria-label="Conversation with your technician"
            className="flex max-h-80 flex-col gap-2 overflow-y-auto px-4 py-3"
          >
            {messages.length === 0 ? (
              <li className="py-6 text-center text-xs text-muted">
                No messages yet — say hello to coordinate the repair.
              </li>
            ) : (
              messages.map((message) => {
                const mine = myId !== null && message.senderId === myId;
                return (
                  <li
                    key={message.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-snug shadow-xs ${
                        mine
                          ? "rounded-br-md bg-accent-500 text-[#04121f]"
                          : "rounded-bl-md border border-border bg-background text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.text}</p>
                      <p
                        className={`mt-1 text-[9px] font-medium uppercase tracking-wider ${
                          mine ? "text-[#04121f]/70" : "text-muted"
                        }`}
                      >
                        <time dateTime={message.createdAt}>
                          {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}
                        </time>
                        {mine && message.readAt ? " · read" : ""}
                      </p>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {/* Composer */}
          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border p-3">
            <label htmlFor="chat-input" className="sr-only">
              Write a message
            </label>
            <input
              id="chat-input"
              ref={inputRef}
              type="text"
              value={draft}
              maxLength={500}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a message…"
              autoComplete="off"
              className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
            />
            <button
              type="submit"
              disabled={isSending || draft.trim().length === 0}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent-500 text-[#04121f] transition-all duration-200 hover:bg-accent-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="animate-spin"><circle cx="12" cy="12" r="9" strokeOpacity="0.3" /><path d="M21 12a9 9 0 0 0-9-9" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></svg>
              )}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
