/**
 * Post-authentication redirect safety.
 *
 * `callbackURL` comes from the query string and is never trusted. Only local,
 * same-origin relative paths are accepted; anything else falls back to the
 * existing homepage destination. Shared by sign-in and sign-up so they behave
 * identically, and by the links between them so the destination is preserved.
 */

export const DEFAULT_AUTH_REDIRECT = "/";

const SAFE_ORIGIN = "http://fixmate.local";

export function safeAuthRedirect(
  raw: string | null | undefined,
  fallback: string = DEFAULT_AUTH_REDIRECT
): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (!value || value.length > 2000) return fallback;
  // Backslashes are treated as path separators by some browsers and can turn
  // an apparently local path into a network-path reference.
  if (value.includes("\\")) return fallback;
  if (/[\u0000-\u001F\u007F]/.test(value)) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const url = new URL(value, SAFE_ORIGIN);
    if (url.origin !== SAFE_ORIGIN || url.protocol !== "http:") return fallback;
    if (url.username || url.password) return fallback;
    const path = url.pathname;
    if (!path.startsWith("/") || path.startsWith("//")) return fallback;
    let decodedPath = path;
    try {
      decodedPath = decodeURIComponent(path);
    } catch {
      return fallback;
    }
    if (decodedPath.includes("\\") || decodedPath.startsWith("//")) return fallback;
    return `${path}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Link between sign-in/sign-up without losing a validated destination. */
export function withAuthCallback(path: string, callback: string): string {
  const safe = safeAuthRedirect(callback);
  return safe === DEFAULT_AUTH_REDIRECT
    ? path
    : `${path}?callbackURL=${encodeURIComponent(safe)}`;
}
