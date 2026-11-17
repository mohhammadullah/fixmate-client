"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/* ------------------------------------------------------------------ */
/*  Validation helpers                                                  */
/* ------------------------------------------------------------------ */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type FieldErrors = {
  email?: string;
  password?: string;
};

function validateEmail(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Email address is required.";
  if (!EMAIL_PATTERN.test(trimmed))
    return "Enter a valid email address (e.g. name@example.com).";
  return undefined;
}

function validatePassword(value: string): string | undefined {
  if (!value) return "Password is required.";
  if (value.length < 8) return "Password must be at least 8 characters long.";
  return undefined;
}

/** Map a Better Auth client error (or a thrown network failure) to a
 *  meaningful, user-facing message. */
function mapSignInError(error: {
  message?: string;
  code?: string;
  status?: number;
  statusText?: string;
}): string {
  const status = error.status;
  const code = (error.code ?? "").toUpperCase();
  const message = error.message ?? "";

  if (
    status === 401 ||
    code.includes("INVALID_EMAIL_OR_PASSWORD") ||
    /invalid (email|credential|password)/i.test(message)
  ) {
    return "Invalid email or password. Please check your credentials and try again.";
  }
  if (status === 429 || code.includes("RATE_LIMIT") || /too many/i.test(message)) {
    return "Too many sign-in attempts. Please wait a few minutes and try again.";
  }
  if (status === 403) {
    return "Your account is not allowed to sign in right now. Please contact FixMate support.";
  }
  if (typeof status === "number" && status >= 500) {
    return "The FixMate server ran into a problem. Please try again in a moment.";
  }
  if (message) return message;
  return "Something went wrong while signing you in. Please try again.";
}

/* ------------------------------------------------------------------ */
/*  Small inline icons                                                  */
/* ------------------------------------------------------------------ */

function Icon({ children, className }: { children: React.ReactNode; className?: string }) {
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
      {children}
    </svg>
  );
}

const iconProps = { className: "h-5 w-5" } as const;

/* ------------------------------------------------------------------ */
/*  Cinematic visual panel — custom repair-themed SVG illustration      */
/* ------------------------------------------------------------------ */

