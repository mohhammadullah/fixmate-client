"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* ================================================================== */
/*  Role handling — read from the Better Auth session at runtime.      */
/*                                                                     */
/*  `role` is a server-managed additional field that the auth client   */
/*  intentionally does not infer (it is `input: false` on the server), */
/*  so we narrow it defensively here instead of casting blindly.       */
/*  Unknown or missing roles never receive privileged navigation.      */
/* ================================================================== */

export type DashboardRole = "customer" | "technician" | "admin";

export const ROLE_LABELS: Record<DashboardRole, string> = {
  customer: "Customer",
  technician: "Technician",
  admin: "Administrator",
};

export function parseDashboardRole(value: unknown): DashboardRole | null {
  return value === "customer" || value === "technician" || value === "admin"
    ? value
    : null;
}

/** Extract the dashboard role from a Better Auth session user object. */
export function roleFromUser(user: unknown): DashboardRole | null {
  if (!user || typeof user !== "object") return null;
  return parseDashboardRole((user as Record<string, unknown>).role);
}

/* ================================================================== */
/*  Navigation model                                                   */
/* ================================================================== */

type GlyphProps = { className?: string };

function NavGlyph({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

const OverviewGlyph = ({ className }: GlyphProps) => (
  <NavGlyph className={className}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </NavGlyph>
);

const RepairRequestsGlyph = ({ className }: GlyphProps) => (
  <NavGlyph className={className}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </NavGlyph>
);

const ReceiptGlyph = ({ className }: GlyphProps) => (
  <NavGlyph className={className}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M8 7h8M8 12h8M8 17h4" />
  </NavGlyph>
);

const ProfileGlyph = ({ className }: GlyphProps) => (
  <NavGlyph className={className}>
    <circle cx="12" cy="7.5" r="4" />
    <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
  </NavGlyph>
);

const BriefcaseGlyph = ({ className }: GlyphProps) => (
  <NavGlyph className={className}>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
  </NavGlyph>
);

const InboxGlyph = ({ className }: GlyphProps) => (
  <NavGlyph className={className}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
  </NavGlyph>
);

const UsersGlyph = ({ className }: GlyphProps) => (
  <NavGlyph className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </NavGlyph>
);

const LayersGlyph = ({ className }: GlyphProps) => (
  <NavGlyph className={className}>
    <path d="m12 2 10 5-10 5L2 7l10-5Z" />
    <path d="m2 12 10 5 10-5" />
    <path d="m2 17 10 5 10-5" />
  </NavGlyph>
);

const CalendarGlyph = ({ className }: GlyphProps) => (
  <NavGlyph className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </NavGlyph>
);

const CreditCardGlyph = ({ className }: GlyphProps) => (
  <NavGlyph className={className}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
    <path d="M6 15h4" />
  </NavGlyph>
);

export type DashboardNavItem = {
  label: string;
  href: string;
  /** Short, honest description — reused by the landing page link cards. */
  description: string;
  icon: (props: GlyphProps) => React.ReactElement;
};

const OVERVIEW_ITEM: DashboardNavItem = {
  label: "Overview",
  href: "/dashboard",
  description: "The hub of your FixMate workspace.",
  icon: OverviewGlyph,
};

export const DASHBOARD_NAV: Record<DashboardRole, DashboardNavItem[]> = {
  customer: [
    OVERVIEW_ITEM,
    {
      label: "My Bookings",
      href: "/dashboard/bookings",
      description: "Track your repair bookings, status and payment.",
      icon: RepairRequestsGlyph,
    },
    {
      label: "Payment History",
      href: "/dashboard/payments",
      description: "Review your past payments and receipts.",
      icon: ReceiptGlyph,
    },
    {
      label: "Profile",
      href: "/dashboard/profile",
      description: "Your personal details and account settings.",
      icon: ProfileGlyph,
    },
  ],
  technician: [
    OVERVIEW_ITEM,
    {
      label: "My Services",
      href: "/dashboard/my-services",
      description: "Manage the services you offer to customers.",
      icon: BriefcaseGlyph,
    },
    {
      label: "Incoming Requests",
      href: "/dashboard/requests",
      description: "Service requests waiting for your attention.",
      icon: InboxGlyph,
    },
    {
      label: "Profile",
      href: "/dashboard/profile",
      description: "Your personal details and account settings.",
      icon: ProfileGlyph,
    },
  ],
  admin: [
    OVERVIEW_ITEM,
    {
      label: "Manage Users",
      href: "/dashboard/users",
      description: "Accounts, roles and access across FixMate.",
      icon: UsersGlyph,
    },
    {
      label: "Manage Services",
      href: "/dashboard/services",
      description: "The service catalog FixMate offers.",
      icon: LayersGlyph,
    },
    {
      label: "All Bookings",
      href: "/dashboard/bookings",
      description: "Every booking across the platform, in one view.",
      icon: CalendarGlyph,
    },
    {
      label: "Payments",
      href: "/dashboard/payments",
      description: "Payments and payouts across FixMate.",
      icon: CreditCardGlyph,
    },
  ],
};

/** Unknown or missing roles only ever get the non-privileged Overview. */
export const FALLBACK_NAV_ITEMS: DashboardNavItem[] = [OVERVIEW_ITEM];

export function navItemsForRole(role: DashboardRole | null): DashboardNavItem[] {
  return role ? DASHBOARD_NAV[role] : FALLBACK_NAV_ITEMS;
}

/* ================================================================== */
/*  Sidebar                                                            */
/* ================================================================== */

function isItemActive(pathname: string, href: string): boolean {
  const current = pathname.replace(/\/+$/, "") || "/";
  if (href === "/dashboard") return current === "/dashboard";
  return current === href || current.startsWith(`${href}/`);
}

function SidebarContent({
  role,
  onNavigate,
}: {
  role: DashboardRole | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = navItemsForRole(role);

  return (
    <div className="flex h-full flex-col">
      {/* Workspace mark */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-5">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-accent-400 shadow-sm ring-1 ring-inset ring-accent-400/30"
        >
          <RepairRequestsGlyph className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold leading-tight text-heading">
            Dashboard
          </span>
          <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            FixMate Workspace
          </span>
        </span>
      </div>

      {/* Navigation */}
      <nav
        aria-label="Dashboard navigation"
        className="flex-1 overflow-y-auto px-3 py-5"
      >
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
          {role ? `${ROLE_LABELS[role]} menu` : "Menu"}
        </p>
        <ul className="mt-2 flex flex-col gap-1">
          {items.map((item) => {
            const active = isItemActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                    active
                      ? "bg-accent-50 text-accent-strong ring-1 ring-inset ring-accent-500/30 dark:bg-accent-400/10 dark:text-accent dark:ring-accent-400/25"
                      : "text-foreground hover:bg-surface-muted hover:text-heading"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 transition-colors duration-200 ${
                      active
                        ? "text-accent-strong dark:text-accent"
                        : "text-muted group-hover:text-heading"
                    }`}
                  />
                  <span className="min-w-0 truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {!role && (
          <p className="mt-4 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2.5 text-xs leading-snug text-warning">
            We couldn&apos;t recognize your account role, so only Overview is
            available. Please contact FixMate support if this looks wrong.
          </p>
        )}
      </nav>

      {/* Honest footer note */}
      <div className="border-t border-border px-5 py-4">
        <p className="text-[11px] leading-snug text-muted">
          Protected workspace — navigation here is a convenience only. Access
          is enforced by the FixMate server.
        </p>
      </div>
    </div>
  );
}

export default function DashboardSidebar({
  open,
  onClose,
  role,
}: {
  open: boolean;
  onClose: () => void;
  role: DashboardRole | null;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Escape closes the mobile drawer; lock body scroll while it is open.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <>
      {/* Desktop — static column, sticky under the global navbar (h-16) */}
      <aside
        aria-label="Dashboard sidebar"
        className="hidden w-72 shrink-0 border-r border-border bg-surface/60 lg:block"
      >
        <div className="sticky top-16 h-[calc(100svh-4rem)] overflow-hidden">
          <SidebarContent role={role} />
        </div>
      </aside>

      {/* Mobile / tablet — drawer + overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onClose}
            className="absolute inset-0 h-full w-full cursor-default bg-navy-950/70 backdrop-blur-sm"
          />
          <div
            id="dashboard-sidebar"
            role="dialog"
            aria-modal="true"
            aria-label="Dashboard navigation"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-lg"
          >
            <div className="flex items-center justify-end border-b border-border px-3 py-2.5">
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close sidebar"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-heading transition-colors duration-200 hover:bg-surface-muted"
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
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <SidebarContent role={role} onNavigate={onClose} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
