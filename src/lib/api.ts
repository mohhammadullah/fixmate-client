/**
 * Shared API origin for the FixMate backend — the single source of truth.
 *
 * `NEXT_PUBLIC_API_URL` is a public, non-secret value (see .env.example).
 * Every client utility and component imports `API_BASE` from here instead of
 * redeclaring the variable. Never put secrets in this module or in any
 * NEXT_PUBLIC_* variable.
 *
 * Behaviour:
 * - Development/test with the variable unset: http://localhost:5000 (legacy
 *   local-development behaviour is preserved).
 * - Production build (`NODE_ENV=production`, which `next build` sets): the
 *   variable MUST be present, absolute, http(s), credential-free, and HTTPS.
 *   A missing/invalid value throws at module evaluation so the build fails
 *   clearly instead of silently emitting a bundle that calls localhost.
 */

const DEV_FALLBACK = "http://localhost:5000";

function resolveApiBase(): string {
  const isProduction = process.env.NODE_ENV === "production";
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";

  if (!raw) {
    if (isProduction) {
      throw new Error(
        "NEXT_PUBLIC_API_URL is required for production builds. " +
          "Set it to the public HTTPS URL of the FixMate backend."
      );
    }
    return DEV_FALLBACK;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_API_URL must be an absolute http(s) URL without credentials, query string or fragment."
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_API_URL must use the http or https scheme.");
  }
  if (isProduction && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_API_URL must use HTTPS in production builds.");
  }
  if (url.username || url.password) {
    throw new Error("NEXT_PUBLIC_API_URL must not contain credentials.");
  }
  if (url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_API_URL must not contain a query string or fragment.");
  }

  return url.toString().replace(/\/+$/, "");
}

export const API_BASE = resolveApiBase();
