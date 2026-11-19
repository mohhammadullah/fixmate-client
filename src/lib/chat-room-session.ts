import type { Socket } from "socket.io-client";

/**
 * Booking-room lifecycle for the chat panel.
 *
 * Works with the single shared Socket.IO client created by `lib/socket.ts`;
 * it does not create or own a socket. Listeners are registered with named
 * handler references so cleanup removes exactly those handlers (never other
 * components' listeners), and the active booking room is rejoined after a
 * reconnect. Exported for focused lifecycle tests with a fake socket.
 */

export interface BookingChatReadPayload {
  bookingId?: string;
  readBy?: string;
  readAt?: string;
}

export interface BookingChatMessage {
  id: string;
  senderId: string;
  senderRole: "customer" | "technician";
  text: string;
  createdAt: string;
  readAt?: string | null;
}

export interface BookingChatSessionHandlers {
  bookingId: string;
  onConnected: () => void;
  onDisconnected: () => void;
  onMessage: (payload: BookingChatMessage) => void;
  onRead?: (payload: BookingChatReadPayload) => void;
  onJoinError?: (message: string) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Accept only fully-formed message DTOs — anything else is ignored. */
function toChatMessage(value: unknown): BookingChatMessage | null {
  if (!isRecord(value)) return null;
  const { id, senderId, senderRole, text, createdAt, readAt } = value;
  if (
    typeof id !== "string" || id.length === 0 ||
    typeof senderId !== "string" || senderId.length === 0 ||
    (senderRole !== "customer" && senderRole !== "technician") ||
    typeof text !== "string" ||
    typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt)) ||
    (readAt !== undefined && readAt !== null && typeof readAt !== "string")
  ) {
    return null;
  }
  return {
    id,
    senderId,
    senderRole,
    text,
    createdAt,
    ...(readAt === undefined ? {} : { readAt }),
  };
}

/**
 * The server emits `chat:message` with two shapes: the bare message DTO to
 * the booking room, and a `{ bookingId, message }` envelope to each
 * participant's user room (for list-level badges) — an active chat panel is
 * in BOTH rooms and therefore receives both. Normalize them here so the
 * consumer always sees a single, validated message shape and never crashes
 * on an envelope it mistook for a message. Envelopes targeting a different
 * booking are ignored as well.
 */
function normalizeChatMessage(
  payload: unknown,
  bookingId: string
): BookingChatMessage | null {
  if (!isRecord(payload)) return null;
  if ("message" in payload) {
    // Envelope — only for this booking, and only when the inner shape is valid.
    const envelopeBookingId = typeof payload.bookingId === "string" ? payload.bookingId : null;
    if (envelopeBookingId !== bookingId) return null;
    return toChatMessage(payload.message);
  }
  return toChatMessage(payload);
}

export function attachBookingChatSession(
  socket: Socket,
  handlers: BookingChatSessionHandlers
): () => void {
  const { bookingId, onConnected, onDisconnected, onMessage, onRead, onJoinError } = handlers;
  let active = true;

  const joinBooking = () => {
    if (!active || !socket.connected) return;
    socket.emit("join:booking", { bookingId }, (ack: { success?: boolean } | undefined) => {
      if (!active) return;
      if (!ack?.success) {
        onJoinError?.("You are not a participant of this conversation.");
      }
    });
  };

  const handleConnect = () => {
    if (!active) return;
    onConnected();
    // Socket.IO emits "connect" again after a transport reconnect: rejoin the
    // active room so live delivery resumes without a page reload.
    joinBooking();
  };

  const handleDisconnect = () => {
    if (active) onDisconnected();
  };

  const handleMessage = (payload: unknown) => {
    if (!active) return;
    const message = normalizeChatMessage(payload, bookingId);
    if (!message) return; // malformed or for another booking — ignore
    onMessage(message);
  };

  const handleRead = (payload: unknown) => {
    if (!active) return;
    const data = payload as BookingChatReadPayload | null | undefined;
    // Ignore malformed or unrelated booking payloads.
    if (data?.bookingId && data.bookingId !== bookingId) return;
    onRead?.(data ?? {});
  };

  socket.on("connect", handleConnect);
  socket.on("disconnect", handleDisconnect);
  socket.on("chat:message", handleMessage);
  socket.on("chat:read", handleRead);

  // An already-connected socket will not emit "connect" again, so join once
  // here. A connecting socket joins from handleConnect instead — no duplicates.
  if (socket.connected) joinBooking();

  return () => {
    if (!active) return;
    active = false;
    socket.off("connect", handleConnect);
    socket.off("disconnect", handleDisconnect);
    socket.off("chat:message", handleMessage);
    socket.off("chat:read", handleRead);
    if (socket.connected) socket.emit("leave:booking", { bookingId });
  };
}
