"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { safeAuthRedirect, withAuthCallback } from "@/lib/auth-redirect";
import { authClient } from "@/lib/auth-client";


const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_PATTERN = /^[\p{L}][\p{L}\s.'-]*$/u;
const PHONE_PATTERN = /^\+?[\d\s().-]+$/;
const AREA_PATTERN = /^[\p{L}\p{N}\s.,'()&/-]+$/u;

type FieldName =
  | "name"
  | "email"
  | "phone"
  | "area"
  | "password"
  | "confirmPassword";

type FieldErrors = Partial<Record<FieldName, string>>;

function validateName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Full name is required.";
  if (trimmed.length < 2) return "Enter your full name (at least 2 characters).";
  if (trimmed.length > 80) return "Name must be 80 characters or fewer.";
  if (!NAME_PATTERN.test(trimmed))
    return "Name can only contain letters, spaces, hyphens and apostrophes.";
  return undefined;
}

function validateEmail(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Email address is required.";
  if (!EMAIL_PATTERN.test(trimmed))
    return "Enter a valid email address (e.g. name@example.com).";
  return undefined;
}

function validatePhone(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Phone number is required.";
  if (!PHONE_PATTERN.test(trimmed))
    return "Enter a valid phone number (digits with optional +, spaces, dashes or parentheses).";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return "Phone number must contain at least 7 digits.";
  if (digits.length > 15) return "Phone number must contain at most 15 digits.";
  return undefined;
}

function validateArea(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Area / location is required (e.g. Dhanmondi, Dhaka).";
  if (trimmed.length < 2) return "Enter a valid area or location.";
  if (trimmed.length > 80) return "Area must be 80 characters or fewer.";
  if (!AREA_PATTERN.test(trimmed))
    return "Area can only contain letters, numbers, spaces and basic punctuation.";
  return undefined;
}

function validatePassword(value: string): string | undefined {
  if (!value) return "Password is required.";
  // Matches the backend's `minPasswordLength: 8` in fixmate-server.
  if (value.length < 8) return "Password must be at least 8 characters long.";
  return undefined;
}

function validateConfirmPassword(
  value: string,
  password: string
): string | undefined {
  if (!value) return "Please confirm your password.";
  if (value !== password) return "Passwords do not match.";
  return undefined;
}

/** Map a Better Auth client error (or a thrown network failure) to a
 *  meaningful, user-facing message. */
function mapSignUpError(error: {
  message?: string;
  code?: string;
  status?: number;
  statusText?: string;
}): string {
  const status = error.status;
  const code = (error.code ?? "").toUpperCase();
  const message = error.message ?? "";

  if (
    code.includes("USER_ALREADY_EXISTS") ||
    /already (exists|registered)|use another email/i.test(message) ||
    (status === 422 && /user/i.test(message))
  ) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (code.includes("INVALID_EMAIL")) {
    return "Enter a valid email address.";
  }
  if (code.includes("PASSWORD_TOO_SHORT") || /password.*too short/i.test(message)) {
    return "Password must be at least 8 characters long.";
  }
  if (code.includes("PASSWORD_TOO_LONG") || /password.*too long/i.test(message)) {
    return "Password is too long. Please choose a shorter one.";
  }
  if (status === 400 || code.includes("VALIDATION_ERROR") || code.includes("MISSING_FIELD")) {
    if (message && message.length <= 180) return message;
    return "Some of the details are invalid. Please review the form and try again.";
  }
  if (status === 429 || code.includes("RATE_LIMIT") || /too many/i.test(message)) {
    return "Too many sign-up attempts. Please wait a few minutes and try again.";
  }
  if (code.includes("FAILED_TO_CREATE_USER")) {
    return "We couldn't create your account. Please try again.";
  }
  if (typeof status === "number" && status >= 500) {
    return "The FixMate server ran into a problem. Please try again in a moment.";
  }
  if (message) return message;
  return "Something went wrong while creating your account. Please try again.";
}


function Icon({
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


function RegistrationIllustration() {
  return (
    <svg
      viewBox="0 0 560 460"
      fill="none"
      role="img"
      aria-label="Illustration of a repair work order on a clipboard: checked-off service checklist, a wrench and a key badge for the new account"
      className="h-auto w-full max-w-md xl:max-w-lg"
    >
      <defs>
        <linearGradient id="su-wrenchGrad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0369a1" />
          <stop offset="0.45" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#7dd3fc" />
        </linearGradient>
        <linearGradient id="su-boardGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12263f" />
          <stop offset="1" stopColor="#0b1b30" />
        </linearGradient>
        <linearGradient id="su-ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="#0ea5e9" stopOpacity="0.15" />
          <stop offset="1" stopColor="#38bdf8" stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id="su-coreGlow" cx="0.5" cy="0.46" r="0.6">
          <stop offset="0" stopColor="#0ea5e9" stopOpacity="0.32" />
          <stop offset="0.55" stopColor="#0ea5e9" stopOpacity="0.08" />
          <stop offset="1" stopColor="#0ea5e9" stopOpacity="0" />
        </radialGradient>
        <filter id="su-softGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ambient core glow */}
      <circle cx="280" cy="212" r="165" fill="url(#su-coreGlow)" />

      {/* Orbit rings */}
      <circle
        cx="280"
        cy="212"
        r="152"
        stroke="url(#su-ringGrad)"
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

      {/* Wrench behind the clipboard — scaled Lucide-style path */}
      <g
        transform="translate(120 78) rotate(-24 96 96) scale(8.4)"
        stroke="url(#su-wrenchGrad)"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.92"
        filter="url(#su-softGlow)"
      >
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </g>

      {/* Clipboard — the work order */}
      <rect x="214" y="118" width="132" height="196" rx="18" fill="url(#su-boardGrad)" stroke="#38bdf8" strokeWidth="3" />
      {/* Clip */}
      <rect x="250" y="104" width="60" height="28" rx="9" fill="#0d1f36" stroke="#7dd3fc" strokeWidth="2.5" />
      <circle cx="280" cy="118" r="3.4" fill="#060d17" stroke="#38bdf8" strokeWidth="2" />

      {/* Checklist rows */}
      {/* Row 1 — signed off */}
      <rect x="236" y="160" width="17" height="17" rx="4.5" fill="#0ea5e9" fillOpacity="0.22" stroke="#38bdf8" strokeWidth="2" />
      <path d="M240.5 168.5 L245 173 L252 163.5" stroke="#7dd3fc" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="262" y="164.5" width="58" height="7" rx="3.5" fill="#38bdf8" fillOpacity="0.5" />

      {/* Row 2 — signed off */}
      <rect x="236" y="197" width="17" height="17" rx="4.5" fill="#0ea5e9" fillOpacity="0.22" stroke="#38bdf8" strokeWidth="2" />
      <path d="M240.5 205.5 L245 210 L252 200.5" stroke="#7dd3fc" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="262" y="201.5" width="44" height="7" rx="3.5" fill="#38bdf8" fillOpacity="0.38" />

      {/* Row 3 — pending */}
      <rect x="236" y="234" width="17" height="17" rx="4.5" stroke="#2f4f7c" strokeWidth="2" />
      <rect x="262" y="238.5" width="50" height="7" rx="3.5" fill="#1f3a5f" />

      {/* Divider + signature line */}
      <path d="M232 274 H328" stroke="#1f3a5f" strokeWidth="1.5" />
      <path d="M232 296 l14 -9 9 6 16 -13 10 7 22 -12" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9" />

      {/* New-account key badge */}
      <g transform="translate(358 298)" filter="url(#su-softGlow)">
        <circle r="17" fill="#0ea5e9" stroke="#04121f" strokeWidth="3" />
        <circle cx="-5" cy="0" r="3.4" stroke="#04121f" strokeWidth="2" />
        <path d="M-1.6 0 H6.6 M4.6 0 V3.6 M6.6 0 V2.7" stroke="#04121f" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Spark accents */}
      <g fill="#7dd3fc">
        <path d="M168 110 L171.1 118.9 L180 122 L171.1 125.1 L168 134 L164.9 125.1 L156 122 L164.9 118.9 Z" opacity="0.95" />
        <path d="M404 268 L406.2 273.8 L412 276 L406.2 278.2 L404 284 L401.8 278.2 L396 276 L401.8 273.8 Z" opacity="0.8" />
        <path d="M388 96 L389.6 100.4 L394 102 L389.6 103.6 L388 108 L386.4 103.6 L382 102 L386.4 100.4 Z" opacity="0.7" />
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
  { step: "01", title: "Create your account", detail: "Name, email and phone — about a minute." },
  { step: "02", title: "Tell us the issue", detail: "Describe the problem and pick a convenient time." },
  { step: "03", title: "Track to fixed", detail: "Follow the job from booking to signed off." },
] as const;


export default function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeAuthRedirect(searchParams.get("callbackURL"));

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const validators: Record<FieldName, (value: string) => string | undefined> = {
    name: validateName,
    email: validateEmail,
    phone: validatePhone,
    area: validateArea,
    password: validatePassword,
    confirmPassword: (value) => validateConfirmPassword(value, password),
  };

  const values: Record<FieldName, string> = {
    name,
    email,
    phone,
    area,
    password,
    confirmPassword,
  };

  const refs: Record<FieldName, React.RefObject<HTMLInputElement | null>> = {
    name: nameRef,
    email: emailRef,
    phone: phoneRef,
    area: areaRef,
    password: passwordRef,
    confirmPassword: confirmPasswordRef,
  };

  const FIELD_ORDER: FieldName[] = [
    "name",
    "email",
    "phone",
    "area",
    "password",
    "confirmPassword",
  ];

  function setFieldValue(field: FieldName, value: string) {
    const setters: Record<FieldName, (value: string) => void> = {
      name: setName,
      email: setEmail,
      phone: setPhone,
      area: setArea,
      password: setPassword,
      confirmPassword: setConfirmPassword,
    };
    setters[field](value);
    // Revalidate live once the field already shows an error (or a submit was attempted).
    setFieldErrors((prev) => {
      if (!submitAttempted && !prev[field]) return prev;
      const next = { ...prev };
      const error = validators[field](value);
      if (error) next[field] = error;
      else delete next[field];
      // Keep confirm-password error in sync when the password itself changes.
      if (field === "password" && (submitAttempted || prev.confirmPassword)) {
        const confirmError = validateConfirmPassword(confirmPassword, value);
        if (confirmError) next.confirmPassword = confirmError;
        else delete next.confirmPassword;
      }
      return next;
    });
    setFormError(null);
  }

  function handleBlur(field: FieldName) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      const error = validators[field](values[field]);
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return; // Prevent duplicate submissions.

    const errors: FieldErrors = {};
    for (const field of FIELD_ORDER) {
      const error = validators[field](values[field]);
      if (error) errors[field] = error;
    }
    setFieldErrors(errors);
    setFormError(null);
    setSubmitAttempted(true);

    const firstInvalid = FIELD_ORDER.find((field) => errors[field]);
    if (firstInvalid) {
      refs[firstInvalid].current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        area: area.trim(),
        // NOTE: no `role` is sent — the backend defaults new users to
        // "customer" and ignores role input from public signup.
      });

      if (error) {
        setFormError(mapSignUpError(error));
        setIsSubmitting(false);
        return;
      }

      // Success — Better Auth has set the session cookie. Honour a validated
      // local destination, otherwise use the existing homepage default.
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setFormError(
        "Unable to reach the FixMate server. Check your connection — and that the backend is running — then try again."
      );
      setIsSubmitting(false);
    }
  }

  const hasFieldErrors = FIELD_ORDER.some((field) => fieldErrors[field]);
  const showErrorSummary = submitAttempted && hasFieldErrors;

  const inputBase =
    "w-full rounded-lg border bg-surface py-2.5 pl-11 pr-12 text-sm text-foreground shadow-xs outline-none transition-colors duration-200 placeholder:text-muted/80 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25";
  const inputValid = "border-border-strong hover:border-accent-500";
  const inputInvalid = "border-error bg-error-soft/40";

  const passwordInputBase =
    "w-full rounded-lg border bg-surface py-2.5 pl-11 pr-12 text-sm text-foreground shadow-xs outline-none transition-colors duration-200 placeholder:text-muted/80 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25";

  return (
    <main className="relative flex-1 overflow-x-clip bg-background">
      {/* Faint ambient glow behind the form column */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-[-15%] h-96 w-96 rounded-full bg-accent-400/10 blur-3xl"
      />

      <div className="grid min-h-[calc(100svh-4rem)] lg:grid-cols-[1.05fr_1fr]">
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

          <div className="relative">
            <BrandMark />
          </div>

          {/* Illustration + narrative */}
          <div className="relative flex flex-col items-center gap-8 py-8">
            <RegistrationIllustration />
            <div className="max-w-md text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-400">
                Join FixMate
              </p>
              <h2 className="mt-3 text-3xl font-extrabold leading-[1.15] tracking-tight text-[#f2f7fd] xl:text-4xl">
                Your repairs,{" "}
                <span className="bg-gradient-to-r from-accent-400 via-accent-500 to-accent-600 bg-clip-text text-transparent">
                  one account
                </span>{" "}
                away.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#a8bdd4]">
                Create an account to book verified technicians, track job
                progress and keep every device and appliance in working order.
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

        <div className="relative overflow-hidden bg-navy-950 px-6 py-6 sm:px-10 lg:hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent-600/25 blur-3xl"
          />
          <div className="relative flex items-center justify-between gap-6">
            <div className="min-w-0">
              <BrandMark compact />
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-400">
                Join FixMate
              </p>
              <p className="mt-1 text-lg font-bold leading-snug text-[#f2f7fd]">
                Your repairs, one account away.
              </p>
              <p className="mt-1 text-xs leading-snug text-[#a8bdd4]">
                Create your account to book and track repairs.
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

        <div className="relative flex items-center justify-center px-4 py-10 sm:px-8 sm:py-14 lg:px-10">
          <div className="w-full max-w-md">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full text-xs font-medium text-muted transition-colors duration-200 hover:text-heading cursor-pointer"
            >
              <Icon className="h-4 w-4">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </Icon>
              Back to homepage
            </Link>

            <div className="mt-4 rounded-2xl border border-border bg-surface p-6 shadow-lg sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-strong dark:text-accent">
                Join FixMate
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">
                Create your account
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                One account for every booking, technician visit and repair
                update.
              </p>

              {/* Error banners */}
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
              {showErrorSummary && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning"
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0">
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                    <path d="M12 9v4M12 17h.01" />
                  </Icon>
                  <span className="leading-snug">
                    Please fix the highlighted fields below and try again.
                  </span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="name" className="text-sm font-semibold text-heading">
                    Full name
                  </label>
                  <div className="relative mt-1.5">
                    <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
                    </Icon>
                    <input
                      ref={nameRef}
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      placeholder="Your full name"
                      value={name}
                      onChange={(event) => setFieldValue("name", event.target.value)}
                      onBlur={() => handleBlur("name")}
                      aria-invalid={fieldErrors.name ? true : undefined}
                      aria-describedby={fieldErrors.name ? "name-error" : undefined}
                      className={`${inputBase} pr-4 ${fieldErrors.name ? inputInvalid : inputValid}`}
                    />
                  </div>
                  {fieldErrors.name && (
                    <p id="name-error" role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs leading-snug text-error">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 8v4M12 16h.01" />
                      </Icon>
                      {fieldErrors.name}
                    </p>
                  )}
                </div>

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
                      onChange={(event) => setFieldValue("email", event.target.value)}
                      onBlur={() => handleBlur("email")}
                      aria-invalid={fieldErrors.email ? true : undefined}
                      aria-describedby={fieldErrors.email ? "email-error" : undefined}
                      className={`${inputBase} pr-4 ${fieldErrors.email ? inputInvalid : inputValid}`}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p id="email-error" role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs leading-snug text-error">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 8v4M12 16h.01" />
                      </Icon>
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="phone" className="text-sm font-semibold text-heading">
                      Phone number
                    </label>
                    <div className="relative mt-1.5">
                      <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 11.9a16 16 0 0 0 6 6l3.27-1.22a2 2 0 0 1 2.11.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                      </Icon>
                      <input
                        ref={phoneRef}
                        id="phone"
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        required
                        placeholder="+880 1XXX-XXXXXX"
                        value={phone}
                        onChange={(event) => setFieldValue("phone", event.target.value)}
                        onBlur={() => handleBlur("phone")}
                        aria-invalid={fieldErrors.phone ? true : undefined}
                        aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
                        className={`${inputBase} pr-4 ${fieldErrors.phone ? inputInvalid : inputValid}`}
                      />
                    </div>
                    {fieldErrors.phone && (
                      <p id="phone-error" role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs leading-snug text-error">
                        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 8v4M12 16h.01" />
                        </Icon>
                        {fieldErrors.phone}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="area" className="text-sm font-semibold text-heading">
                      Area / location
                    </label>
                    <div className="relative mt-1.5">
                      <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted">
                        <path d="M12 21s-7-5.1-7-11a7 7 0 0 1 14 0c0 5.9-7 11-7 11z" />
                        <circle cx="12" cy="10" r="2.5" />
                      </Icon>
                      <input
                        ref={areaRef}
                        id="area"
                        name="area"
                        type="text"
                        autoComplete="address-level2"
                        required
                        placeholder="Dhanmondi, Dhaka"
                        value={area}
                        onChange={(event) => setFieldValue("area", event.target.value)}
                        onBlur={() => handleBlur("area")}
                        aria-invalid={fieldErrors.area ? true : undefined}
                        aria-describedby={fieldErrors.area ? "area-error" : undefined}
                        className={`${inputBase} pr-4 ${fieldErrors.area ? inputInvalid : inputValid}`}
                      />
                    </div>
                    {fieldErrors.area && (
                      <p id="area-error" role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs leading-snug text-error">
                        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 8v4M12 16h.01" />
                        </Icon>
                        {fieldErrors.area}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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
                        autoComplete="new-password"
                        required
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={(event) => setFieldValue("password", event.target.value)}
                        onBlur={() => handleBlur("password")}
                        aria-invalid={fieldErrors.password ? true : undefined}
                        aria-describedby={fieldErrors.password ? "password-error" : "password-hint"}
                        className={`${passwordInputBase} ${fieldErrors.password ? inputInvalid : inputValid}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-pressed={showPassword}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-heading cursor-pointer active:scale-95"
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
                    {fieldErrors.password ? (
                      <p id="password-error" role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs leading-snug text-error">
                        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 8v4M12 16h.01" />
                        </Icon>
                        {fieldErrors.password}
                      </p>
                    ) : (
                      <p id="password-hint" className="mt-1.5 text-xs text-muted">
                        At least 8 characters.
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className="text-sm font-semibold text-heading">
                      Confirm password
                    </label>
                    <div className="relative mt-1.5">
                      <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </Icon>
                      <input
                        ref={confirmPasswordRef}
                        id="confirm-password"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        placeholder="Repeat password"
                        value={confirmPassword}
                        onChange={(event) => setFieldValue("confirmPassword", event.target.value)}
                        onBlur={() => handleBlur("confirmPassword")}
                        aria-invalid={fieldErrors.confirmPassword ? true : undefined}
                        aria-describedby={fieldErrors.confirmPassword ? "confirm-password-error" : undefined}
                        className={`${passwordInputBase} ${fieldErrors.confirmPassword ? inputInvalid : inputValid}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((visible) => !visible)}
                        aria-pressed={showConfirmPassword}
                        aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
                        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-heading cursor-pointer active:scale-95"
                      >
                        {showConfirmPassword ? (
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
                    {fieldErrors.confirmPassword && (
                      <p id="confirm-password-error" role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs leading-snug text-error">
                        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 8v4M12 16h.01" />
                        </Icon>
                        {fieldErrors.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="relative inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 enabled:hover:bg-primary-hover enabled:hover:shadow-md enabled:active:bg-primary-hover enabled:active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Creating your account…
                    </>
                  ) : (
                    <>
                      Create account
                      <Icon className="h-4 w-4">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </Icon>
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] leading-snug text-muted">
                  New accounts are created as customer accounts. Technician
                  onboarding is arranged separately through FixMate.
                </p>
              </form>

              <div className="mt-5 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted">Have an account?</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <p className="mt-4 text-center text-sm text-muted">
                Already have a FixMate account?{" "}
                <Link
                  href={withAuthCallback("/sign-in", callbackUrl)}
                  className="font-semibold text-accent-strong underline underline-offset-4 transition-colors duration-200 hover:text-accent dark:text-accent dark:hover:text-accent-strong cursor-pointer"
                >
                  Sign in instead
                </Link>
              </p>
            </div>

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
