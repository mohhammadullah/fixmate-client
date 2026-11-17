import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us | FixMate",
  description:
    "FixMate connects customers with technicians for device and home appliance repairs — making repair services easier, more accessible and reliable.",
};

const IMPROVEMENTS = [
  {
    number: "01",
    title: "Easier Discovery",
    description:
      "Stop searching across scattered listings — find the repair service you need through one clean, searchable platform.",
    icon: (
      // Discovery — search with a category spark
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m20 20-4.8-4.8" />
        <path d="M8.5 10.5h.01M10.5 8.5h.01M12.5 10.5h.01" strokeWidth="2.4" />
      </>
    ),
  },
  {
    number: "02",
    title: "Better Connections",
    description:
      "Customers and repair professionals meet on one platform — so the right job finds the right technician.",
    icon: (
      // Connection — two nodes linked
      <>
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="18" cy="18" r="3" />
        <path d="M8.7 10.9l6.6-3.8M8.7 13.1l6.6 3.8" />
      </>
    ),
  },
  {
    number: "03",
    title: "Simpler Repair Experience",
    description:
      "Request a repair, follow its progress and pay when the work is done — with a clear journey at every step.",
    icon: (
      // Clarity — gauge progress
      <>
        <path d="M12 15l4-5" />
        <path d="M5 17a9 9 0 1 1 14 0" />
        <circle cx="12" cy="15" r="1.5" />
      </>
    ),
  },
] as const;

const JOURNEY = [
  {
    number: "01",
    title: "Explore Services",
    description: "Browse categories or search for the repair you need.",
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
  },
  {
    number: "02",
    title: "Choose a Technician",
    description: "Compare available technicians for your device or appliance.",
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" />
      </>
    ),
  },
  {
    number: "03",
    title: "Request a Repair",
    description: "Submit the details and pick a preferred time that suits you.",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
        <path d="M9.5 15h5" />
      </>
    ),
  },
  {
    number: "04",
    title: "Track the Repair",
    description: "Follow each stage of the repair until it is complete.",
    icon: (
      <>
        <circle cx="6" cy="19" r="3" />
        <circle cx="18" cy="5" r="3" />
        <path d="M9 16h6.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H15" />
      </>
    ),
  },
] as const;

