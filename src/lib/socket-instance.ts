/**
 * Shared single-socket lifecycle (framework-agnostic, testable).
 *
 * The real app supplies a factory that creates the Socket.IO client; tests
 * supply a fake. No second socket is ever created while one is active, and a
 * full disconnect invalidates in-flight connections so a later sign-in gets
 * a fresh authenticated socket.
 */

export interface ManagedSocket {
  connected: boolean;
  connect(): void;
  disconnect(): void;
  removeAllListeners(): void;
}

export interface SocketManager {
  get(): Promise<ManagedSocket>;
  disconnect(): void;
  current(): ManagedSocket | null;
}

export function createSocketManager(create: () => ManagedSocket): SocketManager {
  let socket: ManagedSocket | null = null;
  let connecting: Promise<ManagedSocket> | null = null;
  let generation = 0;

  const manager: SocketManager = {
    async get() {
      if (socket?.connected) return socket;
      if (connecting) return connecting;

      const startedAt = generation;
      connecting = (async () => {
        if (!socket) socket = create();
        if (!socket.connected) socket.connect();
        return socket;
      })();

      const pending = connecting;
      try {
        const active = await pending;
        if (startedAt !== generation) {
          if (connecting === pending) connecting = null;
          return manager.get();
        }
        return active;
      } finally {
        if (connecting === pending) connecting = null;
      }
    },

    disconnect() {
      generation += 1;
      const previous = socket;
      socket = null;
      connecting = null;
      if (!previous) return;
      previous.removeAllListeners();
      if (previous.connected) previous.disconnect();
    },

    current() {
      return socket;
    },
  };

  return manager;
}
