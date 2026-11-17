"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { roleFromUser } from "@/components/dashboard/DashboardSidebar";

/* ================================================================== */
/*  Admin user management — safe user DTOs from GET /api/admin/users     */
/* ================================================================== */

type RoleFilter = "all" | "customer" | "technician" | "admin";
type Role = "customer" | "technician" | "admin";

interface SafeUser {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  phone: string | null;
  area: string | null;
  bio: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface Pagination {
  currentPage: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface UsersData {
  items: SafeUser[];
  pagination: Pagination;
}

type ErrorKind = "unauthorized" | "forbidden" | "network" | "server" | "parse";

class AdminUsersError extends Error {
  readonly kind: ErrorKind;
  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.name = "AdminUsersError";
    this.kind = kind;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const PAGE_SIZE = 10;
const DEBOUNCE_MS = 350;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const nullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

function parseUser(raw: unknown): SafeUser {
  if (!isRecord(raw)) throw new AdminUsersError("parse", "The server returned an unexpected user payload.");
  const role = raw.role;
  if (role !== "customer" && role !== "technician" && role !== "admin") {
    throw new AdminUsersError("parse", "The server returned an unknown user role.");
  }
  const id = raw.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new AdminUsersError("parse", "The server returned a user without an id.");
  }
  return {
    id,
    name: nullableString(raw.name),
    email: nullableString(raw.email),
    role,
    phone: nullableString(raw.phone),
    area: nullableString(raw.area),
    bio: nullableString(raw.bio),
    createdAt: nullableString(raw.createdAt),
    updatedAt: nullableString(raw.updatedAt),
  };
}

function parsePagination(raw: unknown): Pagination {
  if (!isRecord(raw)) throw new AdminUsersError("parse", "The server returned an unexpected pagination payload.");
  const currentPage = raw.currentPage, limit = raw.limit, totalItems = raw.totalItems, totalPages = raw.totalPages;
  if (
    typeof currentPage !== "number" || !Number.isFinite(currentPage) ||
    typeof limit !== "number" || !Number.isFinite(limit) ||
    typeof totalItems !== "number" || !Number.isFinite(totalItems) ||
    typeof totalPages !== "number" || !Number.isFinite(totalPages) ||
    typeof raw.hasNextPage !== "boolean" || typeof raw.hasPrevPage !== "boolean"
  ) throw new AdminUsersError("parse", "The server returned an unexpected pagination payload.");
  return { currentPage, limit, totalItems, totalPages, hasNextPage: raw.hasNextPage, hasPrevPage: raw.hasPrevPage };
}

function parseUsersResponse(body: unknown): UsersData {
  if (!isRecord(body)) throw new AdminUsersError("parse", "The server returned an unexpected response.");
  if (body.success !== true) {
    throw new AdminUsersError("server", typeof body.message === "string" ? body.message : "Couldn't load users.");
  }
  if (!Array.isArray(body.data)) throw new AdminUsersError("parse", "The server returned an unexpected users payload.");
  return { items: body.data.map(parseUser), pagination: parsePagination(body.pagination) };
}

async function fetchAccessToken(): Promise<string> {
  let response: { data: unknown; error: null | ({ status: number } & Record<string, unknown>) };
  try {
    response = await authClient.$fetch<{ token: string }>("/token", { method: "GET" });
  } catch {
    throw new AdminUsersError("network", "Couldn't reach the FixMate server to verify your session. Check your connection and try again.");
  }
  if (response.error) {
    if (response.error.status === 401 || response.error.status === 403) {
      throw new AdminUsersError("unauthorized", "Your session has expired. Sign in again to manage users.");
    }
    throw new AdminUsersError("server", "We couldn't verify your session right now. Please try again.");
  }
  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new AdminUsersError("server", "The FixMate server returned an unexpected session-token response.");
  }
  return data.token;
}

async function fetchUsers(search: string, role: RoleFilter, page: number, signal: AbortSignal): Promise<UsersData> {
  const token = await fetchAccessToken();
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (search) params.set("search", search);
  if (role !== "all") params.set("role", role);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/admin/users?${params.toString()}`, {
      method: "GET", headers: { Authorization: `Bearer ${token}` }, credentials: "include", signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AdminUsersError("network", "Couldn't reach the FixMate server. Check your connection and try again.");
  }
  if (response.status === 401) throw new AdminUsersError("unauthorized", "Your session has expired. Sign in again to manage users.");
  if (response.status === 403) throw new AdminUsersError("forbidden", "Admin access only. This account can't manage users.");
  let body: unknown = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) {
    throw new AdminUsersError("server", isRecord(body) && typeof body.message === "string" ? body.message : "Couldn't load users. Please try again.");
  }
  return parseUsersResponse(body);
}

/** Approved applicant IDs — used to avoid offering technician promotion to
 *  customers who haven't completed the application workflow. */
async function fetchApprovedApplicantIds(signal: AbortSignal): Promise<Set<string>> {
  const token = await fetchAccessToken();
  const ids = new Set<string>();
  let page = 1;
  try {
    for (;;) {
      const response = await fetch(`${API_BASE}/api/technician-applications?status=approved&page=${page}&limit=50`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }, credentials: "include", signal,
      });
      if (!response.ok) return ids;
      const body: unknown = await response.json();
      if (!isRecord(body) || !Array.isArray(body.data)) return ids;
      for (const item of body.data) {
        if (isRecord(item) && typeof item.userId === "string") ids.add(item.userId);
      }
      if (!isRecord(body.pagination) || body.pagination.hasNextPage !== true) break;
      page += 1;
    }
  } catch {
    return ids;
  }
  return ids;
}

async function updateRole(userId: string, role: "customer" | "technician"): Promise<string> {
  const token = await fetchAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(userId)}/role`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role }),
    });
  } catch {
    throw new AdminUsersError("network", "Couldn't reach the FixMate server. Check your connection and try again.");
  }
  if (response.status === 401) throw new AdminUsersError("unauthorized", "Your session has expired. Sign in again.");
  if (response.status === 403) throw new AdminUsersError("forbidden", "You can't change your own role.");
  if (response.status === 404) throw new AdminUsersError("server", "This user no longer exists.");
  if (response.status === 409) throw new AdminUsersError("server", "This role can't be changed right now — the user may already have the role, or an admin safety rule applies.");
  let body: unknown = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) {
    throw new AdminUsersError("server", isRecord(body) && typeof body.message === "string" ? body.message : "Couldn't update this role. Please try again.");
  }
  return isRecord(body) && typeof body.message === "string" ? body.message : "Role updated.";
}