export default function AboutPage() {
  return (
    <main>
      {/* ================= 1. ABOUT HERO ================= */}
      <section
        aria-labelledby="about-hero-heading"
        className="relative overflow-x-clip border-b border-border"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 right-[-10%] h-96 w-96 rounded-full bg-accent-400/10 blur-3xl"
        />
        <div className="container-page relative py-14 sm:py-18 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Copy */}
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent">
                About FixMate
              </span>
              <h1
                id="about-hero-heading"
                className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-heading sm:text-5xl"
              >
                Repair Services That Are{" "}
                <span className="bg-gradient-to-r from-accent-600 via-accent-500 to-accent-400 bg-clip-text text-transparent">
                  Easier, Accessible &amp; Reliable
                </span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-muted">
                FixMate connects customers with verified repair professionals
                for smart devices and home appliances — making it simple to
                discover services, request a repair and follow it through to
                completion.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md"
                >
                  Explore Services
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-4 w-4"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-6 py-3 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted"
                >
                  Get Started
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-4 w-4"
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Illustration — toolbox with repair glyph */}
            <div
              aria-hidden="true"
              className="relative mx-auto flex w-full max-w-md items-center justify-center overflow-hidden rounded-3xl border border-navy-700 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-10 shadow-lg lg:max-w-lg"
            >
              <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent-500/15 blur-3xl" />
              <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-accent-400/10 blur-3xl" />
              <div
                className="absolute bottom-6 left-6 h-24 w-24 opacity-25"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, #2fb8f5 1.3px, transparent 1.3px)",
                  backgroundSize: "14px 14px",
                }}
              />
              <svg
                viewBox="0 0 320 220"
                width="320"
                height="220"
                role="presentation"
                fill="none"
                className="relative h-56 w-full sm:h-64"
              >
                {/* Toolbox case */}
                <rect x="70" y="96" width="180" height="84" rx="14" fill="#0d1f36" stroke="#2fb8f5" strokeWidth="2.5" />
                <path d="M126 96V74a16 16 0 0 1 16-16h36a16 16 0 0 1 16 16v22" stroke="#2fb8f5" strokeWidth="2.5" strokeLinejoin="round" />
                <path d="M146 74v-6a8 8 0 0 1 8-8h12a8 8 0 0 1 8 8v6" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M70 138h180" stroke="#1b3454" strokeWidth="2" />
                <rect x="146" y="130" width="28" height="16" rx="3" fill="#081426" stroke="#38bdf8" strokeWidth="2" />
                {/* Wrench floating above */}
                <path
                  d="M162 30a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
                  stroke="#2fb8f5"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform="translate(96 -8)"
                />
                {/* Check chip */}
                <circle cx="240" cy="88" r="14" fill="#0f2c1e" stroke="#22c55e" strokeWidth="2" />
                <path d="m233.5 88 4.5 4.5 8-9" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                {/* Sparkles */}
                <path d="M60 40l2.2 5 5 2.2-5 2.2-2.2 5-2.2-5-5-2.2 5-2.2 2.2-5Z" fill="#38bdf8" fillOpacity="0.9" />
                <path d="M272 44l1.6 3.6 3.6 1.6-3.6 1.6-1.6 3.6-1.6-3.6-3.6-1.6 3.6-1.6 1.6-3.6Z" fill="#2fb8f5" fillOpacity="0.75" />
                <circle cx="46" cy="140" r="2.4" fill="#2fb8f5" />
                <circle cx="280" cy="150" r="2.4" fill="#38bdf8" fillOpacity="0.75" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 2. OUR MISSION ================= */}
      <section aria-labelledby="mission-heading" className="border-b border-border">
        <div className="container-page py-14 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-strong dark:text-accent">
                Our Mission
              </span>
              <div
                aria-hidden="true"
                className="mt-4 hidden h-px w-16 bg-accent-500/60 lg:block"
              />
            </div>
            <div className="lg:col-span-9">
              <h2
                id="mission-heading"
                className="text-2xl font-extrabold leading-snug tracking-tight text-heading sm:text-3xl lg:text-4xl"
              >
                Making it simple to find repair services, connecting customers
                with technicians, and making repair requests easier to{" "}
                <span className="text-accent-strong dark:text-accent">
                  manage
                </span>
                .
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-7 text-muted">
                Whether it is a cracked phone screen or a refrigerator that has
                stopped cooling, nobody should have to struggle just to get a
                trustworthy repair. FixMate exists to remove that friction —
                one platform where customers can discover services, request a
                repair, and follow their service journey from start to finish.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 3. WHAT WE AIM TO IMPROVE ================= */}
      <section
        aria-labelledby="improve-heading"
        className="border-b border-border bg-surface"
      >
        <div className="container-page py-14 lg:py-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-strong dark:text-accent">
                What We Aim to Improve
              </span>
              <h2
                id="improve-heading"
                className="mt-3 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl"
              >
                Built around the moments that matter
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted sm:text-right">
              Three frustrations we set out to fix — one platform at a time.
            </p>
          </div>

          <ol className="mt-10 grid gap-10 sm:mt-12 sm:grid-cols-3 sm:gap-8 lg:gap-0">
            {IMPROVEMENTS.map((item, index) => (
              <li
                key={item.number}
                className={`group relative flex flex-col sm:px-6 ${
                  index > 0 ? "sm:border-l sm:border-border" : ""
                } ${index === 0 ? "sm:pl-0" : ""} ${
                  index === IMPROVEMENTS.length - 1 ? "sm:pr-0" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="select-none text-5xl font-extrabold leading-none tracking-tighter text-accent-500/20"
                >
                  {item.number}
                </span>
                <span
                  aria-hidden="true"
                  className="mt-4 flex h-12 w-12 items-center justify-center rounded-xl bg-navy-900 text-accent-400 shadow-sm transition-transform duration-300 group-hover:scale-105"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-[22px] w-[22px]"
                  >
                    {item.icon}
                  </svg>
                </span>
                <h3 className="mt-4 text-lg font-bold tracking-tight text-heading">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {item.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= 4. HOW FIXMATE WORKS ================= */}
      <section aria-labelledby="how-heading" className="border-b border-border">
        <div className="container-page py-14 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-strong dark:text-accent">
              The Journey
            </span>
            <h2
              id="how-heading"
              className="mt-3 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl"
            >
              How FixMate Works
            </h2>
          </div>

          {/* Minimal stepper — circles on a line */}
          <ol className="relative mt-12 grid gap-10 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-7 hidden border-t-2 border-dashed border-border-strong lg:block"
            />
            {JOURNEY.map((step) => (
              <li
                key={step.number}
                className="group relative flex items-start gap-4 sm:flex-col sm:items-center sm:text-center lg:flex-col"
              >
                <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-accent-500/60 bg-background font-mono text-sm font-bold text-accent-strong shadow-sm transition-colors duration-300 group-hover:border-accent-500 dark:text-accent">
                  {step.number}
                </span>
                <span className="sm:mt-4">
                  <span className="flex items-center gap-2 sm:justify-center">
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="h-4 w-4 text-accent-strong dark:text-accent"
                    >
                      {step.icon}
                    </svg>
                    <span className="text-base font-bold text-heading">
                      {step.title}
                    </span>
                  </span>
                  <span className="mt-2 block max-w-xs text-sm leading-6 text-muted">
                    {step.description}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= 5. FINAL CTA ================= */}
      <section aria-labelledby="about-cta-heading">
        <div className="container-page py-14 sm:py-18 lg:py-20">
          <div className="relative overflow-hidden rounded-3xl border border-navy-700 bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 px-6 py-12 sm:px-10 sm:py-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-accent-500/15 blur-3xl"
            />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-400">
                  Get Started
                </span>
                <h2
                  id="about-cta-heading"
                  className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-[#f2f7fd] sm:text-3xl"
                >
                  Your repair journey starts with one search
                </h2>
                <p className="mt-3 text-base leading-7 text-[#b7c6da]">
                  Explore the repair services available on FixMate or create an
                  account and submit your first request today.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-semibold text-[#04121f] shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-400"
                >
                  Explore Services
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-4 w-4"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-[#e6eef8] backdrop-blur-sm transition-colors duration-200 hover:border-accent-400/40 hover:bg-white/10 hover:text-white"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
