"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { roleFromUser } from "@/components/dashboard/DashboardSidebar";
import { type BookingsPagination } from "@/components/dashboard/MyBookings";
import {
  ALL_SERVICE_CATEGORIES as SERVICE_CATEGORIES,
  type AnyServiceCategory as ServiceCategory,
} from "@/lib/service-categories";

/* Types mirror the backend GET /api/services/my DTO:
 * { success, data, pagination }; dates serialize as strings. Internal
 * fields (technicianId, availabilityStatus, rejectionReason, ...) are
 * deliberately excluded by the backend. */

export const SERVICE_APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type ServiceApprovalStatus = (typeof SERVICE_APPROVAL_STATUSES)[number];

export interface TechnicianService {
  /** Mongo ObjectId hex string. */
  id: string;
  title: string;
  category: ServiceCategory;
  location: string;
  image: string;
  hourlyRate: number;
  securityDeposit: number;
  maxCapacity: number;
  amenities: string[];
  overview: string;
  approvalStatus: ServiceApprovalStatus;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ServicesPageData {
  items: TechnicianService[];
  pagination: BookingsPagination;
}

type ServicesErrorKind =
  | "unauthorized"
  | "forbidden"
  | "notfound"
  | "conflict"
  | "badrequest"
  | "network"
  | "server"
  | "parse";

class ServicesError extends Error {
  readonly kind: ServicesErrorKind;
  constructor(kind: ServicesErrorKind, message: string) {
    super(message);
    this.name = "ServicesError";
    this.kind = kind;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const PAGE_SIZE = 9;

type ApprovalStatusFilter = ServiceApprovalStatus | "all";
type AvailabilityFilter = "all" | "available" | "unavailable";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ServicesError("parse", "The server returned an unexpected service payload.");
  }
  return value;
}

function requiredFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ServicesError("parse", "The server returned an unexpected service payload.");
  }
  return value;
}

function requiredEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[]
): T {
  const value = record[key];
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new ServicesError("parse", "The server returned an unknown value in a service field.");
  }
  return value as T;
}

function parseTechnicianService(raw: unknown): TechnicianService {
  if (!isRecord(raw)) {
    throw new ServicesError("parse", "The server returned an unexpected service payload.");
  }
  const amenities = Array.isArray(raw.amenities)
    ? raw.amenities.filter((item): item is string => typeof item === "string")
    : [];

  return {
    id: requiredString(raw, "id"),
    title: requiredString(raw, "title"),
    category: requiredEnum(raw, "category", SERVICE_CATEGORIES),
    location: requiredString(raw, "location"),
    image: typeof raw.image === "string" ? raw.image : "",
    hourlyRate: requiredFiniteNumber(raw, "hourlyRate"),
    securityDeposit:
      typeof raw.securityDeposit === "number" && Number.isFinite(raw.securityDeposit)
        ? raw.securityDeposit
        : 0,
    maxCapacity: requiredFiniteNumber(raw, "maxCapacity"),
    amenities,
    overview: typeof raw.overview === "string" ? raw.overview : "",
    approvalStatus: requiredEnum(raw, "approvalStatus", SERVICE_APPROVAL_STATUSES),
    isAvailable: raw.isAvailable === true,
    createdAt: requiredString(raw, "createdAt"),
    updatedAt: requiredString(raw, "updatedAt"),
  };
}

function parsePagination(raw: unknown): BookingsPagination {
  if (!isRecord(raw)) {
    throw new ServicesError("parse", "The server returned an unexpected pagination payload.");
  }
  const currentPage = requiredFiniteNumber(raw, "currentPage");
  const limit = requiredFiniteNumber(raw, "limit");
  const totalItems = requiredFiniteNumber(raw, "totalItems");
  const totalPages = requiredFiniteNumber(raw, "totalPages");
  if (typeof raw.hasNextPage !== "boolean" || typeof raw.hasPrevPage !== "boolean") {
    throw new ServicesError("parse", "The server returned an unexpected pagination payload.");
  }
  return {
    currentPage,
    limit,
    totalItems,
    totalPages,
    hasNextPage: raw.hasNextPage,
    hasPrevPage: raw.hasPrevPage,
  };
}

