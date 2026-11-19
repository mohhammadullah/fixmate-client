"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { roleFromUser } from "@/components/dashboard/DashboardSidebar";
import {
  ALL_SERVICE_CATEGORIES as SERVICE_CATEGORIES,
  type AnyServiceCategory as ServiceCategory,
} from "@/lib/service-categories";
import ServiceImageFallback from "@/components/ui/ServiceImageFallback";

/** Admin service moderation — GET /api/admin/services (admin only),
 *  plus PATCH /api/services/:id/approve | /reject. */

type ApprovalStatus = "pending" | "approved" | "rejected";
type StatusFilter = ApprovalStatus | "all";

interface AdminService {
  id: string;
  title: string;
  category: ServiceCategory;
  description: string;
  overview: string;
  hourlyRate: number;
  securityDeposit: number;
  maxCapacity: number;
  location: string;
  image: string;
  amenities: string[];
  approvalStatus: ApprovalStatus;
  availabilityStatus: "available" | "unavailable";
  rejectionReason: string | null;
  technicianName: string;
  technicianEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  currentPage: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface ServicesData {
  items: AdminService[];
  pagination: Pagination;
}

type ErrorKind = "unauthorized" | "forbidden" | "network" | "server" | "parse" | "conflict";

class AdminServicesError extends Error {
  readonly kind: ErrorKind;
  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.name = "AdminServicesError";
    this.kind = kind;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const PAGE_SIZE = 10;
const DEBOUNCE_MS = 350;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const requiredString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) throw new AdminServicesError("parse", "The server returned an unexpected service payload.");
  return value;
};
const requiredNumber = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new AdminServicesError("parse", "The server returned an unexpected service payload.");
  return value;
};

