"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { roleFromUser } from "@/components/dashboard/DashboardSidebar";

/** Technician application — a structured subdocument on the Better Auth user document. No role field is ever sent; role changes only happen through admin review. */

type ApplicationStatus = "pending" | "approved" | "rejected" | "none";

interface ApplicationView {
  status: ApplicationStatus;
  phone: string | null;
  area: string | null;
  bio: string | null;
  experience: number | null;
  skills: string[];
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
}

type ErrorKind = "unauthorized" | "forbidden" | "network" | "server" | "validation" | "conflict";

class ApplicationError extends Error {
  readonly kind: ErrorKind;
  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.name = "ApplicationError";
    this.kind = kind;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const PHONE_PATTERN = /^[0-9+\-()\s]{5,30}$/;

interface FormValues {
  phone: string;
  area: string;
  experience: string;
  bio: string;
}

type FieldErrors = Partial<Record<string, string>>;

function validateForm(values: FormValues, skills: string[]): FieldErrors {
  const errors: FieldErrors = {};
  const phone = values.phone.trim();
  if (!PHONE_PATTERN.test(phone)) {
    errors.phone = "Phone must be 5–30 characters using digits, +, -, ( ) or spaces.";
  }
  const area = values.area.trim();
  if (area.length < 2 || area.length > 120) {
    errors.area = "Area must be between 2 and 120 characters.";
  }
  const experience = Number(values.experience);
  if (
    values.experience.trim() === "" ||
    !Number.isInteger(experience) ||
    experience < 0 ||
    experience > 60
  ) {
    errors.experience = "Experience must be a whole number of years between 0 and 60.";
  }
  if (skills.length === 0) {
    errors.skills = "Add at least one skill.";
  } else if (skills.length > 20 || skills.some((skill) => skill.trim().length === 0 || skill.length > 60)) {
    errors.skills = "Up to 20 skills, each between 1 and 60 characters.";
  }
  const bio = values.bio.trim();
  if (bio.length < 20 || bio.length > 1000) {
    errors.bio = "Bio must be between 20 and 1000 characters.";
  }
  return errors;
}

function validateSkill(raw: string, existing: string[]): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "Skills cannot contain empty strings.";
  if (trimmed.length > 60) return "Each skill must be at most 60 characters.";
  if (existing.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
    return "That skill is already in the list.";
  }
  if (existing.length >= 20) return "Up to 20 skills are allowed.";
  return null;
}

async function fetchAccessToken(): Promise<string> {
  let response: {
    data: unknown;
    error: null | ({ status: number } & Record<string, unknown>);
  };
  try {
    response = await authClient.$fetch<{ token: string }>("/token", { method: "GET" });
  } catch {
    throw new ApplicationError(
      "network",
      "Couldn't reach the FixMate server to verify your session. Check your connection and try again."
    );
  }
  if (response.error) {
    if (response.error.status === 401 || response.error.status === 403) {
      throw new ApplicationError("unauthorized", "Your session has expired. Sign in again to continue.");
    }
    throw new ApplicationError("server", "We couldn't verify your session right now. Please try again.");
  }
  const data: unknown = response.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new ApplicationError("server", "The FixMate server returned an unexpected session-token response.");
  }
  const token = (data as Record<string, unknown>).token;
  if (typeof token !== "string" || token.length === 0) {
    throw new ApplicationError("server", "The FixMate server returned an unexpected session-token response.");
  }
  return token;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseApplication(raw: unknown): ApplicationView {
  if (!isRecord(raw)) throw new ApplicationError("server", "The server returned an unexpected application payload.");
  const status = raw.status;
  if (typeof status !== "string" || !["pending", "approved", "rejected", "none"].includes(status)) {
    throw new ApplicationError("server", "The server returned an unknown application status.");
  }
  const nullableString = (key: string): string | null =>
    typeof raw[key] === "string" ? (raw[key] as string) : null;
  return {
    status: status as ApplicationStatus,
    phone: nullableString("phone"),
    area: nullableString("area"),
    bio: nullableString("bio"),
    experience: typeof raw.experience === "number" ? raw.experience : null,
    skills: Array.isArray(raw.skills) ? raw.skills.filter((item): item is string => typeof item === "string") : [],
    submittedAt: nullableString("submittedAt"),
    reviewedAt: nullableString("reviewedAt"),
    reviewedBy: nullableString("reviewedBy"),
    rejectionReason: nullableString("rejectionReason"),
  };
}

