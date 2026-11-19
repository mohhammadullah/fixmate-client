"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import DashboardSidebar, {
  roleFromUser,
} from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

/**
 * Protected dashboard shell.
 *
 * Client-side protection only — it exists for navigation and user experience.
 * The FixMate backend remains the single authority on authorization; nothing
 * here (or in localStorage, or in any manually stored token) grants access.
 */

function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-1" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>

      {/* Sidebar skeleton */}
      <div
        aria-hidden="true"
        className="hidden w-72 shrink-0 border-r border-border lg:block"
      >
        <div className="flex h-[calc(100svh-4rem)] flex-col gap-6 p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-surface-muted" />
            <div className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-surface-muted" />
              <div className="h-3 w-20 animate-pulse rounded bg-surface-muted" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-16 animate-pulse rounded bg-surface-muted" />
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="h-11 animate-pulse rounded-xl bg-surface-muted"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Header + content skeleton */}
      <div aria-hidden="true" className="min-w-0 flex-1">
        <div className="flex h-16 items-center justify-between gap-4 border-b border-border px-4 sm:px-6">
          <div className="h-4 w-28 animate-pulse rounded bg-surface-muted" />
          <div className="flex items-center gap-3">
            <div className="hidden h-8 w-24 animate-pulse rounded-full bg-surface-muted sm:block" />
            <div className="h-10 w-10 animate-pulse rounded-full bg-surface-muted" />
            <div className="h-10 w-24 animate-pulse rounded-full bg-surface-muted" />
          </div>
        </div>
        <div className="space-y-6 p-4 sm:p-8">
          <div className="h-44 animate-pulse rounded-2xl bg-surface-muted/70" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl bg-surface-muted/70"
              />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-2xl bg-surface-muted/70" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const router = useRouter();
  // Better Auth client session — the single source of truth for auth state.
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sessionUser = session?.user ?? null;
  const role = roleFromUser(sessionUser);

  useEffect(() => {
    if (!isSessionPending && !session) {
      router.replace("/sign-in");
    }
  }, [isSessionPending, session, router]);

  // Session unresolved — render an honest skeleton, never the content.
  if (isSessionPending) {
    return <DashboardSkeleton label="Checking your session…" />;
  }

  // Confirmed signed out — the redirect effect is already running; keep
  // rendering the skeleton so nothing private flashes in the meantime.
  if (!sessionUser) {
    return <DashboardSkeleton label="Redirecting to sign in…" />;
  }

  return (
    <div className="flex flex-1 bg-background">
      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={role}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          user={{ name: sessionUser.name, email: sessionUser.email, image: sessionUser.image }}
          role={role}
          sidebarOpen={sidebarOpen}
          onMenuToggle={() => setSidebarOpen((open) => !open)}
        />
        <main id="dashboard-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
