"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import {
  ROLE_LABELS,
  type DashboardRole,
} from "@/components/dashboard/DashboardSidebar";

/** User profile — GET/PATCH /api/users/me. JWT is fetched per request via Better Auth and never stored/logged/persisted. */

type ProfileRole = DashboardRole;

interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  role: ProfileRole;
  phone: string | null;
  area: string | null;
  bio: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  technicianApplicationStatus: "pending" | "approved" | "rejected" | null;
}

type ErrorKind = "unauthorized" | "forbidden" | "network" | "server" | "parse" | "notfound" | "validation";

class ProfileError extends Error {
  readonly kind: ErrorKind;
  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.name = "ProfileError";
    this.kind = kind;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const PHONE_PATTERN = /^[0-9+\-()\s]{5,30}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const nullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

function parseProfile(raw: unknown): Profile {
  if (!isRecord(raw)) throw new ProfileError("parse", "The server returned an unexpected profile payload.");
  const role = raw.role;
  if (role !== "customer" && role !== "technician" && role !== "admin") {
    throw new ProfileError("parse", "The server returned an unknown account role.");
  }
  const id = raw.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new ProfileError("parse", "The server returned a profile without an id.");
  }
  const appStatus = raw.technicianApplicationStatus;
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
    technicianApplicationStatus:
      appStatus === "pending" || appStatus === "approved" || appStatus === "rejected" ? appStatus : null,
  };
}

async function fetchAccessToken(): Promise<string> {
  let response: { data: unknown; error: null | ({ status: number } & Record<string, unknown>) };
  try {
    response = await authClient.$fetch<{ token: string }>("/token", { method: "GET" });
  } catch {
    throw new ProfileError("network", "Couldn't reach the FixMate server to verify your session. Check your connection and try again.");
  }
  if (response.error) {
    if (response.error.status === 401 || response.error.status === 403) {
      throw new ProfileError("unauthorized", "Your session has expired. Sign in again to view your profile.");
    }
    throw new ProfileError("server", "We couldn't verify your session right now. Please try again.");
  }
  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new ProfileError("server", "The FixMate server returned an unexpected session-token response.");
  }
  return data.token;
}

async function fetchProfile(signal: AbortSignal): Promise<Profile> {
  const token = await fetchAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/users/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ProfileError("network", "Couldn't reach the FixMate server. Check your connection and try again.");
  }
  if (response.status === 401) throw new ProfileError("unauthorized", "Your session has expired. Sign in again to view your profile.");
  if (response.status === 403) throw new ProfileError("forbidden", "You can't view this profile.");
  if (response.status === 404) throw new ProfileError("notfound", "Your account could not be found.");
  let body: unknown = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) throw new ProfileError("server", isRecord(body) && typeof body.message === "string" ? body.message : "Couldn't load your profile. Please try again.");
  if (!isRecord(body) || body.success !== true) throw new ProfileError("server", "The server returned an unexpected response.");
  return parseProfile(body.data);
}

interface EditValues {
  name: string;
  phone: string;
  area: string;
  bio: string;
}

type FieldErrors = Partial<Record<keyof EditValues, string>>;

function validate(values: EditValues): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  if (name.length < 1) errors.name = "Name cannot be empty.";
  else if (name.length > 100) errors.name = "Name must be at most 100 characters.";

  const phone = values.phone.trim();
  if (phone.length > 0 && !PHONE_PATTERN.test(phone)) {
    errors.phone = "Phone must be 5–30 characters using digits, +, -, ( ) or spaces.";
  }
  if (values.area.trim().length > 120) errors.area = "Area must be at most 120 characters.";
  if (values.bio.trim().length > 1000) errors.bio = "Bio must be at most 1000 characters.";
  return errors;
}

