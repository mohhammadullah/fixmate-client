"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { disconnectSocket } from "@/lib/socket";
import ProfileAvatar from "@/components/ui/ProfileAvatar";

export interface SessionUserLike {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

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

/** Avatar image with graceful fallback to a polished initials-on-navy avatar. */
export function UserAvatar({
  user,
  className = "h-9 w-9 text-[11px]",
}: {
  user: SessionUserLike;
  className?: string;
}) {
  const name = user.name?.trim() ?? "";
  return (
    <ProfileAvatar
      image={typeof user.image === "string" ? user.image : null}
      name={name}
      email={user.email}
      className={`${className} ring-1 ring-inset ring-border-strong`}
    />
  );
}

/** Shared sign-out logic: pending state, inline error, post-sign-out redirect. */
function useSignOut() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      await authClient.signOut();
      // The global auth session is gone — tear down the shared authenticated
      // socket so no notifications or chat state leak into a later account.
      disconnectSocket();
      router.push("/");
      router.refresh();
    } catch {
      setSignOutError("Couldn't sign you out. Please try again.");
      setIsSigningOut(false);
    }
  }, [isSigningOut, router]);

  return { signOut, isSigningOut, signOutError };
}

const menuItemClass =
  "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-surface-muted hover:text-heading focus-visible:bg-surface-muted focus-visible:outline-none active:bg-surface-muted";

/**
 * Desktop account dropdown for the navbar: trigger is the user's avatar,
 * the menu lists Dashboard, Profile and Sign Out.
 *
 * Accessibility: `aria-haspopup`/`aria-expanded`/`aria-controls` on the
 * trigger, `role="menu"` with `role="menuitem"` children, Arrow/Home/End
 * roving focus, Escape closes and refocuses the trigger, Tab closes without
 * trapping, outside `pointerdown` closes, and the menu closes on route
 * change.
 */
export default function UserAvatarMenu({ user }: { user: SessionUserLike }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { signOut, isSigningOut, signOutError } = useSignOut();

  // Close on route change (Adjust state during render — no effect needed).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setIsOpen(false);
  }

  // Outside pointerdown + Escape handling while open.
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  // Move focus to the first menu item when the menu opens.
  useEffect(() => {
    if (!isOpen) return;
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
  }, [isOpen]);

  function focusMenuItem(index: number) {
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!items || items.length === 0) return;
    const wrapped = ((index % items.length) + items.length) % items.length;
    items[wrapped]?.focus();
  }

  function currentItemIndex(): number {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    return items.findIndex((item) => item === document.activeElement);
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || (event.key === "Enter" && !isOpen)) {
      if (event.key === "ArrowDown") event.preventDefault();
      setIsOpen(true);
    }
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const current = currentItemIndex();
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusMenuItem(current + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusMenuItem(current - 1);
        break;
      case "Home":
        event.preventDefault();
        focusMenuItem(0);
        break;
      case "End": {
        event.preventDefault();
        const items = menuRef.current?.querySelectorAll('[role="menuitem"]');
        focusMenuItem((items?.length ?? 1) - 1);
        break;
      }
      case "Tab":
        setIsOpen(false);
        break;
      default:
        break;
    }
  }

  const displayName = user.name?.trim() || "Your account";
  const email = user.email?.trim() || "";

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="user-account-menu"
        aria-label={displayName ? `Account menu for ${displayName}` : "Account menu"}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-all duration-200 hover:ring-2 hover:ring-accent-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 active:scale-95"
      >
        <UserAvatar user={user} />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          id="user-account-menu"
          role="menu"
          aria-label="Account"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-2xl border border-border bg-surface p-2 shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-border px-3 pb-3 pt-2">
            <UserAvatar user={user} className="h-10 w-10 text-xs" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-heading" title={displayName}>
                {displayName}
              </p>
              {email && (
                <p className="truncate text-xs text-muted" title={email}>
                  {email}
                </p>
              )}
            </div>
          </div>

          <div className="mt-1.5 flex flex-col gap-0.5">
            <Link role="menuitem" tabIndex={-1} href="/dashboard" className={menuItemClass}>
              <DashboardIcon className="h-4 w-4 shrink-0 text-accent-strong dark:text-accent" />
              Dashboard
            </Link>
            <Link role="menuitem" tabIndex={-1} href="/dashboard/profile" className={menuItemClass}>
              <ProfileIcon className="h-4 w-4 shrink-0 text-accent-strong dark:text-accent" />
              Profile
            </Link>
          </div>

          <div className="mt-1.5 border-t border-border pt-1.5">
            <button
              role="menuitem"
              tabIndex={-1}
              type="button"
              disabled={isSigningOut}
              onClick={() => void signOut()}
              className={`${menuItemClass} text-error hover:bg-error-soft hover:text-error disabled:cursor-wait disabled:opacity-70`}
            >
              <SignOutIcon className="h-4 w-4 shrink-0" />
              {isSigningOut ? "Signing out…" : "Sign Out"}
            </button>
            {signOutError && (
              <p role="alert" className="px-3 pb-1.5 pt-2 text-xs leading-5 text-error">
                {signOutError}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Mobile inline account section for the hamburger menu: identity header plus
 * Dashboard / Profile / Sign Out rows. Regular links (not menu roles) so
 * tab/arrow navigation stays natural on touch and keyboard alike.
 */
export function UserAccountSection({ user }: { user: SessionUserLike }) {
  const { signOut, isSigningOut, signOutError } = useSignOut();
  const displayName = user.name?.trim() || "Your account";
  const email = user.email?.trim() || "";

  const rowClass =
    "flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-base font-medium text-foreground transition-colors duration-150 hover:bg-surface-muted hover:text-heading focus-visible:bg-surface-muted focus-visible:outline-none active:bg-surface-muted";

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-center gap-3 px-4 pb-3 pt-1">
        <UserAvatar user={user} className="h-11 w-11 text-xs" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-heading" title={displayName}>
            {displayName}
          </p>
          {email && (
            <p className="truncate text-xs text-muted" title={email}>
              {email}
            </p>
          )}
        </div>
      </div>
      <nav aria-label="Account">
        <ul className="flex flex-col gap-1">
          <li>
            <Link href="/dashboard" className={rowClass}>
              <DashboardIcon className="h-5 w-5 shrink-0 text-accent-strong dark:text-accent" />
              Dashboard
            </Link>
          </li>
          <li>
            <Link href="/dashboard/profile" className={rowClass}>
              <ProfileIcon className="h-5 w-5 shrink-0 text-accent-strong dark:text-accent" />
              Profile
            </Link>
          </li>
          <li>
            <button
              type="button"
              disabled={isSigningOut}
              onClick={() => void signOut()}
              className={`${rowClass} w-full text-error disabled:cursor-wait disabled:opacity-70`}
            >
              <SignOutIcon className="h-5 w-5 shrink-0" />
              {isSigningOut ? "Signing out…" : "Sign Out"}
            </button>
          </li>
        </ul>
      </nav>
      {signOutError && (
        <p role="alert" className="px-4 pb-1 pt-1 text-xs leading-5 text-error">
          {signOutError}
        </p>
      )}
    </div>
  );
}