function parseService(raw: unknown): AdminService {
  if (!isRecord(raw)) throw new AdminServicesError("parse", "The server returned an unexpected service payload.");
  const category = raw.category;
  if (typeof category !== "string" || !SERVICE_CATEGORIES.some((value) => value === category)) {
    throw new AdminServicesError("parse", "The server returned an unknown service category.");
  }
  const approvalStatus = raw.approvalStatus;
  if (approvalStatus !== "pending" && approvalStatus !== "approved" && approvalStatus !== "rejected") {
    throw new AdminServicesError("parse", "The server returned an unknown approval status.");
  }
  const availability = raw.availabilityStatus;
  return {
    id: requiredString(raw, "id"),
    title: requiredString(raw, "title"),
    category: category as ServiceCategory,
    description: typeof raw.description === "string" ? raw.description : "",
    overview: typeof raw.overview === "string" ? raw.overview : "",
    hourlyRate: requiredNumber(raw, "hourlyRate"),
    securityDeposit: typeof raw.securityDeposit === "number" ? raw.securityDeposit : 0,
    maxCapacity: requiredNumber(raw, "maxCapacity"),
    location: typeof raw.location === "string" ? raw.location : "",
    image: typeof raw.image === "string" ? raw.image.trim() : "",
    amenities: Array.isArray(raw.amenities) ? raw.amenities.filter((item): item is string => typeof item === "string") : [],
    approvalStatus,
    availabilityStatus: availability === "unavailable" ? "unavailable" : "available",
    rejectionReason: typeof raw.rejectionReason === "string" ? raw.rejectionReason : null,
    technicianName: typeof raw.technicianName === "string" ? raw.technicianName : "",
    technicianEmail: typeof raw.technicianEmail === "string" ? raw.technicianEmail : "",
    createdAt: requiredString(raw, "createdAt"),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function parsePagination(raw: unknown): Pagination {
  if (!isRecord(raw)) throw new AdminServicesError("parse", "The server returned an unexpected pagination payload.");
  const currentPage = raw.currentPage, limit = raw.limit, totalItems = raw.totalItems, totalPages = raw.totalPages;
  if (
    typeof currentPage !== "number" || !Number.isFinite(currentPage) ||
    typeof limit !== "number" || !Number.isFinite(limit) ||
    typeof totalItems !== "number" || !Number.isFinite(totalItems) ||
    typeof totalPages !== "number" || !Number.isFinite(totalPages) ||
    typeof raw.hasNextPage !== "boolean" || typeof raw.hasPrevPage !== "boolean"
  ) throw new AdminServicesError("parse", "The server returned an unexpected pagination payload.");
  return { currentPage, limit, totalItems, totalPages, hasNextPage: raw.hasNextPage, hasPrevPage: raw.hasPrevPage };
}

async function fetchAccessToken(): Promise<string> {
  let response: { data: unknown; error: null | ({ status: number } & Record<string, unknown>) };
  try {
    response = await authClient.$fetch<{ token: string }>("/token", { method: "GET" });
  } catch {
    throw new AdminServicesError("network", "Couldn't reach the FixMate server to verify your session. Check your connection and try again.");
  }
  if (response.error) {
    if (response.error.status === 401 || response.error.status === 403) throw new AdminServicesError("unauthorized", "Your session has expired. Sign in again to moderate services.");
    throw new AdminServicesError("server", "We couldn't verify your session right now. Please try again.");
  }
  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) throw new AdminServicesError("server", "The FixMate server returned an unexpected session-token response.");
  return data.token;
}

async function fetchServices(options: { search: string; status: StatusFilter; page: number; signal: AbortSignal }): Promise<ServicesData> {
  const token = await fetchAccessToken();
  const params = new URLSearchParams({ page: String(options.page), limit: String(PAGE_SIZE) });
  if (options.status !== "all") params.set("status", options.status);
  if (options.search) params.set("search", options.search);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/admin/services?${params.toString()}`, {
      method: "GET", headers: { Authorization: `Bearer ${token}` }, credentials: "include", signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AdminServicesError("network", "Couldn't reach the FixMate server. Check your connection and try again.");
  }
  if (response.status === 401) throw new AdminServicesError("unauthorized", "Your session has expired. Sign in again to moderate services.");
  if (response.status === 403) throw new AdminServicesError("forbidden", "Admin access only. This account can't moderate services.");
  let body: unknown = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) throw new AdminServicesError("server", isRecord(body) && typeof body.message === "string" ? body.message : "Couldn't load services. Please try again.");
  if (!isRecord(body) || body.success !== true || !Array.isArray(body.data)) throw new AdminServicesError("parse", "The server returned an unexpected response.");
  return { items: body.data.map(parseService), pagination: parsePagination(body.pagination) };
}

async function moderateService(serviceId: string, decision: "approve" | "reject", rejectionReason?: string): Promise<string> {
  const token = await fetchAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/services/${encodeURIComponent(serviceId)}/${decision}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(decision === "reject" ? { "Content-Type": "application/json" } : {}),
      },
      credentials: "include",
      ...(decision === "reject" ? { body: JSON.stringify({ rejectionReason }) } : {}),
    });
  } catch {
    throw new AdminServicesError("network", "Couldn't reach the FixMate server. Check your connection and try again.");
  }
  if (response.status === 401) throw new AdminServicesError("unauthorized", "Your session has expired. Sign in again to moderate services.");
  if (response.status === 403) throw new AdminServicesError("forbidden", "Admin access only. This account can't moderate services.");
  if (response.status === 404) throw new AdminServicesError("server", "This service no longer exists.");
  if (response.status === 409) throw new AdminServicesError("conflict", "This service has already been reviewed or changed. Refresh the list to see its latest status.");
  let body: unknown = null;
  try { body = await response.json(); } catch {}
  if (response.status === 400) {
    const issue = isRecord(body) && Array.isArray(body.errors) && body.errors.length > 0 && isRecord(body.errors[0]) ? body.errors[0].message : null;
    throw new AdminServicesError("server", typeof issue === "string" ? issue : "Check the rejection reason and try again.");
  }
  if (!response.ok) throw new AdminServicesError("server", isRecord(body) && typeof body.message === "string" ? body.message : "Couldn't review this service. Please try again.");
  return isRecord(body) && typeof body.message === "string" ? body.message : "Service reviewed.";
}


function RejectDialog({
  service,
  pending,
  error,
  onDismiss,
  onConfirm,
}: {
  service: AdminService;
  pending: boolean;
  error: string | null;
  onDismiss: () => void;
  onConfirm: (reason: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const onDismissRef = useRef(onDismiss);
  const pendingRef = useRef(pending);

  useEffect(() => {
    onDismissRef.current = onDismiss;
    pendingRef.current = pending;
  }, [onDismiss, pending]);

  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    reasonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!pendingRef.current) onDismissRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusable = Array.from(node.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) { event.preventDefault(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const outside = !(active instanceof HTMLElement) || !node.contains(active);
      if (event.shiftKey) {
        if (active === first || outside) { event.preventDefault(); last.focus(); }
      } else if (active === last || outside) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      body.style.overflow = previousOverflow;
    };
  }, []);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 1 || trimmed.length > 500) {
      setReasonError("A rejection reason between 1 and 500 characters is required.");
      reasonRef.current?.focus();
      return;
    }
    setReasonError(null);
    onConfirm(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6">
      <div aria-hidden="true" onClick={() => { if (!pendingRef.current) onDismissRef.current(); }} className="absolute inset-0 bg-navy-950/70 backdrop-blur-[2px]" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="reject-service-title" aria-describedby="reject-service-description" className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-error/40 bg-error-soft text-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
            </div>
            <h2 id="reject-service-title" className="text-base font-bold leading-snug text-heading">Reject this service?</h2>
          </div>
          <button type="button" onClick={onDismiss} disabled={pending} aria-label="Close dialog" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors duration-200 enabled:hover:bg-surface-muted enabled:hover:text-heading disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer active:scale-95">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="px-5 py-5 sm:px-6">
            <p id="reject-service-description" className="text-sm leading-relaxed text-foreground">
              Reject <span className="font-semibold text-heading">{service.title}</span> from{" "}
              <span className="font-semibold text-heading">{service.technicianName || "this technician"}</span>. The technician will see your reason.
            </p>
            <div className="mt-4">
              <label htmlFor="service-rejection-reason" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Rejection reason <span aria-hidden="true" className="text-error">*</span>
              </label>
              <textarea
                ref={reasonRef}
                id="service-rejection-reason"
                rows={4}
                value={reason}
                onChange={(event) => { setReason(event.target.value); setReasonError(null); }}
                disabled={pending}
                required
                aria-invalid={Boolean(reasonError) || undefined}
                aria-describedby={reasonError ? "service-rejection-error" : undefined}
                placeholder="Explain what needs to change before approval…"
                className="mt-1.5 w-full resize-y rounded-xl border border-border-strong bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none transition-colors duration-200 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25 aria-[invalid=true]:border-error/60"
              />
              {reasonError && <p id="service-rejection-error" role="alert" className="mt-1.5 text-[11px] font-medium text-error">{reasonError}</p>}
            </div>
            {error && <div role="alert" className="mt-4 rounded-xl border border-error/40 bg-error-soft/60 px-4 py-3 text-xs leading-relaxed text-error">{error}</div>}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <button type="button" onClick={onDismiss} disabled={pending} className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer active:bg-surface-muted">Cancel</button>
            <button type="submit" disabled={pending} aria-live="polite" className="inline-flex items-center justify-center gap-2 rounded-full bg-error px-5 py-2.5 text-sm font-semibold text-background shadow-sm transition-all duration-200 enabled:hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer active:scale-[0.98]">
              {pending ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none"><circle cx="12" cy="12" r="9" strokeOpacity="0.3" /><path d="M21 12a9 9 0 0 0-9-9" /></svg>
                  Rejecting…
                </>
              ) : "Confirm rejection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function Skeleton() {
  return (
    <div role="status" aria-label="Loading services…" className="grid gap-4 lg:grid-cols-2">
      <span className="sr-only">Loading services…</span>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} aria-hidden="true" className="h-72 animate-pulse rounded-2xl border border-border bg-surface" />
      ))}
    </div>
  );
}

function ServiceCard({
  service,
  onApprove,
  onReject,
  busy,
  pendingAction,
}: {
  service: AdminService;
  onApprove: (service: AdminService, trigger: HTMLButtonElement) => void;
  onReject: (service: AdminService, trigger: HTMLButtonElement) => void;
  busy: boolean;
  pendingAction: "approve" | "reject" | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = service.image.trim();
  const showImage = imageUrl.length > 0 && !imageFailed;
  const isPending = service.approvalStatus === "pending";
  const format = (value: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
      <div className="relative h-40 w-full shrink-0 overflow-hidden bg-navy-900">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- backend image URLs are remote and not known at build time, so next/image remotePatterns can't be configured.
          <img src={imageUrl} alt={service.title} loading="lazy" decoding="async" onError={() => setImageFailed(true)} className="absolute inset-0 h-full w-full object-cover object-center" />
        ) : (
          <ServiceImageFallback />
        )}
        <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-navy-950/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-100 backdrop-blur-sm">{service.category}</span>
        <span className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
          isPending ? "border-warning/40 bg-warning-soft text-warning"
            : service.approvalStatus === "approved" ? "border-success/40 bg-success-soft text-success"
              : "border-error/40 bg-error-soft text-error"
        }`}>{service.approvalStatus}</span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-sm font-bold leading-snug text-heading">{service.title}</h3>
        <p className="mt-1 text-xs text-muted">{service.location || "No location provided"}</p>
        <p className="mt-2 text-xs text-muted">Technician: <span className="font-semibold text-heading">{service.technicianName || "—"}</span></p>
        {service.technicianEmail && <p className="mt-0.5 text-[11px] text-muted">{service.technicianEmail}</p>}
        <p className="mt-1 text-[11px] text-muted">Submitted {new Date(service.createdAt).toLocaleDateString("en-GB")}</p>

        <dl className="mt-3 grid grid-cols-3 gap-2 border-y border-border py-3 text-center">
          <div><dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">Rate</dt><dd className="mt-0.5 text-xs font-bold tabular-nums text-heading">{format(service.hourlyRate)}/hr</dd></div>
          <div className="border-x border-border"><dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">Deposit</dt><dd className="mt-0.5 text-xs font-bold tabular-nums text-heading">{format(service.securityDeposit)}</dd></div>
          <div><dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">Capacity</dt><dd className="mt-0.5 text-xs font-bold tabular-nums text-heading">{service.maxCapacity}</dd></div>
        </dl>

        {service.overview && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted">{service.overview}</p>}
        {service.description && <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-muted">{service.description}</p>}
        {service.amenities.length > 0 && (
          <ul aria-label="Amenities" className="mt-3 flex flex-wrap gap-1.5">
            {service.amenities.slice(0, 4).map((amenity, index) => (
              <li key={`${amenity}-${index}`} className="rounded-full border border-border-strong bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-foreground">{amenity}</li>
            ))}
            {service.amenities.length > 4 && <li className="rounded-full border border-border-strong bg-surface-muted px-2 py-0.5 text-[10px] text-muted">+{service.amenities.length - 4} more</li>}
          </ul>
        )}
        {service.rejectionReason && <p className="mt-3 text-[11px] text-error">Reason: {service.rejectionReason}</p>}

        {isPending && (
          <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={(event) => onReject(service, event.currentTarget)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-error/40 bg-error-soft/50 px-4 py-2 text-xs font-semibold text-error transition-colors duration-200 enabled:hover:bg-error-soft disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer active:scale-[0.98]"
            >
              {pendingAction === "reject" ? "Rejecting…" : "Reject"}
            </button>
            <button
              type="button"
              onClick={(event) => onApprove(service, event.currentTarget)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-success px-4 py-2 text-xs font-semibold text-background shadow-sm transition-all duration-200 enabled:hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer active:scale-[0.98]"
            >
              {pendingAction === "approve" ? "Approving…" : "Approve"}
            </button>
          </div>
        )}
        {!isPending && <div className="mt-auto pt-4" />}
      </div>
    </article>
  );
}


export default function AdminServices() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const role = roleFromUser(user);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: AdminServicesError }
    | { phase: "success"; data: ServicesData }
  >({ phase: "loading" });

  const [rejectTarget, setRejectTarget] = useState<AdminService | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ serviceId: string; action: "approve" | "reject" } | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string; refresh?: boolean } | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (isPending || !user || role !== "admin") return;
    const controller = new AbortController();
    let cancelled = false;
    fetchServices({ search: debouncedSearch, status, page, signal: controller.signal })
      .then((data) => { if (!cancelled) setState({ phase: "success", data }); })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          phase: "error",
          error: error instanceof AdminServicesError ? error : new AdminServicesError("server", "Something went wrong while loading services. Please try again."),
        });
      });
    return () => { cancelled = true; controller.abort(); };
  }, [debouncedSearch, status, page, reloadToken, isPending, user, role]);

  useEffect(() => {
    if (notice?.kind !== "success") return;
    const timeout = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function restoreFocus() {
    const trigger = returnFocusRef.current;
    returnFocusRef.current = null;
    if (trigger && document.contains(trigger)) trigger.focus();
    else document.getElementById("admin-service-search")?.focus();
  }

  function closeRejectDialog() {
    if (rejectTarget && inFlightRef.current.has(rejectTarget.id)) return;
    setRejectTarget(null);
    setRejectError(null);
    restoreFocus();
  }

  async function runReview(service: AdminService, action: "approve" | "reject", reason?: string) {
    if (inFlightRef.current.has(service.id)) return;
    inFlightRef.current.add(service.id);
    setPending({ serviceId: service.id, action });
    setNotice(null);
    setRejectError(null);
    try {
      const message = await moderateService(service.id, action, reason);
      const previous = state.phase === "success" ? state.data : null;
      if (previous) {
        const newStatus: ApprovalStatus = action === "approve" ? "approved" : "rejected";
        const isStillVisible = status === "all" || status === newStatus;
        const items = isStillVisible
          ? previous.items.map((item) => item.id === service.id
              ? { ...item, approvalStatus: newStatus, rejectionReason: reason ?? item.rejectionReason }
              : item)
          : previous.items.filter((item) => item.id !== service.id);
        const totalItems = isStillVisible ? previous.pagination.totalItems : Math.max(0, previous.pagination.totalItems - 1);
        const totalPages = Math.max(1, Math.ceil(totalItems / previous.pagination.limit));
        const currentPage = Math.min(previous.pagination.currentPage, totalPages);
        setState({
          phase: "success",
          data: {
            items,
            pagination: { ...previous.pagination, currentPage, totalItems, totalPages, hasNextPage: currentPage < totalPages, hasPrevPage: currentPage > 1 },
          },
        });
        if (items.length === 0 && currentPage !== previous.pagination.currentPage) {
          setState({ phase: "loading" });
          setPage(currentPage);
        }
      }
      setNotice({ kind: "success", message });
      inFlightRef.current.delete(service.id);
      setPending(null);
      setRejectTarget(null);
      setRejectError(null);
      restoreFocus();
      return;
    } catch (error) {
      inFlightRef.current.delete(service.id);
      setPending(null);
      if (error instanceof AdminServicesError && error.kind === "unauthorized") {
        setRejectTarget(null);
        setState({ phase: "error", error });
        return;
      }
      const message = error instanceof Error ? error.message : "Something went wrong while reviewing this service.";
      if (error instanceof AdminServicesError && error.kind === "conflict") {
        setRejectTarget(null);
        setNotice({ kind: "error", message, refresh: true });
        restoreFocus();
        return;
      }
      if (action === "reject" && rejectTarget?.id === service.id) setRejectError(message);
      else setNotice({ kind: "error", message, refresh: true });
    }
  }

  if (isPending) return <Skeleton />;
  if (!user) return null;
  if (role !== "admin") {
    return (
      <section className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-heading">Admin access only</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">Service moderation is available to administrators only.</p>
        <Link href="/dashboard" className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm cursor-pointer transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:bg-primary-hover active:scale-[0.98]">Back to your dashboard</Link>
      </section>
    );
  }

  const isLoading = state.phase === "loading";
  const totalItems = state.phase === "success" ? state.data.pagination.totalItems : null;
  const selectClass = "h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium text-foreground outline-none transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25 cursor-pointer";

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <div>
            <label htmlFor="admin-service-search" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Search services</label>
            <input
              id="admin-service-search"
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Title, category, location or technician…"
              className="mt-1.5 h-11 w-full rounded-lg border border-border-strong bg-surface px-4 text-sm text-foreground placeholder:text-muted outline-none transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25"
            />
          </div>
          <div>
            <label htmlFor="admin-service-status" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Approval status</label>
            <select
              id="admin-service-status"
              value={status}
              onChange={(event) => { setState({ phase: "loading" }); setStatus(event.target.value as StatusFilter); setPage(1); }}
              className={`mt-1.5 ${selectClass}`}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All statuses</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalItems !== null && <p aria-live="polite" className="text-xs font-medium tabular-nums text-muted sm:text-sm">{totalItems} service{totalItems === 1 ? "" : "s"}</p>}
          <button
            type="button"
            onClick={() => { setState({ phase: "loading" }); setReloadToken((token) => token + 1); }}
            disabled={isLoading}
            aria-label="Refresh services"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-200 enabled:hover:bg-surface-muted enabled:hover:text-heading disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`h-5 w-5 ${isLoading ? "animate-spin motion-reduce:animate-none" : ""}`}><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
          </button>
        </div>
      </div>

      {notice && (
        <div role={notice.kind === "success" ? "status" : "alert"} className={`mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${notice.kind === "success" ? "border-success/40 bg-success-soft/60 text-success" : "border-error/40 bg-error-soft/60 text-error"}`}>
          <p className="min-w-0 flex-1 font-medium">{notice.message}</p>
          {notice.refresh && <button type="button" onClick={() => { setNotice(null); setState({ phase: "loading" }); setReloadToken((token) => token + 1); }} className="rounded-full border border-error/40 bg-surface px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors duration-200 hover:bg-surface-muted active:bg-surface-muted">Refresh</button>}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" className="cursor-pointer rounded-md px-1 transition-colors duration-200 hover:bg-surface-muted hover:text-heading active:scale-90">✕</button>
        </div>
      )}

      <div className="mt-6" aria-busy={isLoading}>
        {state.phase === "loading" && <Skeleton />}
        {state.phase === "error" && (
          <div role="alert" className="rounded-2xl border border-error/40 bg-error-soft/60 px-5 py-10 text-center">
            <h2 className="text-lg font-bold text-heading">{state.error.kind === "unauthorized" ? "Session expired" : "Couldn't load services"}</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{state.error.message}</p>
            <div className="mt-5 flex justify-center gap-3">
              {state.error.kind === "unauthorized" ? (
                <Link href="/sign-in" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm cursor-pointer transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:bg-primary-hover active:scale-[0.98]">Sign in again</Link>
              ) : (
                <button type="button" onClick={() => { setState({ phase: "loading" }); setReloadToken((token) => token + 1); }} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm cursor-pointer transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:bg-primary-hover active:scale-[0.98]">Try again</button>
              )}
            </div>
          </div>
        )}
        {state.phase === "success" && state.data.items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted/30 px-6 py-14 text-center">
            <h2 className="text-lg font-bold text-heading">No services in this view</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              {status === "pending" ? "Nothing is awaiting review right now." : "Try a different status or search term."}
            </p>
          </div>
        )}
        {state.phase === "success" && state.data.items.length > 0 && (
          <>
            <ul className="grid gap-4 lg:grid-cols-2">
              {state.data.items.map((service) => (
                <li key={service.id}>
                  <ServiceCard
                    service={service}
                    onApprove={(item, trigger) => { returnFocusRef.current = trigger; void runReview(item, "approve"); }}
                    onReject={(item, trigger) => {
                      returnFocusRef.current = trigger;
                      setRejectError(null);
                      setRejectTarget(item);
                    }}
                    busy={pending !== null}
                    pendingAction={pending?.serviceId === service.id ? pending.action : null}
                  />
                </li>
              ))}
            </ul>
            <nav aria-label="Services pagination" className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
              <button type="button" onClick={() => { setState({ phase: "loading" }); setPage(Math.max(1, state.data.pagination.currentPage - 1)); }} disabled={!state.data.pagination.hasPrevPage || isLoading} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer active:bg-surface-muted">Previous</button>
              <p className="text-xs font-medium tabular-nums text-muted">Page <span className="font-semibold text-heading">{state.data.pagination.currentPage}</span> of <span className="font-semibold text-heading">{Math.max(state.data.pagination.totalPages, 1)}</span></p>
              <button type="button" onClick={() => { setState({ phase: "loading" }); setPage(state.data.pagination.currentPage + 1); }} disabled={!state.data.pagination.hasNextPage || isLoading} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer active:bg-surface-muted">Next</button>
            </nav>
          </>
        )}
      </div>

      {rejectTarget && (
        <RejectDialog
          service={rejectTarget}
          pending={pending?.action === "reject" && pending.serviceId === rejectTarget.id}
          error={rejectError}
          onDismiss={closeRejectDialog}
          onConfirm={(reason) => void runReview(rejectTarget, "reject", reason)}
        />
      )}
    </div>
  );
}
