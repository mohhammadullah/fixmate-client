"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { authClient } from "@/lib/auth-client";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "About Us", href: "/about" },
] as const;

/** Derive up to two initials from the user's name, falling back to the
 *  email address, for the avatar fallback. */
function initialsFor(name?: string | null, email?: string | null): string {
  const base = (name?.trim() || email?.trim() || "").trim();
  if (!base) return "?";
  const parts = base.split(/[\s@._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}

/** Map a Better Auth sign-out failure (or a thrown network error) to a
 *  meaningful, user-facing message. */
function mapSignOutError(error: {
  message?: string;
  code?: string;
  status?: number;
}): string {
  const status = error.status;
  const message = error.message ?? "";
  if (typeof status === "number" && status >= 500) {
    return "The FixMate server couldn't sign you out right now. Please try again.";
  }
  if (message && message.length <= 160) return message;
  return "Couldn't sign you out. Please check your connection and try again.";
}

function InitialsAvatar({
  name,
  email,
  size = "md",
}: {
  name?: string | null;
  email?: string | null;
  size?: "md" | "lg";
}) {
  const dimension = size === "lg" ? "h-11 w-11 text-sm" : "h-9 w-9 text-xs";
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent-500 font-bold text-accent-foreground ring-2 ring-accent-500/30 ${dimension}`}
    >
      {initialsFor(name, email)}
    </span>
  );
}

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`animate-spin motion-reduce:animate-none ${className ?? ""}`}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Better Auth client session — the single source of truth for auth state.
  // `null` data means signed out; no tokens are stored manually anywhere.
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const sessionUser = session?.user ?? null;
  const displayName = sessionUser?.name?.trim() || sessionUser?.email || "";

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  // Auto-dismiss the sign-out error after 8 seconds.
  useEffect(() => {
    if (!signOutError) return;
    const timeout = window.setTimeout(() => setSignOutError(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [signOutError]);

  // Close the mobile menu whenever the route changes by adjusting state
  // during render (avoids cascading renders from effects).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setIsMenuOpen(false);
  }

  // Close the mobile menu on Escape for keyboard users.
  useEffect(() => {
    if (!isMenuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMenuOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  function isActive(href: string): boolean {
    // Hash anchors are same-page links — never treated as a persistent route.
    if (href.includes("#")) return false;
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  async function handleSignOut() {
    if (isSigningOut) return; // Prevent duplicate clicks.
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      const { error } = await authClient.signOut();
      if (error) {
        // Keep the user visibly signed in — do not fake a logout.
        setSignOutError(mapSignOutError(error));
        setIsSigningOut(false);
        return;
      }
      setIsMenuOpen(false);
      // Refresh server components and let the client session atom settle —
      // the Navbar updates immediately once the atom reports signed-out.
      router.refresh();
      setIsSigningOut(false);
    } catch {
      setSignOutError(
        "Couldn't reach the FixMate server. Check your connection and try again."
      );
      setIsSigningOut(false);
    }
  }

  const linkBase =
    "rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200";
  const linkInactive = `${linkBase} text-muted hover:bg-surface-muted hover:text-heading`;
  const linkActive = `${linkBase} bg-accent-50 text-accent-strong dark:bg-surface-muted dark:text-accent`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="container-page">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Brand */}
          <Link
            href="/"
            aria-label="FixMate — home"
            className="flex shrink-0 items-center gap-2.5 rounded-lg"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-accent-400 shadow-sm"
            >
              {/* Wrench — repair/technology inspired (Lucide-style stroke icon) */}
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 shrink-0"
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </span>
            <span className="text-xl font-bold tracking-tight">
              <span className="text-heading">Fix</span>
              <span className="text-accent-strong dark:text-accent">Mate</span>
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav aria-label="Main navigation" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                return (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={active ? linkActive : linkInactive}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Desktop actions */}
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <ThemeToggle />
            {isSessionPending && !sessionUser ? (
              /* Session unresolved — avoid flashing auth state */
              <div className="flex items-center gap-2" aria-hidden="true">
                <span className="h-9 w-9 animate-pulse rounded-full bg-surface-muted" />
                <span className="h-9 w-28 animate-pulse rounded-full bg-surface-muted" />
              </div>
            ) : sessionUser ? (
              /* Signed in — identity chip + sign out */
              <>
                <span
                  className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-4"
                  title={sessionUser.email}
                >
                  <InitialsAvatar name={sessionUser.name} email={sessionUser.email} />
                  <span className="max-w-[10rem] truncate text-sm font-semibold text-heading">
                    {displayName}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  aria-busy={isSigningOut}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-heading disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSigningOut ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Signing out…
                    </>
                  ) : (
                    <>
                      <SignOutIcon className="h-4 w-4" />
                      Sign Out
                    </>
                  )}
                </button>
              </>
            ) : (
              /* Signed out — auth entry points */
              <>
                <Link
                  href="/sign-in"
                  className="rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:text-heading"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile: theme toggle + menu toggle */}
          <div className="flex shrink-0 items-center gap-1 md:hidden">
            <ThemeToggle />
            <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-heading transition-colors duration-200 hover:bg-surface-muted"
          >
            {isMenuOpen ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
            </button>
          </div>
        </div>

        {/* Sign-out error — accessible inline message (Sonner is not installed) */}
        {signOutError && (
          <div
            role="alert"
            className="absolute right-4 top-full z-50 mt-2 w-[calc(100%-2rem)] max-w-sm rounded-lg border border-error/40 bg-error-soft px-4 py-3 text-sm text-error shadow-lg"
          >
            <div className="flex items-start gap-3">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span className="flex-1 leading-snug">{signOutError}</span>
              <button
                type="button"
                onClick={() => setSignOutError(null)}
                aria-label="Dismiss sign-out error"
                className="rounded-md p-1 transition-colors duration-200 hover:bg-error/10"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-4 w-4"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Mobile menu — absolute dropdown, overlays content (no layout shift) */}
        {isMenuOpen && (
          <div
            id="mobile-menu"
            className="absolute inset-x-0 top-full border-b border-border bg-surface shadow-lg md:hidden"
          >
            <nav aria-label="Mobile navigation" className="container-page py-4">
              <ul className="flex flex-col gap-1">
                {NAV_LINKS.map((link) => {
                  const active = isActive(link.href);
                  return (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setIsMenuOpen(false)}
                        className={`block rounded-lg px-4 py-3 text-base font-medium transition-colors duration-200 ${
                          active
                            ? "bg-accent-50 text-accent-strong dark:bg-surface-muted dark:text-accent"
                            : "text-foreground hover:bg-surface-muted hover:text-heading"
                        }`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                {isSessionPending && !sessionUser ? (
                  /* Session unresolved — avoid flashing auth state */
                  <div className="flex items-center gap-3 px-4 py-2" aria-hidden="true">
                    <span className="h-11 w-11 animate-pulse rounded-full bg-surface-muted" />
                    <span className="h-4 w-36 animate-pulse rounded bg-surface-muted" />
                  </div>
                ) : sessionUser ? (
                  /* Signed in — identity + sign out */
                  <>
                    <div className="flex items-center gap-3 rounded-lg bg-surface-muted/60 px-4 py-3">
                      <InitialsAvatar name={sessionUser.name} email={sessionUser.email} size="lg" />
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-heading">
                          {displayName}
                        </p>
                        <p className="truncate text-xs text-muted">{sessionUser.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      aria-busy={isSigningOut}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-base font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSigningOut ? (
                        <>
                          <Spinner className="h-5 w-5" />
                          Signing out…
                        </>
                      ) : (
                        <>
                          <SignOutIcon className="h-5 w-5" />
                          Sign Out
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  /* Signed out — auth entry points */
                  <>
                    <Link
                      href="/sign-in"
                      onClick={() => setIsMenuOpen(false)}
                      className="rounded-lg px-4 py-3 text-center text-base font-medium text-foreground transition-colors duration-200 hover:bg-surface-muted hover:text-heading"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/sign-up"
                      onClick={() => setIsMenuOpen(false)}
                      className="rounded-full bg-primary px-5 py-3 text-center text-base font-semibold text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary-hover"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
