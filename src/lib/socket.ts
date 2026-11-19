"use client";

import { io, type Socket } from "socket.io-client";
import { authClient } from "@/lib/auth-client";
import { API_BASE } from "@/lib/api";
import { createSocketManager } from "@/lib/socket-instance";

/**
 * FixMate real-time client. Connects with a short-lived Better Auth JWT
 * fetched per (re)connection attempt — never stored in the browser beyond
 * the in-memory handshake. The server re-verifies the token against the
 * Better Auth JWKS and re-reads the role from the database.
 *
 * There is exactly one shared socket. Sign-out tears it down completely so a
 * later sign-in cannot inherit the previous account's authenticated state or
 * listeners.
 */

async function fetchAccessToken(): Promise<string | null> {
  try {
    const response = await authClient.$fetch<{ token: string }>("/token", {
      method: "GET",
    });
    const token = (response.data as { token?: unknown } | null)?.token;
    return typeof token === "string" && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

const manager = createSocketManager(() =>
  io(API_BASE, {
    path: "/socket.io",
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    transports: ["polling", "websocket"],
    // Fetch a fresh token before every (re)connect — JWTs are short-lived.
    auth: (cb) => {
      fetchAccessToken().then((token) => cb({ token: token ?? "" }));
    },
  })
);

export async function getSocket(): Promise<Socket | null> {
  return (await manager.get()) as Socket;
}

/** Full teardown used by the global authentication lifecycle (sign-out). */
export function disconnectSocket(): void {
  manager.disconnect();
}

export { attachBookingChatSession } from "./chat-room-session";
