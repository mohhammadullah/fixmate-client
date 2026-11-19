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

export interface BookingChatSessionHandlers {
  bookingId: string;
  onConnected: () => void;
  onDisconnected: () => void;
  onMessage: (payload: unknown) => void;
  onJoinError?: (message: string) => void;
}

export function attachBookingChatSession(
  socket: Socket,
  handlers: BookingChatSessionHandlers
): () => void {
  const { bookingId, onConnected, onDisconnected, onMessage, onJoinError } = handlers;
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
    if (active) onMessage(payload);
  };

  socket.on("connect", handleConnect);
  socket.on("disconnect", handleDisconnect);
  socket.on("chat:message", handleMessage);

  // An already-connected socket will not emit "connect" again, so join once
  // here. A connecting socket joins from handleConnect instead — no duplicates.
  if (socket.connected) joinBooking();

  return () => {
    if (!active) return;
    active = false;
    socket.off("connect", handleConnect);
    socket.off("disconnect", handleDisconnect);
    socket.off("chat:message", handleMessage);
    if (socket.connected) socket.emit("leave:booking", { bookingId });
  };
}
