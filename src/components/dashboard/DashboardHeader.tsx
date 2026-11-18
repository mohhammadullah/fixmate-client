"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ROLE_LABELS, type DashboardRole } from "@/components/dashboard/DashboardSidebar";
import NotificationBell from "@/components/dashboard/NotificationBell";

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

const ROLE_BADGE_STYLES: Record<DashboardRole, string> = {
  customer:
    "border-accent-500/40 bg-accent-50 text-accent-strong dark:border-accent-400/30 dark:bg-accent-400/10 dark:text-accent",
  technician: "border-success/40 bg-success-soft text-success",
  admin: "border-warning/40 bg-warning-soft text-warning",
};

function RoleBadge({ role }: { role: DashboardRole | null }) {
  const label = role ? ROLE_LABELS[role] : "Unknown role";
  const styles = role
    ? ROLE_BADGE_STYLES[role]
    : "border-border bg-surface-muted text-muted";
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${styles}`}
    >
      {label}
    </span>
  );
}

export default function DashboardHeader({
  user,
  role,
  sidebarOpen,
  onMenuToggle,
}: {
  user: { name?: string | null; email?: string | null };
  role: DashboardRole | null;
  sidebarOpen: boolean;
  onMenuToggle: () => void;
}) {
  const router = useRouter();
  const displayName = user.name?.trim() || user.email || "";

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  // Auto-dismiss the sign-out error after 8 seconds.
  useEffect(() => {
    if (!signOutError) return;
    const timeout = window.setTimeout(() => setSignOutError(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [signOutError]);

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
      // Refresh server components and let the client session atom settle —
      // the dashboard layout reacts to the signed-out session and redirects.
      router.refresh();
      setIsSigningOut(false);
    } catch {
      setSignOutError(
        "Couldn't reach the FixMate server. Check your connection and try again."
      );
      setIsSigningOut(false);
    }
  }

  return (
    <header className="sticky top-16 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="relative flex h-16 items-center gap-3 px-4 sm:gap-4 sm:px-6">
        {/* Mobile drawer toggle */}
        <button
          type="button"
          onClick={onMenuToggle}
          aria-expanded={sidebarOpen}
          aria-controls="dashboard-sidebar"
          aria-label={sidebarOpen ? "Close dashboard navigation" : "Open dashboard navigation"}
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-heading transition-all duration-200 hover:bg-surface-muted active:scale-95 active:bg-surface-muted lg:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-6 w-6"
          >
            {sidebarOpen ? (
              <path d="M18 6 6 18M6 6l12 12" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Page context */}
        <div className="hidden min-w-0 sm:block">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
            Dashboard
          </p>
          <p className="truncate text-sm font-semibold text-heading">
            FixMate Workspace
          </p>
        </div>

        {/* Identity + notifications + sign out */}
        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
          <NotificationBell />
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <span
              aria-hidden="true"
              title={user.email ?? undefined}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-accent-foreground ring-2 ring-accent-500/30 sm:h-10 sm:w-10"
            >
              {initialsFor(user.name, user.email)}
            </span>
            <span className="min-w-0">
              <span className="block max-w-[8.5rem] truncate text-sm font-semibold leading-tight text-heading sm:max-w-[12rem]">
                {displayName}
              </span>
              <RoleBadge role={role} />
            </span>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            aria-busy={isSigningOut}
            aria-label={isSigningOut ? "Signing out" : "Sign out"}
            className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-border px-3 text-sm font-semibold text-heading transition-all duration-200 enabled:hover:bg-surface-muted enabled:active:scale-[0.98] enabled:active:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-70 sm:px-4"
          >
            {isSigningOut ? (
              <>
                <Spinner className="h-4 w-4" />
                <span className="hidden sm:inline">Signing out…</span>
              </>
            ) : (
              <>
                <SignOutIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </>
            )}
          </button>
        </div>

        {/* Sign-out error — accessible inline message (Sonner is not installed) */}
        {signOutError && (
          <div
            role="alert"
            className="absolute right-4 top-full z-40 mt-2 w-[calc(100%-2rem)] max-w-sm rounded-lg border border-error/40 bg-error-soft px-4 py-3 text-sm text-error shadow-lg"
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
                className="cursor-pointer rounded-md p-1 transition-all duration-200 hover:bg-error/10 active:scale-90 active:bg-error/20"
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
      </div>
    </header>
  );
}