function parseServicesResponse(body: unknown): ServicesPageData {
  if (!isRecord(body)) {
    throw new ServicesError("parse", "The server returned an unexpected response.");
  }
  if (body.success !== true) {
    const message =
      typeof body.message === "string" && body.message.length > 0 && body.message.length <= 200
        ? body.message
        : "The server couldn't load your services.";
    throw new ServicesError("server", message);
  }
  if (!Array.isArray(body.data)) {
    throw new ServicesError("parse", "The server returned an unexpected services payload.");
  }
  return {
    items: body.data.map(parseTechnicianService),
    pagination: parsePagination(body.pagination),
  };
}

/** Retrieve a short-lived JWT from the Better Auth server (`/api/auth/token`,
 *  session-cookie gated). Returns the token string only. */
async function fetchAccessToken(): Promise<string> {
  let response: {
    data: unknown;
    error: null | ({ status: number } & Record<string, unknown>);
  };
  try {
    // `Res` tells the unschema'd endpoint what the 200 body looks like;
    // the shape is narrowed at runtime below regardless.
    response = await authClient.$fetch<{ token: string }>("/token", {
      method: "GET",
    });
  } catch {
    throw new ServicesError(
      "network",
      "Couldn't reach the FixMate server to verify your session. Check your connection and try again."
    );
  }

  if (response.error) {
    const status = response.error.status;
    if (status === 401 || status === 403) {
      throw new ServicesError(
        "unauthorized",
        "Your session has expired. Sign in again to manage your services."
      );
    }
    throw new ServicesError(
      "server",
      "We couldn't verify your session with FixMate right now. Please try again."
    );
  }

  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new ServicesError(
      "parse",
      "The FixMate server returned an unexpected session-token response."
    );
  }
  return data.token;
}

async function fetchMyServices(options: {
  page: number;
  limit: number;
  approvalStatus: ApprovalStatusFilter;
  availability: AvailabilityFilter;
  signal: AbortSignal;
}): Promise<ServicesPageData> {
  const token = await fetchAccessToken();

  const params = new URLSearchParams({
    page: String(options.page),
    limit: String(options.limit),
  });
  if (options.approvalStatus !== "all") {
    params.set("approvalStatus", options.approvalStatus);
  }
  if (options.availability !== "all") {
    params.set("isAvailable", options.availability === "available" ? "true" : "false");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/services/my?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ServicesError(
      "network",
      "Couldn't reach the FixMate server. Check your connection and try again."
    );
  }

  if (response.status === 401) {
    throw new ServicesError(
      "unauthorized",
      "Your session has expired. Sign in again to manage your services."
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Handled below — a non-JSON error page or empty body.
  }

  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.message === "string" && body.message.length <= 200
        ? body.message
        : "The server couldn't load your services. Please try again.";
    throw new ServicesError("server", message);
  }

  return parseServicesResponse(body);
}

/** DELETE /api/services/:id — technician deletes their own service.
 *  Ownership is enforced server-side by the `{_id, technicianId}` filter.
 *  JWT is retrieved per call (never stored/logged); no ownership field is
 *  ever sent. Backend: 200 {success,message} | 400 | 401 | 403 | 404. */
async function deleteServiceRequest(serviceId: string): Promise<string> {
  const token = await fetchAccessToken();

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE}/api/services/${encodeURIComponent(serviceId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      }
    );
  } catch {
    throw new ServicesError(
      "network",
      "Couldn't reach the FixMate server. Check your connection and try again."
    );
  }

  if (response.status === 401) {
    throw new ServicesError(
      "unauthorized",
      "Your session has expired. Sign in again to manage your services."
    );
  }
  if (response.status === 403) {
    throw new ServicesError(
      "forbidden",
      "Technician access only. This account isn't allowed to delete services."
    );
  }
  if (response.status === 404) {
    throw new ServicesError(
      "notfound",
      "This service could not be found. It may have already been removed."
    );
  }
  if (response.status === 409) {
    throw new ServicesError(
      "conflict",
      "This service can't be deleted right now. Please try again."
    );
  }
  if (response.status === 400) {
    throw new ServicesError("badrequest", "Invalid service reference. Refresh the list and try again.");
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON body — handled below.
  }

  const serverMessage =
    isRecord(body) &&
    typeof body.message === "string" &&
    body.message.length > 0 &&
    body.message.length <= 200
      ? body.message
      : null;

  if (!response.ok || (isRecord(body) && body.success === false)) {
    throw new ServicesError(
      "server",
      serverMessage ?? "The server couldn't delete this service. Please try again."
    );
  }

  return serverMessage ?? "Service deleted successfully.";
}