async function updateProfile(values: EditValues): Promise<Profile> {
  const token = await fetchAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/users/me`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      credentials: "include",
      // Only editable fields — no email, role or application data.
      body: JSON.stringify({
        name: values.name.trim(),
        phone: values.phone.trim(),
        area: values.area.trim(),
        bio: values.bio.trim(),
      }),
    });
  } catch {
    throw new ProfileError("network", "Couldn't reach the FixMate server. Check your connection and try again.");
  }
  if (response.status === 401) throw new ProfileError("unauthorized", "Your session has expired. Sign in again to save your profile.");
  if (response.status === 403) throw new ProfileError("forbidden", "You can't update this profile.");
  if (response.status === 404) throw new ProfileError("notfound", "Your account could not be found.");
  let body: unknown = null;
  try { body = await response.json(); } catch {}
  if (response.status === 400) {
    throw new ProfileError("validation", "Some details were rejected. Please review the highlighted fields.");
  }
  if (!response.ok) throw new ProfileError("server", isRecord(body) && typeof body.message === "string" ? body.message : "Couldn't save your profile. Please try again.");
  if (!isRecord(body) || body.success !== true) throw new ProfileError("server", "The server returned an unexpected response.");
  return parseProfile(body.data);
}


const inputBase =
  "w-full rounded-xl border border-border-strong bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted shadow-xs outline-none transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25 aria-[invalid=true]:border-error/60";

function Field({
  id,
  label,
  error,
  helper,
  children,
  readOnly = false,
}: {
  id: string;
  label: string;
  error?: string;
  helper?: string;
  children: React.ReactNode;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
        {readOnly && <span className="ml-2 normal-case tracking-normal text-muted">(read only)</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {!error && helper && <p className="mt-1.5 text-[11px] leading-snug text-muted">{helper}</p>}
      {error && <p role="alert" className="mt-1.5 text-[11px] font-medium text-error">{error}</p>}
    </div>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading profile…" className="grid gap-6 lg:grid-cols-5">
      <span className="sr-only">Loading profile…</span>
      <div aria-hidden="true" className="h-72 animate-pulse rounded-2xl border border-border bg-surface lg:col-span-2" />
      <div aria-hidden="true" className="h-96 animate-pulse rounded-2xl border border-border bg-surface lg:col-span-3" />
    </div>
  );
}

const ROLE_STYLES: Record<DashboardRole, string> = {
  customer: "border-accent-500/40 bg-accent-50 text-accent-strong dark:border-accent-400/30 dark:bg-accent-400/10 dark:text-accent",
  technician: "border-success/40 bg-success-soft text-success",
  admin: "border-warning/40 bg-warning-soft text-warning",
};

const APPLICATION_STATUS_LABELS: Record<"pending" | "approved" | "rejected", string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};
const APPLICATION_STATUS_STYLES: Record<"pending" | "approved" | "rejected", string> = {
  pending: "border-warning/40 bg-warning-soft text-warning",
  approved: "border-success/40 bg-success-soft text-success",
  rejected: "border-error/40 bg-error-soft text-error",
};

function initials(name: string | null, email: string | null): string {
  const base = (name?.trim() || email?.trim() || "").trim();
  if (!base) return "?";
  const parts = base.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase();
}


export default function UserProfile() {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: ProfileError }
    | { phase: "success"; profile: Profile }
  >({ phase: "loading" });

  const [values, setValues] = useState<EditValues>({ name: "", phone: "", area: "", bio: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    fetchProfile(controller.signal)
      .then((profile) => {
        if (cancelled) return;
        setState({ phase: "success", profile });
        setValues({
          name: profile.name ?? "",
          phone: profile.phone ?? "",
          area: profile.area ?? "",
          bio: profile.bio ?? "",
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          phase: "error",
          error: error instanceof ProfileError
            ? error
            : new ProfileError("server", "Something went wrong while loading your profile. Please try again."),
        });
      });
    return () => { cancelled = true; controller.abort(); };
  }, [reloadToken]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function update(key: keyof EditValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveInFlightRef.current) return;
    const fieldErrors = validate(values);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      setFormError("Please fix the highlighted fields and try again.");
      return;
    }
    saveInFlightRef.current = true;
    setSaving(true);
    setFormError(null);
    setErrors({});
    setNotice(null);
    try {
      const profile = await updateProfile(values);
      setState({ phase: "success", profile });
      setValues({
        name: profile.name ?? "",
        phone: profile.phone ?? "",
        area: profile.area ?? "",
        bio: profile.bio ?? "",
      });
      setNotice("Profile updated successfully.");
      return;
    } catch (error) {
      if (error instanceof ProfileError && error.kind === "unauthorized") {
        setState({ phase: "error", error });
        return;
      }
      if (error instanceof ProfileError && error.kind === "validation") {
        setFormError(error.message);
        return;
      }
      setFormError(
        error instanceof Error ? error.message : "Couldn't save your profile. Please try again."
      );
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  if (state.phase === "loading") return <Skeleton />;

  if (state.phase === "error") {
    const unauthorized = state.error.kind === "unauthorized";
    return (
      <div role="alert" className="rounded-2xl border border-error/40 bg-error-soft/60 px-5 py-10 text-center">
        <h2 className="text-lg font-bold text-heading">{unauthorized ? "Session expired" : "Couldn't load your profile"}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{state.error.message}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {unauthorized ? (
            <Link href="/sign-in" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm cursor-pointer transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:bg-primary-hover active:scale-[0.98]">Sign in again</Link>
          ) : (
            <button type="button" onClick={() => { setState({ phase: "loading" }); setReloadToken((token) => token + 1); }} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm cursor-pointer transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:bg-primary-hover active:scale-[0.98]">Try again</button>
          )}
        </div>
      </div>
    );
  }

  const { profile } = state;
  const joined = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  return (
    <div className="space-y-6">
      {notice && <div role="status" className="rounded-xl border border-success/40 bg-success-soft/60 px-4 py-3 text-sm font-medium text-success">{notice}</div>}

      <div className="grid gap-6 lg:grid-cols-5">
        <section aria-labelledby="profile-identity-heading" className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs lg:col-span-2">
          <div className="relative h-24 bg-navy-900">
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-accent-500/20 blur-2xl" />
          </div>
          <div className="-mt-10 px-5 pb-6 sm:px-6">
            <div aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-surface bg-accent-500 text-xl font-bold text-accent-foreground shadow-md">
              {initials(profile.name, profile.email)}
            </div>
            <h2 id="profile-identity-heading" className="mt-3 text-lg font-extrabold tracking-tight text-heading">
              {profile.name ?? "Unnamed account"}
            </h2>
            <p className="mt-0.5 break-all text-xs text-muted">{profile.email ?? "No email"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${ROLE_STYLES[profile.role]}`}>
                {ROLE_LABELS[profile.role]}
              </span>
              {profile.technicianApplicationStatus && (
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${APPLICATION_STATUS_STYLES[profile.technicianApplicationStatus]}`}>
                  Application: {APPLICATION_STATUS_LABELS[profile.technicianApplicationStatus]}
                </span>
              )}
            </div>

            {profile.role === "customer" && profile.technicianApplicationStatus !== "approved" && (
              <Link
                href="/dashboard/become-technician"
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-accent-500/40 px-4 py-2 text-xs font-semibold text-accent-strong transition-colors duration-200 hover:bg-surface-muted dark:text-accent cursor-pointer active:bg-surface-muted"
              >
                {profile.technicianApplicationStatus === "rejected" ? "Apply again" : "Become a technician"}
              </Link>
            )}

            <dl className="mt-5 space-y-3 border-t border-border pt-5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Phone</dt>
                <dd className="text-right font-medium text-heading">{profile.phone ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Area</dt>
                <dd className="text-right font-medium text-heading">{profile.area ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Member since</dt>
                <dd className="text-right font-medium text-heading">{joined}</dd>
              </div>
            </dl>
            {profile.bio && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">About</p>
                <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-foreground">{profile.bio}</p>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="profile-edit-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6 lg:col-span-3">
          <h2 id="profile-edit-heading" className="text-lg font-extrabold tracking-tight text-heading">Edit profile</h2>
          <p className="mt-1 text-xs text-muted">
            Update your contact details and short bio. Your name and role are
            never changed from this form.
          </p>

          {formError && (
            <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl border border-error/40 bg-error-soft/60 px-4 py-3 text-xs leading-relaxed text-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="profile-name-field" label="Full name" error={errors.name} helper="1–100 characters.">
                <input
                  id="profile-name-field"
                  type="text"
                  value={values.name}
                  onChange={(event) => update("name", event.target.value)}
                  disabled={saving}
                  required
                  autoComplete="name"
                  aria-invalid={Boolean(errors.name) || undefined}
                  className={inputBase}
                />
              </Field>
              <Field id="profile-phone-field" label="Phone" error={errors.phone} helper="Optional — 5–30 characters: digits, +, -, ( ) or spaces.">
                <input
                  id="profile-phone-field"
                  type="tel"
                  value={values.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  disabled={saving}
                  autoComplete="tel"
                  aria-invalid={Boolean(errors.phone) || undefined}
                  className={inputBase}
                />
              </Field>
              <Field id="profile-area-field" label="Service area" error={errors.area} helper="Optional — up to 120 characters.">
                <input
                  id="profile-area-field"
                  type="text"
                  value={values.area}
                  onChange={(event) => update("area", event.target.value)}
                  disabled={saving}
                  aria-invalid={Boolean(errors.area) || undefined}
                  className={inputBase}
                />
              </Field>
              <Field id="profile-email-field" label="Email" readOnly helper="Email addresses can't be changed here.">
                <input
                  id="profile-email-field"
                  type="email"
                  value={profile.email ?? ""}
                  readOnly
                  disabled
                  className={`${inputBase} opacity-70`}
                />
              </Field>
            </div>

            <Field id="profile-bio-field" label="Bio" error={errors.bio} helper="Optional — up to 1000 characters.">
              <textarea
                id="profile-bio-field"
                rows={4}
                value={values.bio}
                onChange={(event) => update("bio", event.target.value)}
                disabled={saving}
                aria-invalid={Boolean(errors.bio) || undefined}
                className={`${inputBase} resize-y`}
                placeholder="A short introduction…"
              />
            </Field>

            <Field id="profile-role-field" label="Account role" readOnly helper="Roles change only through admin review — never from this form.">
              <input
                id="profile-role-field"
                type="text"
                value={ROLE_LABELS[profile.role]}
                readOnly
                disabled
                className={`${inputBase} opacity-70`}
              />
            </Field>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
              <button
                type="submit"
                disabled={saving}
                aria-live="polite"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 enabled:hover:bg-primary-hover enabled:hover:shadow-md enabled:active:bg-primary-hover enabled:active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none"><circle cx="12" cy="12" r="9" strokeOpacity="0.3" /><path d="M21 12a9 9 0 0 0-9-9" /></svg>
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