function RepairIllustration() {
  return (
    <svg
      viewBox="0 0 560 460"
      fill="none"
      role="img"
      aria-label="Illustration of a smartphone being serviced: a wrench and a gear over the phone's screen, surrounded by circuit traces and orbit rings"
      className="h-auto w-full max-w-md xl:max-w-lg"
    >
      <defs>
        <linearGradient id="wrenchGrad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0369a1" />
          <stop offset="0.45" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#7dd3fc" />
        </linearGradient>
        <linearGradient id="phoneGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12263f" />
          <stop offset="1" stopColor="#0b1b30" />
        </linearGradient>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="#0ea5e9" stopOpacity="0.15" />
          <stop offset="1" stopColor="#38bdf8" stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id="coreGlow" cx="0.5" cy="0.46" r="0.6">
          <stop offset="0" stopColor="#0ea5e9" stopOpacity="0.32" />
          <stop offset="0.55" stopColor="#0ea5e9" stopOpacity="0.08" />
          <stop offset="1" stopColor="#0ea5e9" stopOpacity="0" />
        </radialGradient>
        <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ambient core glow */}
      <circle cx="280" cy="212" r="165" fill="url(#coreGlow)" />

      {/* Orbit rings */}
      <circle
        cx="280"
        cy="212"
        r="152"
        stroke="url(#ringGrad)"
        strokeWidth="1.5"
        strokeDasharray="4 9"
      />
      <circle cx="280" cy="212" r="108" stroke="#1f3a5f" strokeWidth="1.5" />

      {/* Satellite nodes on the orbit */}
      <circle cx="280" cy="60" r="4.5" fill="#38bdf8" opacity="0.9" />
      <circle cx="432" cy="212" r="4.5" fill="#0ea5e9" opacity="0.8" />
      <circle cx="130" cy="212" r="4.5" fill="#0ea5e9" opacity="0.55" />

      {/* Corner circuit traces */}
      <g stroke="#2fb8f5" strokeOpacity="0.38" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M28 118 V66 L66 28 H118" />
        <path d="M532 342 V394 L494 432 H442" />
        <path d="M28 320 V356 L52 380 H96" />
        <path d="M532 108 V74 L506 48 H462" />
      </g>
      <g fill="#0d1f36" stroke="#38bdf8" strokeOpacity="0.6" strokeWidth="2">
        <circle cx="118" cy="28" r="4" />
        <circle cx="28" cy="118" r="4" />
        <circle cx="442" cy="432" r="4" />
        <circle cx="532" cy="342" r="4" />
        <circle cx="96" cy="380" r="4" />
        <circle cx="462" cy="48" r="4" />
      </g>

      {/* Wrench behind the phone — scaled Lucide-style path */}
      <g
        transform="translate(118 86) rotate(-24 96 96) scale(8.4)"
        stroke="url(#wrenchGrad)"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.92"
        filter="url(#softGlow)"
      >
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </g>

      {/* Smartphone body */}
      <rect x="222" y="128" width="116" height="196" rx="22" fill="url(#phoneGrad)" stroke="#38bdf8" strokeWidth="3" />
      {/* Side buttons */}
      <g stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" opacity="0.85">
        <path d="M222 178 H214" />
        <path d="M222 204 H214" />
        <path d="M338 190 H346" />
      </g>
      {/* Speaker slot + screen */}
      <path d="M264 150 H296" stroke="#7dd3fc" strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
      <rect x="236" y="162" width="88" height="126" rx="10" stroke="#1f3a5f" strokeWidth="2" fill="#060d17" fillOpacity="0.55" />

      {/* Gear on the screen — 8 teeth around a hub */}
      <g transform="translate(280 225)">
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            key={i}
            x="-5"
            y="-26"
            width="10"
            height="11"
            rx="2.5"
            transform={`rotate(${i * 45})`}
            fill="#0ea5e9"
            fillOpacity="0.85"
          />
        ))}
        <circle r="17.5" fill="#0d1f36" stroke="#7dd3fc" strokeWidth="2.5" />
        <circle r="6" stroke="#38bdf8" strokeWidth="2" />
      </g>
      {/* Home indicator */}
      <path d="M262 306 H298" stroke="#7dd3fc" strokeWidth="3" strokeLinecap="round" opacity="0.55" />

      {/* Verified-repair check badge */}
      <g transform="translate(352 146)" filter="url(#softGlow)">
        <circle r="17" fill="#0ea5e9" stroke="#04121f" strokeWidth="3" />
        <path d="M-6.5 0.5 L-2 5 L7 -5" stroke="#04121f" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Spark accents */}
      <g fill="#7dd3fc">
        <path d="M168 110 L171.1 118.9 L180 122 L171.1 125.1 L168 134 L164.9 125.1 L156 122 L164.9 118.9 Z" opacity="0.95" />
        <path d="M404 268 L406.2 273.8 L412 276 L406.2 278.2 L404 284 L401.8 278.2 L396 276 L401.8 273.8 Z" opacity="0.8" />
        <path d="M388 344 L389.6 348.4 L394 350 L389.6 351.6 L388 356 L386.4 351.6 L382 350 L386.4 348.4 Z" opacity="0.65" />
      </g>
    </svg>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500/15 text-accent-400 ring-1 ring-inset ring-accent-400/30"
      >
        <Icon className="h-5 w-5">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </Icon>
      </span>
      <span className={`font-bold tracking-tight ${compact ? "text-lg" : "text-xl"} text-[#f2f7fd]`}>
        Fix<span className="text-accent-400">Mate</span>
      </span>
    </span>
  );
}

const PANEL_STEPS = [
  { step: "01", title: "Tell us what's broken", detail: "Describe the issue and pick a time that suits you." },
  { step: "02", title: "Get matched with a pro", detail: "Verified technicians for devices and home appliances." },
  { step: "03", title: "Track your repair", detail: "Follow progress from booking to fixed, in one place." },
] as const;

/* ------------------------------------------------------------------ */
/*  Sign In form (client)                                               */
/* ------------------------------------------------------------------ */

