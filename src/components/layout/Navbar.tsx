"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/layout/ThemeToggle";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "About Us", href: "/#about" },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
