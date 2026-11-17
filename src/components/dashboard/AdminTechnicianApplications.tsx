"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { roleFromUser } from "@/components/dashboard/DashboardSidebar";

/* ================================================================== */
/*  Admin review of technician applications stored on user documents.   */
/* ================================================================== */

type StatusFilter = "all" | "pending" | "approved" | "rejected";

interface ApplicationRecord {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  area: string | null;
  bio: string | null;
  status: "pending" | "approved" | "rejected";
  experience: number;
  skills: string[];
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
}

interface Pagination {
  currentPage: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface ApplicationsData {
  items: ApplicationRecord[];
  pagination: Pagination;
}

type ErrorKind = "unauthorized" | "forbidden" | "network" | "server" | "parse" | "notfound" | "conflict" | "validation";

class AdminApplicationsError extends Error {
  readonly kind: ErrorKind;
  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.name = "AdminApplicationsError";
    this.kind = kind;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const PAGE_SIZE = 10;

/* ================================================================== */
/*  Runtime validation                                                 */
/* ================================================================== */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new AdminApplicationsError("parse", "The server returned an unexpected application payload.");
  }
  return value;
}

function parseApplication(raw: unknown): ApplicationRecord {
  if (!isRecord(raw)) throw new AdminApplicationsError("parse", "The server returned an unexpected application payload.");
  const status = raw.status;
  if (typeof status !== "string" || !["pending", "approved", "rejected"].includes(status)) {
    throw new AdminApplicationsError("parse", "The server returned an unknown application status.");
  }
  const nullableString = (key: string): string | null => typeof raw[key] === "string" ? (raw[key] as string) : null;
  const experience = raw.experience;
  if (typeof experience !== "number" || !Number.isFinite(experience)) {
    throw new AdminApplicationsError("parse", "The server returned an unexpected experience value.");
  }
  return {
    userId: requiredString(raw, "userId"),
    name: nullableString("name"),
    email: nullableString("email"),
    phone: nullableString("phone"),
    area: nullableString("area"),
    bio: nullableString("bio"),
    status: status as ApplicationRecord["status"],
    experience,
    skills: Array.isArray(raw.skills) ? raw.skills.filter((item): item is string => typeof item === "string") : [],
    submittedAt: requiredString(raw, "submittedAt"),
    reviewedAt: nullableString("reviewedAt"),
    reviewedBy: nullableString("reviewedBy"),
    rejectionReason: nullableString("rejectionReason"),
  };
}

function parsePagination(raw: unknown): Pagination {
  if (!isRecord(raw)) throw new AdminApplicationsError("parse", "The server returned an unexpected pagination payload.");
  const currentPage = raw.currentPage;
  const limit = raw.limit;
  const totalItems = raw.totalItems;
  const totalPages = raw.totalPages;
  if (
    typeof currentPage !== "number" || !Number.isFinite(currentPage) ||
    typeof limit !== "number" || !Number.isFinite(limit) ||
    typeof totalItems !== "number" || !Number.isFinite(totalItems) ||
    typeof totalPages !== "number" || !Number.isFinite(totalPages) ||
    typeof raw.hasNextPage !== "boolean" || typeof raw.hasPrevPage !== "boolean"
  ) {
    throw new AdminApplicationsError("parse", "The server returned an unexpected pagination payload.");
  }
  return { currentPage, limit, totalItems, totalPages, hasNextPage: raw.hasNextPage, hasPrevPage: raw.hasPrevPage };
}

function parseResponse(body: unknown): ApplicationsData {
  if (!isRecord(body)) throw new AdminApplicationsError("parse", "The server returned an unexpected response.");
  if (body.success !== true) {
    const message = typeof body.message === "string" ? body.message : "The server couldn't load applications.";
    throw new AdminApplicationsError("server", message);
  }
  if (!Array.isArray(body.data)) throw new AdminApplicationsError("parse", "The server returned an unexpected applications payload.");
  return { items: body.data.map(parseApplication), pagination: parsePagination(body.pagination) };
}

/* ================================================================== */
/*  API calls — JWT per request, never stored/logged.                   */
/* ================================================================== */

