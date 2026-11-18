/**
 * Build up to two uppercase initials from a person's display name.
 * Falls back to the local part of an email, then to "?". Used for
 * initials-based avatar fallbacks when no profile image is available.
 */
export function initialsFor(name: string | null | undefined, email?: string | null): string {
  const source = (name ?? "").trim().length > 0 ? (name as string) : (email ?? "");
  const parts = source
    .split(/[\s@._-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) return "?";
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  return (first + last).toUpperCase();
}