/** Remove a deleted service from the loaded page data and keep the
 *  pagination metadata consistent with the smaller result set. */
function applyDeletion(
  data: ServicesPageData,
  serviceId: string
): { data: ServicesPageData; needsRefetch: boolean } {
  const items = data.items.filter((item) => item.id !== serviceId);
  const totalItems = Math.max(0, data.pagination.totalItems - 1);
  const totalPages = Math.max(1, Math.ceil(totalItems / data.pagination.limit));
  const currentPage = Math.min(data.pagination.currentPage, totalPages);

  // When the last card of a later page is deleted, the current page number
  // shifts — refetch so the visible items match the new page.
  const needsRefetch = items.length === 0 && data.pagination.currentPage > 1;

  return {
    data: {
      items,
      pagination: {
        ...data.pagination,
        currentPage,
        totalItems,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    },
    needsRefetch,
  };
}


const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatServiceDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return dateFormatter.format(date);
}

/** Plain localized number — the backend carries no currency metadata, so
 *  no currency symbol is invented here. */
function formatAmount(value: number): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}

const APPROVAL_LABELS: Record<ServiceApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const APPROVAL_STYLES: Record<ServiceApprovalStatus, string> = {
  pending: "border-warning/40 bg-warning-soft text-warning",
  approved: "border-success/40 bg-success-soft text-success",
  rejected: "border-error/40 bg-error-soft text-error",
};

const AVAILABILITY_LABELS = {
  available: "Available",
  unavailable: "Unavailable",
} as const;