async function fetchAccessToken(): Promise<string> {
  let response: { data: unknown; error: null | ({ status: number } & Record<string, unknown>) };
  try {
    response = await authClient.$fetch<{ token: string }>("/token", { method: "GET" });
  } catch {
    throw new AdminApplicationsError("network", "Couldn't reach the FixMate server to verify your session. Check your connection and try again.");
  }
  if (response.error) {
    if (response.error.status === 401 || response.error.status === 403) {
      throw new AdminApplicationsError("unauthorized", "Your session has expired. Sign in again to review applications.");
    }
    throw new AdminApplicationsError("server", "We couldn't verify your session right now. Please try again.");
  }
  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new AdminApplicationsError("server", "The FixMate server returned an unexpected session-token response.");
  }
  return data.token;
}

async function fetchApplications(status: StatusFilter, page: number, signal: AbortSignal): Promise<ApplicationsData> {
  const token = await fetchAccessToken();
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (status !== "all") params.set("status", status);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/technician-applications?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AdminApplicationsError("network", "Couldn't reach the FixMate server. Check your connection and try again.");
  }

  if (response.status === 401) throw new AdminApplicationsError("unauthorized", "Your session has expired. Sign in again to review applications.");
  if (response.status === 403) throw new AdminApplicationsError("forbidden", "Admin access only. This account can't review applications.");

  let body: unknown = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === "string" ? body.message : "Couldn't load applications. Please try again.";
    throw new AdminApplicationsError("server", message);
  }
  return parseResponse(body);
}

async function reviewApplication(userId: string, decision: "approve" | "reject", rejectionReason?: string): Promise<string> {
  const token = await fetchAccessToken();
  const payload: Record<string, unknown> = { decision };
  if (decision === "reject") payload.rejectionReason = rejectionReason;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/technician-applications/${encodeURIComponent(userId)}/review`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  } catch {
    throw new AdminApplicationsError("network", "Couldn't reach the FixMate server. Check your connection and try again.");
  }

  if (response.status === 401) throw new AdminApplicationsError("unauthorized", "Your session has expired. Sign in again to review applications.");
  if (response.status === 403) throw new AdminApplicationsError("forbidden", "Admin access only. This account can't review applications.");
  if (response.status === 404) throw new AdminApplicationsError("notfound", "This application no longer exists.");
  if (response.status === 409) throw new AdminApplicationsError("conflict", "This application was already reviewed or changed. Refresh the list to see its latest status.");

  let body: unknown = null;
  try { body = await response.json(); } catch {}
  if (response.status === 400) {
    const issue = isRecord(body) && Array.isArray(body.errors) && body.errors.length > 0 && isRecord(body.errors[0]) ? body.errors[0].message : null;
    throw new AdminApplicationsError("validation", typeof issue === "string" ? issue : "Check the rejection reason and try again.");
  }
  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === "string" ? body.message : "Couldn't review this application. Please try again.";
    throw new AdminApplicationsError("server", message);
  }
  return isRecord(body) && typeof body.message === "string" ? body.message : "Application reviewed.";
}

/* ================================================================== */
/*  Reject dialog                                                      */
/* ================================================================== */

function RejectDialog({
  applicant,
  pending,
  error,
  onDismiss,
  onConfirm,
}: {
  applicant: ApplicationRecord;
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
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
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
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="reject-application-title" aria-describedby="reject-application-description" className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-error/40 bg-error-soft text-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
            </div>
            <h2 id="reject-application-title" className="text-base font-bold leading-snug text-heading">Reject application?</h2>
          </div>
          <button type="button" onClick={onDismiss} disabled={pending} aria-label="Close dialog" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-heading disabled:cursor-not-allowed disabled:opacity-50">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="px-5 py-5 sm:px-6">
            <p id="reject-application-description" className="text-sm leading-relaxed text-foreground">
              Reject the application from{" "}
              <span className="font-semibold text-heading">{applicant.name ?? applicant.email ?? "this applicant"}</span>.
              The account stays a customer and the reason is shown to them.
            </p>
            <div className="mt-4">
              <label htmlFor="application-rejection-reason" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Rejection reason <span aria-hidden="true" className="text-error">*</span>
              </label>
              <textarea
                ref={reasonRef}
                id="application-rejection-reason"
                rows={4}
                value={reason}
                onChange={(event) => { setReason(event.target.value); setReasonError(null); }}
                disabled={pending}
                required
                aria-invalid={Boolean(reasonError) || undefined}
                aria-describedby={reasonError ? "application-rejection-error" : undefined}
                placeholder="Explain why the application wasn't approved…"
                className="mt-1.5 w-full resize-y rounded-xl border border-border-strong bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none transition-colors duration-200 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25 aria-[invalid=true]:border-error/60"
              />
              {reasonError && <p id="application-rejection-error" role="alert" className="mt-1.5 text-[11px] font-medium text-error">{reasonError}</p>}
            </div>
            {error && <div role="alert" className="mt-4 rounded-xl border border-error/40 bg-error-soft/60 px-4 py-3 text-xs leading-relaxed text-error">{error}</div>}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <button type="button" onClick={onDismiss} disabled={pending} className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
            <button type="submit" disabled={pending} aria-live="polite" className="inline-flex items-center justify-center gap-2 rounded-full bg-error px-5 py-2.5 text-sm font-semibold text-background shadow-sm transition-all duration-200 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70">
              {pending ? "Rejecting…" : "Confirm rejection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  UI                                                                 */
/* ================================================================== */

function Skeleton() {
  return (
    <div role="status" aria-label="Loading applications…" className="space-y-4">
      <span className="sr-only">Loading applications…</span>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} aria-hidden="true" className="h-48 animate-pulse rounded-2xl border border-border bg-surface" />
      ))}
    </div>
  );
}

function AccessDenied({ role }: { role: "customer" | "technician" | null }) {
  const label = role === "customer" ? "customer" : role === "technician" ? "technician" : null;
  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-extrabold tracking-tight text-heading">Admin access only</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {label ? `You're signed in with a ${label} account.` : "Your account role isn't recognized."}{" "}
        Application reviews are available to admins only.
      </p>
      <Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm">Back to your dashboard</Link>
    </section>
  );
}