export default function SignInForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function handleBlur(field: "email" | "password") {
    setFieldErrors((prev) => ({
      ...prev,
      [field]: field === "email" ? validateEmail(email) : validatePassword(password),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const errors: FieldErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setFieldErrors(errors);
    setFormError(null);

    if (errors.email || errors.password) {
      if (errors.email) emailRef.current?.focus();
      else passwordRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (error) {
        setFormError(mapSignInError(error));
        setIsSubmitting(false);
        return;
      }

      // Success — Better Auth has set the session cookie. Send the user to
      // the homepage (the only relevant post-auth destination that exists today).
      router.push("/");
      router.refresh();
    } catch {
      setFormError(
        "Unable to reach the FixMate server. Check your connection — and that the backend is running — then try again."
      );
      setIsSubmitting(false);
    }
  }

  const emailError = fieldErrors.email;
  const passwordError = fieldErrors.password;

  const inputBase =
    "w-full rounded-lg border bg-surface py-2.5 pl-11 pr-12 text-sm text-foreground shadow-xs outline-none transition-colors duration-200 placeholder:text-muted/80 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25";
  const inputValid = "border-border-strong hover:border-border-strong";
  const inputInvalid = "border-error bg-error-soft/40";

  return (
    <main className="relative flex-1 overflow-x-clip bg-background">
      {/* Faint ambient glow behind the form column */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-[-15%] h-96 w-96 rounded-full bg-accent-400/10 blur-3xl"
      />

      <div className="grid min-h-[calc(100svh-4rem)] lg:grid-cols-[1.05fr_1fr]">
        {/* ============ Left: cinematic visual panel (desktop) ============ */}
        <aside className="relative hidden overflow-hidden bg-navy-950 text-[#dbe4ef] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-14">
          {/* Backdrop: grid + glows */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(56,189,248,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.055) 1px, transparent 1px)",
              backgroundSize: "46px 46px",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-accent-600/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 right-[-10%] h-80 w-80 rounded-full bg-accent-400/15 blur-3xl"
          />

          {/* Brand row */}
          <div className="relative">
            <BrandMark />
          </div>

          {/* Illustration + narrative */}
          <div className="relative flex flex-col items-center gap-8 py-8">
            <RepairIllustration />
            <div className="max-w-md text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-400">
                Customer Portal
              </p>
              <h2 className="mt-3 text-3xl font-extrabold leading-[1.15] tracking-tight text-[#f2f7fd] xl:text-4xl">
                Welcome back to the{" "}
                <span className="bg-gradient-to-r from-accent-400 via-accent-500 to-accent-600 bg-clip-text text-transparent">
                  workshop
                </span>
                .
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#a8bdd4]">
                Sign in to book repairs, follow job progress and reach your
                technician — every device and appliance, one account.
              </p>
            </div>
          </div>

          {/* How it works — honest 3-step footer */}
          <ol className="relative grid grid-cols-3 gap-4 border-t border-[#1f3a5f] pt-6">
            {PANEL_STEPS.map((item) => (
              <li key={item.step} className="min-w-0">
                <span className="font-mono text-[11px] font-semibold tracking-widest text-accent-400">
                  {item.step}
                </span>
                <p className="mt-1 text-xs font-semibold leading-snug text-[#e6edf6]">
                  {item.title}
                </p>
                <p className="mt-1 hidden text-[11px] leading-snug text-[#8ba3bd] xl:block">
                  {item.detail}
                </p>
              </li>
            ))}
          </ol>
        </aside>

        {/* ============ Mobile / tablet: compact cinematic banner ============ */}
        <div className="relative overflow-hidden bg-navy-950 px-6 py-6 sm:px-10 lg:hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent-600/25 blur-3xl"
          />
          <div className="relative flex items-center justify-between gap-6">
            <div className="min-w-0">
              <BrandMark compact />
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-400">
                Customer Portal
              </p>
              <p className="mt-1 text-lg font-bold leading-snug text-[#f2f7fd]">
                Welcome back to the workshop.
              </p>
              <p className="mt-1 text-xs leading-snug text-[#a8bdd4]">
                Sign in to book and track your repairs.
              </p>
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-20 w-20 shrink-0 text-accent-400/80 sm:h-24 sm:w-24"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
        </div>

        {/* ============ Right: form column ============ */}
        <div className="relative flex items-center justify-center px-4 py-10 sm:px-8 sm:py-14 lg:px-10">
          <div className="w-full max-w-md">
            {/* Back to homepage */}
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full text-xs font-medium text-muted transition-colors duration-200 hover:text-heading"
            >
              <Icon className="h-4 w-4">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </Icon>
              Back to homepage
            </Link>

            {/* Card */}
            <div className="mt-4 rounded-2xl border border-border bg-surface p-6 shadow-lg sm:p-8">
              {/* Heading */}
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-strong dark:text-accent">
                Welcome back
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">
                Sign in to FixMate
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Use the email and password linked to your FixMate account.
              </p>

              {/* Form-level error banner */}
              {formError && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-3 rounded-lg border border-error/40 bg-error-soft px-4 py-3 text-sm text-error"
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v4M12 16h.01" />
                  </Icon>
                  <span className="leading-snug">{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting} className="mt-6 space-y-5">
                {/* -------- Email -------- */}
                <div>
                  <label htmlFor="email" className="text-sm font-semibold text-heading">
                    Email address
                  </label>
                  <div className="relative mt-1.5">
                    <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted">
                      <rect x="2" y="4" width="20" height="16" rx="3" />
                      <path d="m3 6 9 7 9-7" />
                    </Icon>
                    <input
                      ref={emailRef}
                      id="email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        if (fieldErrors.email) {
                          setFieldErrors((prev) => ({ ...prev, email: validateEmail(event.target.value) }));
                        }
                      }}
                      onBlur={() => handleBlur("email")}
                      aria-invalid={emailError ? true : undefined}
                      aria-describedby={emailError ? "email-error" : undefined}
                      className={`${inputBase} ${emailError ? inputInvalid : inputValid}`}
                    />
                  </div>
                  {emailError && (
                    <p id="email-error" role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs leading-snug text-error">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 8v4M12 16h.01" />
                      </Icon>
                      {emailError}
                    </p>
                  )}
                </div>

                {/* -------- Password -------- */}
                <div>
                  <label htmlFor="password" className="text-sm font-semibold text-heading">
                    Password
                  </label>
                  <div className="relative mt-1.5">
                    <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </Icon>
                    <input
                      ref={passwordRef}
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      placeholder="Your password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        if (fieldErrors.password) {
                          setFieldErrors((prev) => ({ ...prev, password: validatePassword(event.target.value) }));
                        }
                      }}
                      onBlur={() => handleBlur("password")}
                      aria-invalid={passwordError ? true : undefined}
                      aria-describedby={passwordError ? "password-error" : "password-hint"}
                      className={`${inputBase} ${passwordError ? inputInvalid : inputValid}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-pressed={showPassword}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-heading"
                    >
                      {showPassword ? (
                        <Icon {...iconProps}>
                          <path d="M17.94 17.94A10.6 10.6 0 0 1 12 19c-5.05 0-9.27-3.9-11-7 1.02-1.84 2.7-3.6 4.75-4.85M9.9 4.24A10.8 10.8 0 0 1 12 5c5.05 0 9.27 3.9 11 7a13.2 13.2 0 0 1-1.84 2.58" />
                          <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
                          <path d="M3 3l18 18" />
                        </Icon>
                      ) : (
                        <Icon {...iconProps}>
                          <path d="M2 12s4.5-7 10-7 10 7 10 7-4.5 7-10 7S2 12 2 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </Icon>
                      )}
                    </button>
                  </div>
                  {passwordError ? (
                    <p id="password-error" role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs leading-snug text-error">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 8v4M12 16h.01" />
                      </Icon>
                      {passwordError}
                    </p>
                  ) : (
                    <p id="password-hint" className="mt-1.5 text-xs text-muted">
                      At least 8 characters.
                    </p>
                  )}
                </div>

                {/* -------- Submit -------- */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="relative inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Signing you in…
                    </>
                  ) : (
                    <>
                      Sign In
                      <Icon className="h-4 w-4">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </Icon>
                    </>
                  )}
                </button>
              </form>

              {/* Divider + sign-up link */}
              <div className="mt-6 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted">New here?</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <p className="mt-4 text-center text-sm text-muted">
                Don&apos;t have an account?{" "}
                <Link
                  href="/sign-up"
                  className="font-semibold text-accent-strong underline underline-offset-4 transition-colors duration-200 hover:text-accent dark:text-accent dark:hover:text-accent-strong"
                >
                  Create your FixMate account
                </Link>
              </p>
            </div>

            {/* Reassurance row */}
            <p className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] leading-snug text-muted">
              <Icon className="h-3.5 w-3.5 shrink-0">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </Icon>
              Secured with encrypted session cookies.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
