/**
 * FixMate — post-authentication redirect safety test (no network, no DB).
 * Verifies the shared callbackURL validator used by sign-in and sign-up.
 *
 * Usage: node scripts/auth-callback-test.mjs
 */
import {
  DEFAULT_AUTH_REDIRECT,
  safeAuthRedirect,
  withAuthCallback,
} from "../src/lib/auth-redirect.ts";

let failures = 0;
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.log(`  FAIL  ${msg}`);
};
const check = (cond, msg) => (cond ? pass(msg) : fail(msg));

console.log("Auth callback URL test\n");

console.log("[valid local destinations]");
check(safeAuthRedirect("/services/123") === "/services/123", "service detail callback preserved");
check(
  safeAuthRedirect("/dashboard/payments?status=paid") === "/dashboard/payments?status=paid",
  "dashboard callback with query preserved"
);
check(
  safeAuthRedirect("/dashboard/bookings/abc#chat") === "/dashboard/bookings/abc#chat",
  "local hash preserved"
);
check(safeAuthRedirect("/../services") === "/services", "parent traversal normalized locally");

console.log("\n[missing input]");
check(safeAuthRedirect(null) === DEFAULT_AUTH_REDIRECT, "null -> homepage default");
check(safeAuthRedirect(undefined) === DEFAULT_AUTH_REDIRECT, "undefined -> homepage default");
check(safeAuthRedirect("") === DEFAULT_AUTH_REDIRECT, "empty -> homepage default");

console.log("\n[unsafe destinations rejected]");
check(safeAuthRedirect("https://external.example") === "/", "absolute external URL rejected");
check(safeAuthRedirect("http://external.example/path") === "/", "absolute http URL rejected");
check(safeAuthRedirect("//external.example") === "/", "protocol-relative URL rejected");
check(safeAuthRedirect("/\\external.example") === "/", "backslash URL trick rejected");
check(safeAuthRedirect("/%5C%5Cexternal.example") === "/", "encoded backslash trick rejected");
check(safeAuthRedirect("javascript:alert(1)") === "/", "javascript scheme rejected");
check(safeAuthRedirect("https://fixmate.local/dashboard") === "/", "spoofed helper origin rejected");
check(safeAuthRedirect("/bad\u0000path") === "/", "control character rejected");

console.log("\n[cross-form preservation]");
check(
  withAuthCallback("/sign-up", "/services/123") === "/sign-up?callbackURL=%2Fservices%2F123",
  "sign-in -> sign-up link keeps destination"
);
check(
  withAuthCallback("/sign-in", "/dashboard/payments") === "/sign-in?callbackURL=%2Fdashboard%2Fpayments",
  "sign-up -> sign-in link keeps destination"
);
check(withAuthCallback("/sign-up", "//evil.example") === "/sign-up", "unsafe destination not propagated");
check(
  safeAuthRedirect(new URL(withAuthCallback("/sign-up", "/services/123"), "http://local").searchParams.get("callbackURL")) === "/services/123",
  "round-trip through the link preserves a safe destination"
);

console.log(`\n${failures === 0 ? "AUTH CALLBACK CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