async function fetchMyApplication(): Promise<ApplicationView | null> {
  const token = await fetchAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/technician-applications/my`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
  } catch {
    throw new ApplicationError("network", "Couldn't reach the FixMate server. Check your connection and try again.");
  }
  if (response.status === 401) throw new ApplicationError("unauthorized", "Your session has expired. Sign in again to continue.");
  if (response.status === 403) throw new ApplicationError("forbidden", "Only customer accounts can apply to become a technician.");
  let body: unknown = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === "string" ? body.message : "Couldn't load your application. Please try again.";
    throw new ApplicationError("server", message);
  }
  if (!isRecord(body) || body.success !== true) throw new ApplicationError("server", "The server returned an unexpected response.");
  return body.data === null ? null : parseApplication(body.data);
}

async function submitApplication(payload: FormValues & { skills: string[] }): Promise<ApplicationView> {
  const token = await fetchAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/technician-applications`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      credentials: "include",
      // No role/status/reviewedBy — server-controlled fields are never sent.
      body: JSON.stringify({
        phone: payload.phone.trim(),
        area: payload.area.trim(),
        experience: Number(payload.experience),
        skills: payload.skills,
        bio: payload.bio.trim(),
      }),
    });
  } catch {
    throw new ApplicationError("network", "Couldn't reach the FixMate server. Check your connection and try again.");
  }
  if (response.status === 401) throw new ApplicationError("unauthorized", "Your session has expired. Sign in again to continue.");
  if (response.status === 403) throw new ApplicationError("forbidden", "Only customer accounts can apply to become a technician.");
  if (response.status === 409) throw new ApplicationError("conflict", "An application is already pending review. We'll show you its status below.");
  let body: unknown = null;
  try { body = await response.json(); } catch {}
  if (response.status === 400) {
    throw new ApplicationError("validation", "Some details were rejected. Please review the highlighted fields.");
  }
  if (!response.ok || !isRecord(body) || body.success !== true) {
    const message = isRecord(body) && typeof body.message === "string" ? body.message : "Couldn't submit your application. Please try again.";
    throw new ApplicationError("server", message);
  }
  return parseApplication(body.data);
}


const inputBase =
  "w-full rounded-xl border border-border-strong bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted shadow-xs outline-none transition-colors duration-200 enabled:hover:border-accent-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25 aria-[invalid=true]:border-error/60";

function Field({
  id,
  label,
  helper,
  error,
  children,
  required = false,
}: {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
        {required && <span className="ml-1 text-error">*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {helper && !error && <p className="mt-1.5 text-[11px] leading-snug text-muted">{helper}</p>}
      {error && <p role="alert" className="mt-1.5 text-[11px] font-medium text-error">{error}</p>}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading your application…" className="space-y-6">
      <span className="sr-only">Loading your application…</span>
      <div aria-hidden="true" className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
    </div>
  );
}

function AccessDenied({ role }: { role: "technician" | "admin" | null }) {
  const label = role === "technician" ? "technician" : role === "admin" ? "admin" : null;
  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl border border-warning/40 bg-warning-soft text-warning">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-heading">This page is for customer accounts</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {label
          ? `You're signed in with a ${label} account, so the technician application isn't available here.`
          : "Your account's role isn't recognized. Please contact FixMate support if this looks wrong."}
      </p>
      <Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]">
        Back to your dashboard
      </Link>
    </section>
  );
}


