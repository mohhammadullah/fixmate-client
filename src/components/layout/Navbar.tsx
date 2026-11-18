"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { authClient } from "@/lib/auth-client";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "About Us", href: "/about" },
] as const;

function DashboardIcon({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function ProfileIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Better Auth client session — the single source of truth for auth state.
  // `null` data means signed out; no tokens are stored manually anywhere.
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const sessionUser = session?.user ?? null;
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const isDashboardRoute =
    normalizedPathname === "/dashboard" ||
    normalizedPathname.startsWith("/dashboard/");

  const dashboardLinkBase =
    "inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.97]";
  const dashboardLinkActive = `${dashboardLinkBase} bg-accent-50 text-accent-strong dark:bg-surface-muted dark:text-accent`;
  const dashboardLinkInactive = `${dashboardLinkBase} text-muted hover:bg-surface-muted hover:text-heading active:bg-surface-muted active:text-heading`;

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

  const linkBase =
    "cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.97]";
  const linkInactive = `${linkBase} text-muted hover:bg-surface-muted hover:text-heading active:bg-surface-muted active:text-heading`;
  const linkActive = `${linkBase} bg-accent-50 text-accent-strong dark:bg-surface-muted dark:text-accent`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="container-page">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            aria-label="FixMate — home"
            className="flex shrink-0 items-center gap-2.5 rounded-lg transition-opacity duration-200 hover:opacity-80 active:opacity-60"
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
              <span
                aria-hidden="true"
                className="h-9 w-28 animate-pulse rounded-full bg-surface-muted"
              />
            ) : sessionUser ? (
              /* Signed in — dashboard + profile; identity + sign out live in the dashboard header */
              <>
                <Link
                  href="/dashboard"
                  aria-current={isDashboardRoute ? "page" : undefined}
                  className={
                    isDashboardRoute ? dashboardLinkActive : dashboardLinkInactive
                  }
                >
                  <DashboardIcon className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/profile"
                  aria-current={pathname === "/dashboard/profile" ? "page" : undefined}
                  className={
                    pathname === "/dashboard/profile" ? dashboardLinkActive : dashboardLinkInactive
                  }
                >
                  <ProfileIcon className="h-4 w-4" />
                  Profile
                </Link>
              </>
            ) : (
              /* Signed out — auth entry points */
              <>
                <Link
                  href="/sign-in"
                  className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-heading active:bg-surface-muted active:text-heading"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="cursor-pointer rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] active:bg-primary-hover"
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
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-heading transition-all duration-200 hover:bg-surface-muted active:scale-95 active:bg-surface-muted"
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
                        className={`block cursor-pointer rounded-lg px-4 py-3 text-base font-medium transition-colors duration-200 ${
                          active
                            ? "bg-accent-50 text-accent-strong dark:bg-surface-muted dark:text-accent"
                            : "text-foreground hover:bg-surface-muted hover:text-heading active:bg-surface-muted active:text-heading"
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
                  <div className="px-4 py-2" aria-hidden="true">
                    <span className="block h-4 w-36 animate-pulse rounded bg-surface-muted" />
                  </div>
                ) : sessionUser ? (
                  /* Signed in — dashboard + profile; identity + sign out live in the dashboard header */
                  <>
                    <Link
                      href="/dashboard"
                      aria-current={isDashboardRoute ? "page" : undefined}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-base font-semibold transition-colors duration-200 ${
                        isDashboardRoute
                          ? "bg-accent-50 text-accent-strong dark:bg-surface-muted dark:text-accent"
                          : "text-foreground hover:bg-surface-muted hover:text-heading active:bg-surface-muted active:text-heading"
                      }`}
                    >
                      <DashboardIcon className="h-5 w-5 shrink-0" />
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard/profile"
                      aria-current={pathname === "/dashboard/profile" ? "page" : undefined}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-base font-semibold transition-colors duration-200 ${
                        pathname === "/dashboard/profile"
                          ? "bg-accent-50 text-accent-strong dark:bg-surface-muted dark:text-accent"
                          : "text-foreground hover:bg-surface-muted hover:text-heading active:bg-surface-muted active:text-heading"
                      }`}
                    >
                      <ProfileIcon className="h-5 w-5 shrink-0" />
                      Profile
                    </Link>
                  </>
                ) : (
                  /* Signed out — auth entry points */
                  <>
                    <Link
                      href="/sign-in"
                      onClick={() => setIsMenuOpen(false)}
                      className="cursor-pointer rounded-lg px-4 py-3 text-center text-base font-medium text-foreground transition-colors duration-200 hover:bg-surface-muted hover:text-heading active:bg-surface-muted active:text-heading"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/sign-up"
                      onClick={() => setIsMenuOpen(false)}
                      className="cursor-pointer rounded-full bg-primary px-5 py-3 text-center text-base font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] active:bg-primary-hover"
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
