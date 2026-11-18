"use client";

import { io, type Socket } from "socket.io-client";
import { authClient } from "@/lib/auth-client";
import { API_BASE } from "@/lib/api";

/**
 * FixMate real-time client. Connects with a short-lived Better Auth JWT
 * fetched per (re)connection attempt — never stored in the browser beyond
 * the in-memory handshake. The server re-verifies the token against the
 * Better Auth JWKS and re-reads the role from the database.
 */

let socket: Socket | null = null;
let connecting: Promise<Socket | null> | null = null;

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

export async function getSocket(): Promise<Socket | null> {
  if (socket?.connected) return socket;
  if (connecting) return connecting;

  connecting = (async () => {
    if (!socket) {
      socket = io(API_BASE, {
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
      });
    }
    socket.connect();
    return socket;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
