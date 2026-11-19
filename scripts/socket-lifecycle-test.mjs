/**
 * FixMate socket lifecycle test (no browser, no network).
 *
 * Exercises the shared room-session helper and single-socket manager with
 * fake sockets: exact listener cleanup, remount safety, reconnect rejoin,
 * booking switches, sign-out teardown and fresh sign-in.
 *
 * Usage: node scripts/socket-lifecycle-test.mjs
 */
import { createSocketManager } from "../src/lib/socket-instance.ts";
import { attachBookingChatSession } from "../src/lib/chat-room-session.ts";

let failures = 0;
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.log(`  FAIL  ${msg}`);
};
const check = (cond, msg) => (cond ? pass(msg) : fail(msg));

class FakeSocket {
  constructor() {
    this.connected = false;
    this.listeners = new Map();
    this.joins = [];
    this.leaves = [];
    this.connects = 0;
    this.disconnects = 0;
    this.removals = 0;
  }
  on(event, handler) {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }
  off(event, handler) {
    const list = this.listeners.get(event) ?? [];
    this.listeners.set(event, list.filter((candidate) => candidate !== handler));
  }
  emit(event, ...args) {
    if (event === "join:booking") {
      this.joins.push(args[0]);
      args[1]?.({ success: true });
    } else if (event === "leave:booking") {
      this.leaves.push(args[0]);
    }
  }
  connect() {
    this.connects += 1;
    this.connected = true;
    this.fire("connect");
  }
  disconnect() {
    this.disconnects += 1;
    this.connected = false;
    this.fire("disconnect");
  }
  removeAllListeners() {
    this.removals += 1;
    this.listeners.clear();
  }
  fire(event, payload) {
    for (const handler of [...(this.listeners.get(event) ?? [])]) handler(payload);
  }
  count(event) {
    return (this.listeners.get(event) ?? []).length;
  }
}

const handlers = (bookingId, received) => ({
  bookingId,
  onConnected: () => {},
  onDisconnected: () => {},
  onMessage: (payload) => received.push(payload),
});

console.log("Socket lifecycle test\n");

console.log("[listener cleanup]");
{
  const socket = new FakeSocket();
  socket.connected = true;
  const seen = [];
  const detach = attachBookingChatSession(socket, handlers("booking-a", seen));
  check(
    socket.count("connect") === 1 && socket.count("disconnect") === 1 && socket.count("chat:message") === 1,
    "attach registers exactly one of each listener"
  );
  detach();
  check(
    socket.count("connect") === 0 && socket.count("disconnect") === 0 && socket.count("chat:message") === 0,
    "detach removes the exact registered listeners"
  );
  check(socket.leaves.length === 1 && socket.leaves[0].bookingId === "booking-a", "detach leaves the booking room");
  detach();
  check(socket.leaves.length === 1, "double cleanup is a no-op");
}

console.log("\n[remount / Strict Mode]");
{
  const socket = new FakeSocket();
  socket.connected = true;
  attachBookingChatSession(socket, handlers("booking-a", []))();
  attachBookingChatSession(socket, handlers("booking-a", []));
  check(
    socket.count("connect") === 1 && socket.count("disconnect") === 1 && socket.count("chat:message") === 1,
    "remount does not accumulate duplicate listeners"
  );
  check(socket.joins.length === 2, "each mount performs one fresh room join");
}

console.log("\n[reconnect and booking switch]");
{
  const socket = new FakeSocket();
  socket.connected = true;
  const oldMessages = [];
  const newMessages = [];
  const detachOld = attachBookingChatSession(socket, handlers("booking-a", oldMessages));
  check(socket.joins.length === 1, "initial join emitted once for an already-connected socket");

  socket.fire("disconnect");
  socket.connected = true;
  socket.fire("connect");
  check(socket.joins.length === 2, "reconnect rejoins the active booking room");

  detachOld();
  attachBookingChatSession(socket, handlers("booking-b", newMessages));
  check(
    socket.joins.length === 3 && socket.joins[2].bookingId === "booking-b",
    "booking switch joins the new room"
  );
  socket.fire("chat:message", { id: "m1" });
  check(
    oldMessages.length === 0 && newMessages.length === 1,
    "old booking listener no longer receives messages"
  );
}

console.log("\n[sign-out / sign-in]");
{
  let created = 0;
  const createdSockets = [];
  const manager = createSocketManager(() => {
    created += 1;
    const socket = new FakeSocket();
    createdSockets.push(socket);
    return socket;
  });

  const first = await manager.get();
  check(created === 1 && manager.current() === first, "first get creates one shared socket");
  check(first.connects === 1, "socket connects once");
  manager.disconnect();
  check(
    first.removals === 1 && first.disconnects === 1 && manager.current() === null,
    "disconnect removes listeners, disconnects and clears the shared socket"
  );
  const second = await manager.get();
  check(second !== first && created === 2, "subsequent sign-in creates a fresh socket");
  check(second.connects === 1, "fresh socket connects with the new session");
}

console.log("\n[in-flight connection reset]");
{
  let created = 0;
  const manager = createSocketManager(() => {
    created += 1;
    return new FakeSocket();
  });
  const pending = manager.get();
  manager.disconnect();
  const active = await pending;
  check(created === 2 && manager.current() === active, "reset during connect discards the stale socket");
}

console.log(`\n${failures === 0 ? "SOCKET LIFECYCLE CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