const AVAILABILITY_STYLES = {
  available: "border-success/40 bg-success-soft text-success",
  unavailable: "border-border-strong bg-surface-muted text-muted",
} as const;

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] backdrop-blur-sm ${className}`}
    >
      {label}
    </span>
  );
}


function DeleteServiceDialog({
  service,
  pending,
  error,
  onDismiss,
  onConfirm,
}: {
  service: TechnicianService;
  pending: boolean;
  error: string | null;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const keepServiceRef = useRef<HTMLButtonElement>(null);
  const onDismissRef = useRef(onDismiss);
  const pendingRef = useRef(pending);

  // Keep refs current for the mount-only listeners below.
  useEffect(() => {
    onDismissRef.current = onDismiss;
    pendingRef.current = pending;
  }, [onDismiss, pending]);

  // Mount-only: initial focus on the safe action, scroll lock, Escape to
  // dismiss and a Tab focus trap inside the dialog.
  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    keepServiceRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!pendingRef.current) onDismissRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const focusOutside = !(active instanceof HTMLElement) || !node.contains(active);
      if (event.shiftKey) {
        if (active === first || focusOutside) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || focusOutside) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6">
      {/* Backdrop — click to dismiss (ignored while the request is in flight) */}
      <div
        aria-hidden="true"
        onClick={() => {
          if (!pendingRef.current) onDismissRef.current();
        }}
        className="absolute inset-0 bg-navy-950/70 backdrop-blur-[2px]"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-service-title"
        aria-describedby="delete-service-description"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-error/40 bg-error-soft text-error"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 id="delete-service-title" className="text-base font-bold leading-snug text-heading">
                Delete this service?
              </h2>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                FixMate · My Services
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            disabled={pending}
            aria-label="Close dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors duration-200 enabled:hover:bg-surface-muted enabled:hover:text-heading cursor-pointer enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <p id="delete-service-description" className="text-sm leading-relaxed text-foreground">
            This action cannot be undone. The service{" "}
            <span className="font-semibold text-heading">{service.title}</span> will be
            permanently removed, along with its details and availability. Customers
            will no longer be able to find or book it.
          </p>
          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-error/40 bg-error-soft/60 px-4 py-3 text-xs leading-relaxed text-error"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button
            ref={keepServiceRef}
            type="button"
            onClick={onDismiss}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted cursor-pointer enabled:active:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            aria-live="polite"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-error px-5 py-2.5 text-sm font-semibold text-background shadow-sm transition-all duration-200 enabled:hover:brightness-95 cursor-pointer enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin motion-reduce:animate-none"
                >
                  <circle cx="12" cy="12" r="9" strokeOpacity="0.3" />
                  <path d="M21 12a9 9 0 0 0-9-9" />
                </svg>
                Deleting…
              </>
            ) : (
              "Delete service"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


function AddNewServiceButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/dashboard/my-services/add"
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98] sm:px-5 sm:text-sm ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-4 w-4"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span className="hidden sm:inline">Add New Service</span>
      <span className="sr-only">(opens the add service page)</span>
    </Link>
  );
}


function ServicesSkeleton() {
  return (
    <div role="status" aria-label="Loading your services…" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <span className="sr-only">Loading your services…</span>
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="overflow-hidden rounded-2xl border border-border bg-surface"
        >
          <div className="h-40 animate-pulse bg-surface-muted" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-surface-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-muted" />
            <div className="flex gap-4 border-t border-border pt-3">
              <div className="h-8 w-16 animate-pulse rounded bg-surface-muted" />
              <div className="h-8 w-16 animate-pulse rounded bg-surface-muted" />
              <div className="h-8 w-16 animate-pulse rounded bg-surface-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorPanel({
  error,
  onRetry,
}: {
  error: ServicesError;
  onRetry: () => void;
}) {
  const unauthorized = error.kind === "unauthorized";
  return (
    <div
      role="alert"
      className="rounded-2xl border border-error/40 bg-error-soft/60 px-5 py-6 text-center sm:px-8"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mx-auto h-9 w-9 text-error"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <h2 className="mt-3 text-lg font-bold text-heading">
        {unauthorized ? "Session expired" : "Couldn't load your services"}
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
        {error.message}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {unauthorized ? (
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]"
          >
            Sign in again
          </Link>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ filtered, onClearFilter }: { filtered: boolean; onClearFilter: () => void }) {
  if (filtered) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted/30 px-6 py-12 text-center">
        <h2 className="text-lg font-bold text-heading">No matching services</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          You have no services with this combination of filters yet. Clear the
          filters to see everything you offer.
        </p>
        <button
          type="button"
          onClick={onClearFilter}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted cursor-pointer active:bg-surface-muted"
        >
          Clear filters
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted/30 px-6 py-14 text-center">
      <div
        aria-hidden="true"
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-900 text-accent-400 ring-1 ring-inset ring-accent-400/30"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8"
        >
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        </svg>
      </div>
      <h2 className="mt-5 text-xl font-bold tracking-tight text-heading">No services yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        You haven&apos;t published any services yet. Add your first service and it
        will show up here with its approval status, availability, pricing and
        capacity.
      </p>
      <div className="mt-6 flex flex-col items-center gap-2">
        <AddNewServiceButton />
      </div>
    </div>
  );
}

function ServiceCard({
  service,
  onDeleteRequest,
}: {
  service: TechnicianService;
  onDeleteRequest: (service: TechnicianService, trigger: HTMLButtonElement) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = service.image.length > 0 && !imageFailed;
  const availability = service.isAvailable ? "available" : "unavailable";
  const shownAmenities = service.amenities.slice(0, 2);
  const hiddenAmenities = service.amenities.length - shownAmenities.length;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xs transition-shadow duration-200 hover:shadow-md">
      {/* Image with status badges overlaid */}
      <div className="relative h-40 w-full shrink-0 overflow-hidden bg-navy-900">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- backend image URLs are remote and not known at build time, so next/image remotePatterns can't be configured.
          <img
            src={service.image}
            alt={service.title}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-12 w-12 text-accent-400/60"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
        )}
        <div className="absolute left-3 top-3">
          <Badge
            label={APPROVAL_LABELS[service.approvalStatus]}
            className={`bg-surface/80 ${APPROVAL_STYLES[service.approvalStatus]}`}
          />
        </div>
        <div className="absolute right-3 top-3">
          <Badge
            label={AVAILABILITY_LABELS[availability]}
            className={`bg-surface/80 ${AVAILABILITY_STYLES[availability]}`}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        {/* Category + title */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          {service.category}
        </p>
        <h3 className="mt-0.5 line-clamp-2 text-base font-bold leading-snug text-heading">
          {service.title}
        </h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0"
          >
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="min-w-0 truncate">{service.location}</span>
        </p>

        {/* Facts row */}
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
          <div className="min-w-0">
            <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
              Hourly rate
            </dt>
            <dd className="mt-0.5 truncate text-xs font-bold tabular-nums text-heading">
              {formatAmount(service.hourlyRate)}/hr
            </dd>
          </div>
          <div className="min-w-0 border-x border-border">
            <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
              Deposit
            </dt>
            <dd className="mt-0.5 truncate text-xs font-bold tabular-nums text-heading">
              {formatAmount(service.securityDeposit)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
              Capacity
            </dt>
            <dd className="mt-0.5 truncate text-xs font-bold tabular-nums text-heading">
              {service.maxCapacity}
            </dd>
          </div>
        </dl>

        {/* Overview — real, technician-supplied data */}
        {service.overview.trim().length > 0 && (
          <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted">
            {service.overview}
          </p>
        )}

        {/* Amenities */}
        {service.amenities.length > 0 && (
          <ul
            aria-label="Amenities"
            className="mt-3 flex flex-wrap items-center gap-1.5"
          >
            {shownAmenities.map((amenity) => (
              <li
                key={amenity}
                className="rounded-full border border-border-strong bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-foreground"
              >
                {amenity}
              </li>
            ))}
            {hiddenAmenities > 0 && (
              <li
                title={service.amenities.join(", ")}
                className="rounded-full border border-border-strong bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted"
              >
                +{hiddenAmenities} more
              </li>
            )}
          </ul>
        )}

        {/* Footer — created date and actions */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-[11px] text-muted">
            <span className="font-medium text-foreground">Added</span>{" "}
            {formatServiceDate(service.createdAt)}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/my-services/${service.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[10px] font-semibold text-warning transition-colors duration-200 hover:bg-surface-muted cursor-pointer active:bg-surface-muted"
              title="Edit this service"
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
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5l-7 9L19 14.5 21 16.5l-2 7l-8-4-8 4z" />
              </svg>
              Edit
            </Link>
            <button
              type="button"
              onClick={(event) => onDeleteRequest(service, event.currentTarget)}
              aria-label={`Delete ${service.title}`}
              title="Delete this service"
              className="inline-flex items-center gap-1.5 rounded-full border border-error/40 bg-error-soft/50 px-3 py-1.5 text-[10px] font-semibold text-error transition-colors duration-200 hover:border-error/60 hover:bg-error-soft cursor-pointer active:bg-error-soft"
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
                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}


function ScreenSkeleton() {
  return (
    <div role="status" aria-label="Loading your services…" className="space-y-6">
      <span className="sr-only">Loading your services…</span>
      <div aria-hidden="true" className="h-16 animate-pulse rounded-2xl bg-surface-muted/70" />
      <div
        aria-hidden="true"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-72 animate-pulse rounded-2xl bg-surface-muted/70" />
        ))}
      </div>
    </div>
  );
}

function AccessDenied({ role }: { role: "customer" | "admin" | null }) {
  const roleLabel = role === "customer" ? "customer" : role === "admin" ? "admin" : null;
  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-2xl border border-warning/40 bg-warning-soft text-warning"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8"
        >
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-heading">
        This page is for technician accounts
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {roleLabel
          ? `You're signed in with a ${roleLabel} account, so My Services isn't available here. Your dashboard only shows the sections your role can use.`
          : "Your account's role isn't recognized, so this section isn't available. Please contact FixMate support if this looks wrong."}
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]"
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
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        Back to your dashboard
      </Link>
    </section>
  );
}

export function MyServicesScreen() {
  // Session atom is already resolved by the layout — this resolves instantly.
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const role = roleFromUser(user);

  if (isPending) return <ScreenSkeleton />;

  // Signed out — the layout is redirecting; render nothing private.
  if (!user) return null;

  // Technician-only gate. Known non-technician roles (and unknown roles)
  // are refused here; the backend enforces the same rule independently.
  if (role !== "technician") {
    return <AccessDenied role={role === "customer" || role === "admin" ? role : null} />;
  }

  return <MyServices />;
}


export default function MyServices() {
  const [page, setPage] = useState(1);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatusFilter>("all");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [reloadToken, setReloadToken] = useState(0);

  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: ServicesError }
    | { phase: "success"; data: ServicesPageData }
  >({ phase: "loading" });

  // Delete flow
  const [deleteTarget, setDeleteTarget] = useState<TechnicianService | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<
    | { kind: "success"; message: string }
    | { kind: "error"; message: string; showRefresh: boolean }
    | null
  >(null);
  const deleteInFlightRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Handlers set the "loading" phase synchronously (event handlers may
  // setState freely); the effect only talks to the network.
  function beginLoading() {
    setState({ phase: "loading" });
  }

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetchMyServices({ page, limit: PAGE_SIZE, approvalStatus, availability, signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        setState({ phase: "success", data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof ServicesError) {
          setState({ phase: "error", error });
          return;
        }
        setState({
          phase: "error",
          error: new ServicesError(
            "server",
            "Something went wrong while loading your services. Please try again."
          ),
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, approvalStatus, availability, reloadToken]);

  function handleApprovalStatusChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    beginLoading();
    setApprovalStatus(value === "all" ? "all" : (value as ServiceApprovalStatus));
    setPage(1); // Reset pagination whenever a filter changes.
  }

  function handleAvailabilityChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value as AvailabilityFilter;
    beginLoading();
    setAvailability(value);
    setPage(1);
  }

  function goToPage(nextPage: number) {
    beginLoading();
    setPage(nextPage);
  }

  function reload() {
    beginLoading();
    setReloadToken((token) => token + 1);
  }

  function clearFilters() {
    beginLoading();
    setApprovalStatus("all");
    setAvailability("all");
    setPage(1);
  }

  function handleDeleteRequest(service: TechnicianService, trigger: HTMLButtonElement) {
    returnFocusRef.current = trigger;
    setDeleteError(null);
    setDeleteTarget(service);
  }

  function closeDeleteDialog() {
    // Never dismiss mid-request — that could mask an in-flight delete.
    if (deleteInFlightRef.current) return;
    setDeleteTarget(null);
    setDeleteError(null);
    const trigger = returnFocusRef.current;
    returnFocusRef.current = null;
    // The card may have unmounted after a successful delete — fall back to
    // the filter control so keyboard focus is never lost.
    if (trigger && document.contains(trigger)) {
      trigger.focus();
    } else {
      document.getElementById("service-approval-filter")?.focus();
    }
  }

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target || deleteInFlightRef.current) return;
    deleteInFlightRef.current = true;
    setDeleting(true);
    setDeleteError(null);

    try {
      const message = await deleteServiceRequest(target.id);

      const previousData = state.phase === "success" ? state.data : null;
      if (previousData) {
        const { data: nextData, needsRefetch } = applyDeletion(previousData, target.id);
        setState({ phase: "success", data: nextData });
        if (needsRefetch) {
          beginLoading();
          setPage(nextData.pagination.currentPage);
        }
      }
      setNotice({ kind: "success", message });
      deleteInFlightRef.current = false;
      setDeleting(false);
      closeDeleteDialog();
      return;
    } catch (error) {
      deleteInFlightRef.current = false;
      setDeleting(false);

      if (error instanceof ServicesError && error.kind === "unauthorized") {
        setDeleteTarget(null);
        setDeleteError(null);
        setState({ phase: "error", error });
        return;
      }
      if (
        error instanceof ServicesError &&
        (error.kind === "notfound" ||
          error.kind === "conflict" ||
          error.kind === "badrequest" ||
          error.kind === "forbidden")
      ) {
        setDeleteTarget(null);
        setDeleteError(null);
        setNotice({ kind: "error", message: error.message, showRefresh: true });
        return;
      }
      // Network/server/parse failures — keep the dialog open so the
      // technician can retry without losing context.
      setDeleteError(
        error instanceof ServicesError
          ? error.message
          : "Something went wrong while deleting this service. Please try again."
      );
    }
  }

  // Auto-dismiss the success notice; errors persist until dismissed.
  useEffect(() => {
    if (notice?.kind !== "success") return;
    const timeout = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const isLoading = state.phase === "loading";
  const totalItems = state.phase === "success" ? state.data.pagination.totalItems : null;
  const filtered = approvalStatus !== "all" || availability !== "all";

  const selectBase =
    "w-full appearance-none rounded-lg border border-border-strong bg-surface py-2.5 pl-4 pr-10 text-sm font-medium text-foreground shadow-xs outline-none transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25 cursor-pointer";

  const selectChevron = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <div>
            <label
              htmlFor="service-approval-filter"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
            >
              Approval status
            </label>
            <div className="relative mt-1.5">
              <select
                id="service-approval-filter"
                value={approvalStatus}
                onChange={handleApprovalStatusChange}
                className={selectBase}
              >
                <option value="all">All statuses</option>
                {SERVICE_APPROVAL_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {APPROVAL_LABELS[value]}
                  </option>
                ))}
              </select>
              {selectChevron}
            </div>
          </div>
          <div>
            <label
              htmlFor="service-availability-filter"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
            >
              Availability
            </label>
            <div className="relative mt-1.5">
              <select
                id="service-availability-filter"
                value={availability}
                onChange={handleAvailabilityChange}
                className={selectBase}
              >
                <option value="all">All availability</option>
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
              </select>
              {selectChevron}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {totalItems !== null && (
            <p
              aria-live="polite"
              className="text-xs font-medium tabular-nums text-muted sm:text-sm"
            >
              {totalItems} {totalItems === 1 ? "service" : "services"}
            </p>
          )}
          <AddNewServiceButton />
          <button
            type="button"
            onClick={reload}
            disabled={isLoading}
            aria-label="Refresh services"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-200 enabled:hover:bg-surface-muted enabled:hover:text-heading cursor-pointer enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`h-5 w-5 ${isLoading ? "animate-spin motion-reduce:animate-none" : ""}`}
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
            </svg>
          </button>
        </div>
      </div>

      {notice && (
        <div
          role={notice.kind === "success" ? "status" : "alert"}
          aria-live={notice.kind === "success" ? "polite" : "assertive"}
          className={`mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
            notice.kind === "success"
              ? "border-success/40 bg-success-soft/60 text-success"
              : "border-error/40 bg-error-soft/60 text-error"
          }`}
        >
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
            {notice.kind === "success" ? (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M9 12.5l2 2 4-4.5" />
              </>
            ) : (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" />
              </>
            )}
          </svg>
          <p className="min-w-0 flex-1 font-medium leading-relaxed">{notice.message}</p>
          {notice.kind === "error" && notice.showRefresh && (
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                reload();
              }}
              className="shrink-0 rounded-full border border-error/40 bg-surface px-3 py-1.5 text-xs font-semibold text-error transition-colors duration-200 hover:bg-error-soft cursor-pointer active:bg-error-soft"
            >
              Refresh list
            </button>
          )}
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss message"
            className="shrink-0 rounded-lg p-1 opacity-80 transition-opacity duration-200 hover:opacity-100 cursor-pointer active:scale-95"
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
      )}

      <div className="mt-6" aria-busy={isLoading}>
        {state.phase === "loading" && <ServicesSkeleton />}

        {state.phase === "error" && <ErrorPanel error={state.error} onRetry={reload} />}

        {state.phase === "success" && state.data.items.length === 0 && (
          <EmptyState filtered={filtered} onClearFilter={clearFilters} />
        )}

        {state.phase === "success" && state.data.items.length > 0 && (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {state.data.items.map((service) => (
                <li key={service.id} className="h-full">
                  <ServiceCard service={service} onDeleteRequest={handleDeleteRequest} />
                </li>
              ))}
            </ul>

            <nav
              aria-label="Services pagination"
              className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5"
            >
              <button
                type="button"
                onClick={() => goToPage(Math.max(1, state.data.pagination.currentPage - 1))}
                disabled={!state.data.pagination.hasPrevPage || isLoading}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted cursor-pointer enabled:active:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
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
                  <path d="M19 12H5M11 18l-6-6 6-6" />
                </svg>
                <span className="hidden sm:inline">Previous</span>
              </button>
              <p className="text-center text-xs font-medium tabular-nums text-muted sm:text-sm">
                Page{" "}
                <span className="font-semibold text-heading">
                  {state.data.pagination.currentPage}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-heading">
                  {Math.max(state.data.pagination.totalPages, 1)}
                </span>
              </p>
              <button
                type="button"
                onClick={() => goToPage(state.data.pagination.currentPage + 1)}
                disabled={!state.data.pagination.hasNextPage || isLoading}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted cursor-pointer enabled:active:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="hidden sm:inline">Next</span>
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
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </nav>
          </>
        )}
      </div>

      {deleteTarget && (
        <DeleteServiceDialog
          service={deleteTarget}
          pending={deleting}
          error={deleteError}
          onDismiss={closeDeleteDialog}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