function ApplicationForm({
  initial,
  onSubmitted,
}: {
  initial: FormValues;
  onSubmitted: (application: ApplicationView) => void;
}) {
  const [values, setValues] = useState<FormValues>(initial);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState("");
  const [skillError, setSkillError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);

  function update(key: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormError(null);
  }

  function addSkill(raw: string) {
    const mistake = validateSkill(raw, skills);
    if (mistake) {
      setSkillError(mistake);
      return;
    }
    setSkills((current) => [...current, raw.trim()]);
    setSkillDraft("");
    setSkillError(null);
    setErrors((current) => {
      if (!current.skills) return current;
      const next = { ...current };
      delete next.skills;
      return next;
    });
  }

  function removeSkill(index: number) {
    setSkills((current) => current.filter((_, i) => i !== index));
    setSkillError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlightRef.current) return;

    let effectiveSkills = skills;
    if (skillDraft.trim()) {
      const mistake = validateSkill(skillDraft, skills);
      if (mistake) {
        setSkillError(mistake);
        document.getElementById("application-skill-input")?.focus();
        return;
      }
      effectiveSkills = [...skills, skillDraft.trim()];
      setSkills(effectiveSkills);
      setSkillDraft("");
    }

    const fieldErrors = validateForm(values, effectiveSkills);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      setFormError("Please fix the highlighted fields and try again.");
      return;
    }

    submitInFlightRef.current = true;
    setSubmitting(true);
    setFormError(null);
    setErrors({});
    try {
      const application = await submitApplication({ ...values, skills: effectiveSkills });
      onSubmitted(application);
    } catch (error) {
      if (error instanceof ApplicationError && error.kind === "validation") {
        setFormError(error.message);
      } else if (error instanceof ApplicationError && error.kind === "unauthorized") {
        setFormError(error.message);
      } else {
        setFormError(
          error instanceof Error ? error.message : "Something went wrong while submitting. Please try again."
        );
      }
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-error/40 bg-error-soft/60 px-4 py-3 text-sm leading-relaxed text-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{formError}</span>
        </div>
      )}

      <fieldset className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
        <legend className="px-1 text-sm font-bold uppercase tracking-[0.14em] text-muted">Contact &amp; experience</legend>
        <div className="mt-1 grid gap-5 sm:grid-cols-2">
          <Field id="application-phone" label="Phone" required error={errors.phone} helper="5–30 characters: digits, +, -, ( ) or spaces.">
            <input id="application-phone" type="tel" value={values.phone} onChange={(e) => update("phone", e.target.value)} disabled={submitting} aria-invalid={Boolean(errors.phone) || undefined} className={inputBase} />
          </Field>
          <Field id="application-area" label="Service area" required error={errors.area} helper="Where you mainly work (2–120 characters).">
            <input id="application-area" type="text" value={values.area} onChange={(e) => update("area", e.target.value)} disabled={submitting} aria-invalid={Boolean(errors.area) || undefined} className={inputBase} />
          </Field>
          <Field id="application-experience" label="Years of experience" required error={errors.experience} helper="Whole number from 0 to 60.">
            <input id="application-experience" type="number" min={0} max={60} step={1} value={values.experience} onChange={(e) => update("experience", e.target.value)} disabled={submitting} aria-invalid={Boolean(errors.experience) || undefined} className={inputBase} />
          </Field>
          <Field id="application-skill-input" label="Skills" required error={skillError ?? errors.skills} helper="Type a skill and press Enter. Up to 20 skills, 60 characters each.">
            <div className={`rounded-xl border bg-background p-2 focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/25 ${skillError || errors.skills ? "border-error/60" : "border-border-strong"}`}>
              {skills.length > 0 && (
                <ul aria-label="Added skills" className="mb-2 flex flex-wrap gap-1.5">
                  {skills.map((skill, index) => (
                    <li key={`${skill}-${index}`} className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-muted py-1 pl-3 pr-1.5 text-xs font-medium text-foreground">
                      <span className="max-w-48 truncate">{skill}</span>
                      <button type="button" onClick={() => removeSkill(index)} disabled={submitting} aria-label={`Remove skill ${skill}`} className="flex h-5 w-5 items-center justify-center rounded-full text-muted transition-colors duration-200 enabled:hover:bg-error-soft enabled:hover:text-error cursor-pointer enabled:active:scale-90 disabled:cursor-not-allowed disabled:opacity-50">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3 w-3"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2">
                <input
                  id="application-skill-input"
                  type="text"
                  value={skillDraft}
                  onChange={(e) => { setSkillDraft(e.target.value); setSkillError(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(skillDraft); }
                  }}
                  disabled={submitting}
                  autoComplete="off"
                  aria-label="Add a skill"
                  placeholder="e.g. Laptop Repair"
                  className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted"
                />
                <button type="button" onClick={() => addSkill(skillDraft)} disabled={submitting || skillDraft.trim().length === 0} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted cursor-pointer enabled:active:bg-surface-muted enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">Add</button>
              </div>
            </div>
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
        <legend className="px-1 text-sm font-bold uppercase tracking-[0.14em] text-muted">About you</legend>
        <div className="mt-1">
          <Field id="application-bio" label="Bio" required error={errors.bio} helper="Tell customers about your repair experience (20–1000 characters).">
            <textarea id="application-bio" rows={5} value={values.bio} onChange={(e) => update("bio", e.target.value)} disabled={submitting} aria-invalid={Boolean(errors.bio) || undefined} className={`${inputBase} resize-y`} />
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-[11px] leading-relaxed text-muted">
          Submitting sends your application for admin review. Your account role stays
          <span className="font-semibold text-foreground"> customer</span> until an admin approves it.
        </p>
        <button type="submit" disabled={submitting} aria-live="polite" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 enabled:hover:bg-primary-hover enabled:hover:shadow-md cursor-pointer enabled:active:bg-primary-hover enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none">
                <circle cx="12" cy="12" r="9" strokeOpacity="0.3" /><path d="M21 12a9 9 0 0 0-9-9" />
              </svg>
              Submitting…
            </>
          ) : (
            "Submit application"
          )}
        </button>
      </div>
    </form>
  );
}


export default function TechnicianApplication() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const role = roleFromUser(user);

  const [application, setApplication] = useState<ApplicationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ kind: ErrorKind; message: string } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isPending || !user || role !== "customer") return;
    const controller = new AbortController();
    let cancelled = false;
    fetchMyApplication()
      .then((data) => {
        if (cancelled) return;
        setApplication(data);
        setLoadError(null);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApplicationError) {
          setLoadError({ kind: error.kind, message: error.message });
        } else {
          setLoadError({ kind: "server", message: "Something went wrong while loading your application. Please try again." });
        }
        setLoading(false);
      });
    return () => { cancelled = true; controller.abort(); };
  }, [isPending, user, role, reloadToken]);

  if (isPending) return <LoadingSkeleton />;
  if (!user) return null;
  if (role !== "customer") {
    return <AccessDenied role={role === "technician" || role === "admin" ? role : null} />;
  }
  if (loading) return <LoadingSkeleton />;

  const profile = (user ?? {}) as unknown as Record<string, unknown>;
  const initialValues: FormValues = {
    phone: application?.phone ?? (typeof profile.phone === "string" ? profile.phone : ""),
    area: application?.area ?? (typeof profile.area === "string" ? profile.area : ""),
    experience: application?.experience !== null && application?.experience !== undefined ? String(application.experience) : "",
    bio: application?.bio ?? (typeof profile.bio === "string" ? profile.bio : ""),
  };

  return (
    <div className="space-y-6">
      {loadError && (
        <div role="alert" className="rounded-2xl border border-error/40 bg-error-soft/60 px-5 py-6 text-center">
          <h2 className="text-lg font-bold text-heading">
            {loadError.kind === "unauthorized" ? "Session expired" : "Couldn't load your application"}
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">{loadError.message}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {loadError.kind === "unauthorized" ? (
              <Link href="/sign-in" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]">Sign in again</Link>
            ) : (
              <button type="button" onClick={() => { setLoading(true); setReloadToken((token) => token + 1); }} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]">Try again</button>
            )}
          </div>
        </div>
      )}

      {!loadError && submitted && application?.status === "pending" && (
        <div role="status" className="rounded-2xl border border-success/40 bg-success-soft/60 px-5 py-4 text-sm text-success">
          Application submitted. It&apos;s now awaiting admin review.
        </div>
      )}

      {!loadError && application?.status === "pending" && (
        <section className="rounded-2xl border border-warning/40 bg-warning-soft/60 p-6 text-center sm:p-8">
          <h2 className="text-lg font-extrabold tracking-tight text-heading">Application pending review</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Thanks for applying. An admin will review your details soon. Your account remains a
            customer until the application is approved.
          </p>
          {application.submittedAt && (
            <p className="mt-3 text-xs font-medium text-muted">
              Submitted {new Date(application.submittedAt).toLocaleString("en-GB")}
            </p>
          )}
        </section>
      )}

      {!loadError && application?.status === "approved" && (
        <section className="rounded-2xl border border-success/40 bg-success-soft/60 p-6 text-center sm:p-8">
          <h2 className="text-lg font-extrabold tracking-tight text-heading">You&apos;re now a technician</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Your application was approved. Your account is now a technician — sign in again if
            your dashboard still shows customer navigation, then manage your services.
          </p>
          <Link href="/dashboard/my-services" className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md cursor-pointer active:bg-primary-hover active:scale-[0.98]">Go to My Services</Link>
        </section>
      )}

      {!loadError && application?.status !== "pending" && application?.status !== "approved" && (
        <>
          {application?.status === "rejected" && (
            <section role="status" className="rounded-2xl border border-error/40 bg-error-soft/60 p-5 sm:p-6">
              <h2 className="text-base font-extrabold tracking-tight text-heading">Your previous application was rejected</h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                Reason: <span className="font-medium">{application.rejectionReason ?? "No reason was provided."}</span>
              </p>
              <p className="mt-1 text-xs text-muted">You can update your details and apply again below.</p>
            </section>
          )}
          <section className="rounded-2xl border border-border bg-surface/60 p-5 shadow-xs sm:p-7">
            <h2 className="text-lg font-extrabold tracking-tight text-heading">
              {application?.status === "rejected" ? "Apply again" : "Become a technician"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Share your experience and skills. An admin reviews every application before your
              account is promoted — you can&apos;t change your own role.
            </p>
            <div className="mt-6">
              <ApplicationForm
                initial={initialValues}
                onSubmitted={(next) => {
                  setApplication(next);
                  setSubmitted(true);
                }}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