/* ================================================================== */
/*  Role change dialog                                                 */
/* ================================================================== */

function RoleChangeDialog({
  user,
  nextRole,
  pending,
  error,
  onDismiss,
  onConfirm,
}: {
  user: SafeUser;
  nextRole: "customer" | "technician";
  pending: boolean;
  error: string | null;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
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
    confirmRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!pendingRef.current) onDismissRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusable = Array.from(node.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])'));
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6">
      <div aria-hidden="true" onClick={() => { if (!pendingRef.current) onDismissRef.current(); }} className="absolute inset-0 bg-navy-950/70 backdrop-blur-[2px]" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="role-change-title" aria-describedby="role-change-description" className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-lg sm:p-6">
        <h2 id="role-change-title" className="text-base font-bold text-heading">Change account role?</h2>
        <p id="role-change-description" className="mt-2 text-sm leading-relaxed text-muted">
          Change <span className="font-semibold text-heading">{user.name ?? user.email ?? "this user"}</span> from{" "}
          <span className="font-semibold text-heading">{user.role}</span> to{" "}
          <span className="font-semibold text-heading">{nextRole}</span>? Admin roles can&apos;t be assigned here.
        </p>
        {error && <div role="alert" className="mt-4 rounded-xl border border-error/40 bg-error-soft/60 px-4 py-3 text-xs leading-relaxed text-error">{error}</div>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onDismiss} disabled={pending} className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
          <button ref={confirmRef} type="button" onClick={onConfirm} disabled={pending} aria-live="polite" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">
            {pending ? "Updating…" : "Confirm change"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Main component                                                     */
/* ================================================================== */

export default function AdminUsers() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const role = roleFromUser(user);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(() => new Set());

  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: AdminUsersError }
    | { phase: "success"; data: UsersData }
  >({ phase: "loading" });

  const [changeTarget, setChangeTarget] = useState<{ user: SafeUser; nextRole: "customer" | "technician" } | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
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
    fetchUsers(debouncedSearch, roleFilter, page, controller.signal)
      .then((data) => { if (!cancelled) setState({ phase: "success", data }); })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          phase: "error",
          error: error instanceof AdminUsersError ? error : new AdminUsersError("server", "Something went wrong while loading users. Please try again."),
        });
      });
    return () => { cancelled = true; controller.abort(); };
  }, [debouncedSearch, roleFilter, page, reloadToken, isPending, user, role]);

  useEffect(() => {
    if (isPending || !user || role !== "admin") return;
    const controller = new AbortController();
    fetchApprovedApplicantIds(controller.signal).then(setApprovedIds).catch(() => setApprovedIds(new Set()));
    return () => controller.abort();
  }, [isPending, user, role, reloadToken]);

  useEffect(() => {
    if (notice?.kind !== "success") return;
    const timeout = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function restoreFocus() {
    const trigger = returnFocusRef.current;
    returnFocusRef.current = null;
    if (trigger && document.contains(trigger)) trigger.focus();
    else document.getElementById("admin-user-search")?.focus();
  }

  function closeDialog() {
    if (changeTarget && inFlightRef.current.has(changeTarget.user.id)) return;
    setChangeTarget(null);
    setChangeError(null);
    restoreFocus();
  }

  async function confirmChange() {
    if (!changeTarget) return;
    const { user: target, nextRole } = changeTarget;
    if (inFlightRef.current.has(target.id)) return;
    inFlightRef.current.add(target.id);
    setPendingUserId(target.id);
    setChangeError(null);
    try {
      const message = await updateRole(target.id, nextRole);
      const previous = state.phase === "success" ? state.data : null;
      if (previous) {
        const isStillVisible = roleFilter === "all" || roleFilter === nextRole;
        const items = isStillVisible
          ? previous.items.map((item) => item.id === target.id ? { ...item, role: nextRole } : item)
          : previous.items.filter((item) => item.id !== target.id);
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
      }
      setNotice({ kind: "success", message });
      inFlightRef.current.delete(target.id);
      setPendingUserId(null);
      setChangeTarget(null);
      restoreFocus();
      return;
    } catch (error) {
      inFlightRef.current.delete(target.id);
      setPendingUserId(null);
      const message = error instanceof Error ? error.message : "Couldn't change this role. Please try again.";
      if (error instanceof AdminUsersError && error.kind === "unauthorized") {
        setChangeTarget(null);
        setState({ phase: "error", error });
        return;
      }
      setChangeError(message);
      setNotice({ kind: "error", message, refresh: true });
    }
  }

  if (isPending) return <Skeleton />;
  if (!user) return null;
  if (role !== "admin") {
    return (
      <section className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-heading">Admin access only</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">User management is available to administrators only.</p>
        <Link href="/dashboard" className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm">Back to your dashboard</Link>
      </section>
    );
  }

  const isLoading = state.phase === "loading";
  const totalItems = state.phase === "success" ? state.data.pagination.totalItems : null;

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <div>
            <label htmlFor="admin-user-search" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Search users</label>
            <input
              id="admin-user-search"
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Name or email…"
              className="mt-1.5 h-11 w-full rounded-lg border border-border-strong bg-surface px-4 text-sm text-foreground placeholder:text-muted outline-none transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25"
            />
          </div>
          <div>
            <label htmlFor="admin-user-role-filter" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Role</label>
            <select
              id="admin-user-role-filter"
              value={roleFilter}
              onChange={(event) => { setState({ phase: "loading" }); setRoleFilter(event.target.value as RoleFilter); setPage(1); }}
              className="mt-1.5 h-11 w-full rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium text-foreground outline-none transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25"
            >
              <option value="all">All roles</option>
              <option value="customer">Customer</option>
              <option value="technician">Technician</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalItems !== null && <p aria-live="polite" className="text-xs font-medium tabular-nums text-muted sm:text-sm">{totalItems} user{totalItems === 1 ? "" : "s"}</p>}
          <button
            type="button"
            onClick={() => { setState({ phase: "loading" }); setReloadToken((token) => token + 1); }}
            disabled={isLoading}
            aria-label="Refresh users"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-heading disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`h-5 w-5 ${isLoading ? "animate-spin motion-reduce:animate-none" : ""}`}><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
          </button>
        </div>
      </div>

      {notice && (
        <div role={notice.kind === "success" ? "status" : "alert"} className={`mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${notice.kind === "success" ? "border-success/40 bg-success-soft/60 text-success" : "border-error/40 bg-error-soft/60 text-error"}`}>
          <p className="min-w-0 flex-1 font-medium">{notice.message}</p>
          {notice.refresh && <button type="button" onClick={() => { setNotice(null); setState({ phase: "loading" }); setReloadToken((token) => token + 1); }} className="rounded-full border border-error/40 bg-surface px-3 py-1.5 text-xs font-semibold">Refresh</button>}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">✕</button>
        </div>
      )}

      <div className="mt-6" aria-busy={isLoading}>
        {state.phase === "loading" && <Skeleton />}
        {state.phase === "error" && (
          <div role="alert" className="rounded-2xl border border-error/40 bg-error-soft/60 px-5 py-10 text-center">
            <h2 className="text-lg font-bold text-heading">{state.error.kind === "unauthorized" ? "Session expired" : "Couldn't load users"}</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{state.error.message}</p>
            <div className="mt-5 flex justify-center gap-3">
              {state.error.kind === "unauthorized" ? (
                <Link href="/sign-in" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm">Sign in again</Link>
              ) : (
                <button type="button" onClick={() => { setState({ phase: "loading" }); setReloadToken((token) => token + 1); }} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm">Try again</button>
              )}
            </div>
          </div>
        )}
        {state.phase === "success" && state.data.items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted/30 px-6 py-14 text-center">
            <h2 className="text-lg font-bold text-heading">No users found</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">Try a different search term or role filter.</p>
          </div>
        )}
        {state.phase === "success" && state.data.items.length > 0 && (
          <>
            <ul className="grid gap-3 lg:grid-cols-2">
              {state.data.items.map((item) => {
                const isSelf = item.id === user.id;
                const canPromote = item.role === "customer" && approvedIds.has(item.id);
                const canDemote = item.role === "technician";
                const canChange = !isSelf && item.role !== "admin" && (canPromote || canDemote);
                const nextRole: "customer" | "technician" | null = canPromote ? "technician" : canDemote ? "customer" : null;
                return (
                  <li key={item.id}>
                    <article className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-xs">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-heading">{item.name ?? "Unnamed user"}</h3>
                          <p className="mt-0.5 truncate text-xs text-muted">{item.email ?? "No email"}</p>
                        </div>
                        <span className="rounded-full border border-border-strong bg-surface-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">{item.role}</span>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
                        <div><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Phone</dt><dd className="mt-0.5 text-heading">{item.phone ?? "—"}</dd></div>
                        <div><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Area</dt><dd className="mt-0.5 text-heading">{item.area ?? "—"}</dd></div>
                        <div className="col-span-2"><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Joined</dt><dd className="mt-0.5 text-heading">{item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-GB") : "—"}</dd></div>
                      </dl>
                      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
                        <p className="text-[10px] text-muted">
                          {isSelf ? "Your account" : item.role === "admin" ? "Admin roles are managed via bootstrap" : item.role === "customer" && !canPromote ? "No approved application" : ""}
                        </p>
                        {canChange && nextRole && (
                          <button
                            type="button"
                            onClick={(event) => {
                              returnFocusRef.current = event.currentTarget;
                              setChangeError(null);
                              setChangeTarget({ user: item, nextRole });
                            }}
                            disabled={pendingUserId !== null}
                            className="rounded-full border border-accent-500/40 px-3 py-1.5 text-[11px] font-semibold text-accent-strong transition-colors duration-200 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60 dark:text-accent"
                          >
                            Make {nextRole}
                          </button>
                        )}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
            <nav aria-label="Users pagination" className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
              <button type="button" onClick={() => { setState({ phase: "loading" }); setPage(Math.max(1, state.data.pagination.currentPage - 1)); }} disabled={!state.data.pagination.hasPrevPage || isLoading} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
              <p className="text-xs font-medium tabular-nums text-muted">Page <span className="font-semibold text-heading">{state.data.pagination.currentPage}</span> of <span className="font-semibold text-heading">{Math.max(state.data.pagination.totalPages, 1)}</span></p>
              <button type="button" onClick={() => { setState({ phase: "loading" }); setPage(state.data.pagination.currentPage + 1); }} disabled={!state.data.pagination.hasNextPage || isLoading} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50">Next</button>
            </nav>
          </>
        )}
      </div>

      {changeTarget && (
        <RoleChangeDialog
          user={changeTarget.user}
          nextRole={changeTarget.nextRole}
          pending={pendingUserId === changeTarget.user.id}
          error={changeError}
          onDismiss={closeDialog}
          onConfirm={() => void confirmChange()}
        />
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading users…" className="grid gap-3 lg:grid-cols-2">
      <span className="sr-only">Loading users…</span>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} aria-hidden="true" className="h-40 animate-pulse rounded-2xl border border-border bg-surface" />
      ))}
    </div>
  );
}