function ApplicationCard({
  application,
  onApprove,
  onReject,
  busy,
  pendingAction,
}: {
  application: ApplicationRecord;
  onApprove: (application: ApplicationRecord, trigger: HTMLButtonElement) => void;
  onReject: (application: ApplicationRecord, trigger: HTMLButtonElement) => void;
  busy: boolean;
  pendingAction: "approve" | "reject" | null;
}) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-snug text-heading">{application.name ?? "Unnamed applicant"}</h3>
          <p className="mt-0.5 text-xs text-muted">{application.email ?? "No email"}</p>
          <p className="mt-1 text-xs text-muted">Applied {new Date(application.submittedAt).toLocaleDateString("en-GB")}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
          application.status === "pending" ? "border-warning/40 bg-warning-soft text-warning"
            : application.status === "approved" ? "border-success/40 bg-success-soft text-success"
              : "border-error/40 bg-error-soft text-error"
        }`}>{application.status}</span>
      </div>

      <dl className="mt-4 grid gap-3 border-y border-border py-4 text-xs sm:grid-cols-3">
        <div><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Phone</dt><dd className="mt-0.5 font-medium text-heading">{application.phone ?? "—"}</dd></div>
        <div><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Area</dt><dd className="mt-0.5 font-medium text-heading">{application.area ?? "—"}</dd></div>
        <div><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Experience</dt><dd className="mt-0.5 font-medium text-heading">{application.experience} year{application.experience === 1 ? "" : "s"}</dd></div>
      </dl>

      {application.bio && <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted">{application.bio}</p>}

      {application.skills.length > 0 && (
        <ul aria-label="Skills" className="mt-3 flex flex-wrap gap-1.5">
          {application.skills.map((skill, index) => (
            <li key={`${skill}-${index}`} className="rounded-full border border-border-strong bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-foreground">{skill}</li>
          ))}
        </ul>
      )}

      {application.rejectionReason && (
        <p className="mt-3 text-xs text-error">Reason: {application.rejectionReason}</p>
      )}

      {application.status === "pending" && (
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={(event) => onReject(application, event.currentTarget)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-error/40 bg-error-soft/50 px-4 py-2 text-xs font-semibold text-error transition-colors duration-200 hover:bg-error-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "reject" ? "Rejecting…" : "Reject"}
          </button>
          <button
            type="button"
            onClick={(event) => onApprove(application, event.currentTarget)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-success px-4 py-2 text-xs font-semibold text-background shadow-sm transition-all duration-200 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "approve" ? "Approving…" : "Approve"}
          </button>
        </div>
      )}
    </article>
  );
}

/* ================================================================== */
/*  Main component                                                     */
/* ================================================================== */

export default function AdminTechnicianApplications() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const role = roleFromUser(user);

  const [status, setStatus] = useState<StatusFilter>("pending");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: AdminApplicationsError }
    | { phase: "success"; data: ApplicationsData }
  >({ phase: "loading" });

  const [rejectTarget, setRejectTarget] = useState<ApplicationRecord | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ userId: string; action: "approve" | "reject" } | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string; showRefresh?: boolean } | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());
  const returnFocusRef = useRef<HTMLElement | null>(null);

  function beginLoading() { setState({ phase: "loading" }); }

  useEffect(() => {
    if (isPending || !user || role !== "admin") return;
    const controller = new AbortController();
    let cancelled = false;
    fetchApplications(status, page, controller.signal)
      .then((data) => { if (!cancelled) setState({ phase: "success", data }); })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof AdminApplicationsError) { setState({ phase: "error", error }); return; }
        setState({ phase: "error", error: new AdminApplicationsError("server", "Something went wrong while loading applications. Please try again.") });
      });
    return () => { cancelled = true; controller.abort(); };
  }, [status, page, reloadToken, isPending, user, role]);

  useEffect(() => {
    if (notice?.kind !== "success") return;
    const timeout = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function restoreFocus() {
    const trigger = returnFocusRef.current;
    returnFocusRef.current = null;
    if (trigger && document.contains(trigger)) trigger.focus();
    else document.getElementById("application-status-filter")?.focus();
  }

  function closeRejectDialog() {
    if (rejectTarget && inFlightRef.current.has(rejectTarget.userId)) return;
    setRejectTarget(null);
    setRejectError(null);
    restoreFocus();
  }

  function handleApprove(application: ApplicationRecord, trigger: HTMLButtonElement) {
    returnFocusRef.current = trigger;
    void runReview(application, "approve");
  }

  function handleRejectRequest(application: ApplicationRecord, trigger: HTMLButtonElement) {
    returnFocusRef.current = trigger;
    setRejectError(null);
    setRejectTarget(application);
  }

  async function runReview(application: ApplicationRecord, action: "approve" | "reject", reason?: string) {
    if (inFlightRef.current.has(application.userId)) return;
    inFlightRef.current.add(application.userId);
    setPending({ userId: application.userId, action });
    setNotice(null);
    setRejectError(null);

    try {
      const message = await reviewApplication(application.userId, action, reason);
      // Keep UI consistent without a full reload: remove reviewed rows when
      // the active filter no longer matches.
      const previous = state.phase === "success" ? state.data : null;
      if (previous) {
        const isStillVisible = status === "all" || status === (action === "approve" ? "approved" : "rejected");
        const items = isStillVisible
          ? previous.items.map((item) => item.userId === application.userId
              ? { ...item, status: action === "approve" ? "approved" as const : "rejected" as const, rejectionReason: reason ?? item.rejectionReason }
              : item)
          : previous.items.filter((item) => item.userId !== application.userId);
        const totalItems = isStillVisible ? previous.pagination.totalItems : Math.max(0, previous.pagination.totalItems - 1);
        const totalPages = Math.max(1, Math.ceil(totalItems / previous.pagination.limit));
        const currentPage = Math.min(previous.pagination.currentPage, totalPages);
        setState({
          phase: "success",
          data: {
            items,
            pagination: {
              ...previous.pagination,
              currentPage, totalItems, totalPages,
              hasNextPage: currentPage < totalPages,
              hasPrevPage: currentPage > 1,
            },
          },
        });
        if (items.length === 0 && currentPage !== previous.pagination.currentPage) {
          beginLoading();
          setPage(currentPage);
        }
      }
      setNotice({ kind: "success", message });
      inFlightRef.current.delete(application.userId);
      setPending(null);
      setRejectTarget(null);
      setRejectError(null);
      restoreFocus();
      return;
    } catch (error) {
      inFlightRef.current.delete(application.userId);
      setPending(null);
      if (error instanceof AdminApplicationsError && error.kind === "unauthorized") {
        setRejectTarget(null);
        setState({ phase: "error", error });
        return;
      }
      if (
        error instanceof AdminApplicationsError &&
        ["notfound", "conflict", "forbidden", "validation"].includes(error.kind)
      ) {
        setRejectTarget(null);
        setNotice({ kind: "error", message: error.message, showRefresh: true });
        restoreFocus();
        return;
      }
      const message = error instanceof Error ? error.message : "Something went wrong while reviewing this application.";
      if (action === "reject" && rejectTarget?.userId === application.userId) setRejectError(message);
      else setNotice({ kind: "error", message, showRefresh: true });
    }
  }

  if (isPending) return <Skeleton />;
  if (!user) return null;
  if (role !== "admin") return <AccessDenied role={role === "customer" || role === "technician" ? role : null} />;

  const isLoading = state.phase === "loading";
  const totalItems = state.phase === "success" ? state.data.pagination.totalItems : null;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <label htmlFor="application-status-filter" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Status</label>
          <div className="relative mt-1.5">
            <select
              id="application-status-filter"
              value={status}
              onChange={(event) => { beginLoading(); setStatus(event.target.value as StatusFilter); setPage(1); }}
              className="w-full appearance-none rounded-lg border border-border-strong bg-surface py-2.5 pl-4 pr-10 text-sm font-medium text-foreground shadow-xs outline-none transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All statuses</option>
            </select>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"><path d="m6 9 6 6 6-6" /></svg>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalItems !== null && <p aria-live="polite" className="text-xs font-medium tabular-nums text-muted sm:text-sm">{totalItems} application{totalItems === 1 ? "" : "s"}</p>}
          <button type="button" onClick={() => { beginLoading(); setReloadToken((token) => token + 1); }} disabled={isLoading} aria-label="Refresh applications" className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-heading disabled:cursor-not-allowed disabled:opacity-60">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`h-5 w-5 ${isLoading ? "animate-spin motion-reduce:animate-none" : ""}`}><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
          </button>
        </div>
      </div>

      {notice && (
        <div role={notice.kind === "success" ? "status" : "alert"} className={`mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${notice.kind === "success" ? "border-success/40 bg-success-soft/60 text-success" : "border-error/40 bg-error-soft/60 text-error"}`}>
          <p className="min-w-0 flex-1 font-medium leading-relaxed">{notice.message}</p>
          {notice.showRefresh && (
            <button type="button" onClick={() => { setNotice(null); beginLoading(); setReloadToken((token) => token + 1); }} className="shrink-0 rounded-full border border-error/40 bg-surface px-3 py-1.5 text-xs font-semibold text-error hover:bg-error-soft">Refresh</button>
          )}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" className="shrink-0 text-xs font-semibold">✕</button>
        </div>
      )}

      <div className="mt-6" aria-busy={isLoading}>
        {state.phase === "loading" && <Skeleton />}
        {state.phase === "error" && (
          <div role="alert" className="rounded-2xl border border-error/40 bg-error-soft/60 px-5 py-10 text-center">
            <h2 className="text-lg font-bold text-heading">{state.error.kind === "unauthorized" ? "Session expired" : "Couldn't load applications"}</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{state.error.message}</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {state.error.kind === "unauthorized" ? (
                <Link href="/sign-in" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm">Sign in again</Link>
              ) : (
                <button type="button" onClick={() => { beginLoading(); setReloadToken((token) => token + 1); }} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm">Try again</button>
              )}
            </div>
          </div>
        )}
        {state.phase === "success" && state.data.items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted/30 px-6 py-14 text-center">
            <h2 className="text-lg font-bold text-heading">No applications here</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">Try a different status filter, or refresh to check for new submissions.</p>
          </div>
        )}
        {state.phase === "success" && state.data.items.length > 0 && (
          <>
            <ul className="grid gap-4 xl:grid-cols-2">
              {state.data.items.map((application) => (
                <li key={application.userId}>
                  <ApplicationCard
                    application={application}
                    onApprove={handleApprove}
                    onReject={handleRejectRequest}
                    busy={pending !== null}
                    pendingAction={pending?.userId === application.userId ? pending.action : null}
                  />
                </li>
              ))}
            </ul>
            <nav aria-label="Applications pagination" className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
              <button type="button" onClick={() => { beginLoading(); setPage(Math.max(1, state.data.pagination.currentPage - 1)); }} disabled={!state.data.pagination.hasPrevPage || isLoading} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
              <p className="text-xs font-medium tabular-nums text-muted">Page <span className="font-semibold text-heading">{state.data.pagination.currentPage}</span> of <span className="font-semibold text-heading">{Math.max(state.data.pagination.totalPages, 1)}</span></p>
              <button type="button" onClick={() => { beginLoading(); setPage(state.data.pagination.currentPage + 1); }} disabled={!state.data.pagination.hasNextPage || isLoading} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50">Next</button>
            </nav>
          </>
        )}
      </div>

      {rejectTarget && (
        <RejectDialog
          applicant={rejectTarget}
          pending={pending?.action === "reject" && pending.userId === rejectTarget.userId}
          error={rejectError}
          onDismiss={closeRejectDialog}
          onConfirm={(reason) => void runReview(rejectTarget, "reject", reason)}
        />
      )}
    </div>
  );
}
