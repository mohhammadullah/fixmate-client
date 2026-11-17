import Link from "next/link";

const TRUST_ITEMS = [
  "Verified Technicians",
  "Transparent Pricing",
  "Reliable Service",
] as const;

const DEVICE_ROWS = [
  {
    name: "Smartphone",
    detail: "Screen replacement",
    price: "$49",
    icon: (
      // Smartphone
      <>
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" />
      </>
    ),
  },
  {
    name: "Laptop",
    detail: "Battery & keyboard service",
    price: "$89",
    icon: (
      // Laptop
      <>
        <rect x="3" y="5" width="18" height="12" rx="2" />
        <path d="M2 19h20" />
      </>
    ),
  },
  {
    name: "Home Appliance",
    detail: "Fridge & AC diagnostics",
    price: "$39",
    icon: (
      // Refrigerator-style appliance / diagnostics
      <>
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M7 9h10" />
        <path d="M10 5.5v1.5M10 12.5v1.5" />
      </>
    ),
  },
] as const;

export default function HeroSection() {
  return (
    <section className="relative overflow-x-clip">
      {/* Ambient section glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-[-10%] h-96 w-96 rounded-full bg-accent-400/15 blur-3xl"
      />

      <div className="container-page py-14 sm:py-18 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* -------------------------------------------------- Left: copy */}
          <div className="max-w-xl">
            {/* Badge */}
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50 py-1.5 pl-2 pr-4 text-xs font-semibold uppercase tracking-wider text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent">
              <span
                aria-hidden="true"
                className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-500"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="10"
                  height="10"
                  fill="none"
                  stroke="var(--color-accent-foreground)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              Your Trusted Repair Partner
            </span>

            {/* Heading */}
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-heading sm:text-5xl xl:text-6xl">
              Expert Repairs.{" "}
              <span className="bg-gradient-to-r from-accent-600 via-accent-500 to-accent-400 bg-clip-text text-transparent">
                Reliable Solutions.
              </span>{" "}
              Every Time.
            </h1>

            {/* Description */}
            <p className="mt-6 text-lg leading-relaxed text-muted">
              From smartphones and laptops to home appliances, find trusted
              technicians and get your devices back to their best.
            </p>

            {/* CTAs */}
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
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-4 w-4"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/#how-it-works"
                className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-6 py-3 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted"
              >
                How It Works
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

            {/* Trust indicators */}
            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-6">
              {TRUST_ITEMS.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-sm font-medium text-foreground"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-[18px] w-[18px] shrink-0 text-accent-strong dark:text-accent"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="m8.5 12.5 2.5 2.5 4.5-5" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* -------------------------------------- Right: visual card art */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-xl">
            {/* Decorative dot grid */}
            <div
              aria-hidden="true"
              className="absolute -right-6 -top-6 h-40 w-40 opacity-70"
              style={{
                backgroundImage:
                  "radial-gradient(circle, var(--border-strong) 1.4px, transparent 1.4px)",
                backgroundSize: "18px 18px",
              }}
            />
            {/* Soft accent glow behind card */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-400/20 blur-3xl"
            />

            {/* Main repair-request card */}
            <div className="relative mx-auto w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-lg">
              {/* Card header */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-accent-400"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted">
                      Repair Request
                    </p>
                    <p className="text-sm font-bold text-heading">#FM-2841</p>
                  </div>
                </div>
                <span className="rounded-full bg-warning-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-warning">
                  In Progress
                </span>
              </div>

              {/* Device rows */}
              <ul className="mt-5 flex flex-col gap-3">
                {DEVICE_ROWS.map((device) => (
                  <li
                    key={device.name}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-strong dark:bg-surface-muted dark:text-accent"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {device.icon}
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-heading">
                        {device.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {device.detail}
                      </span>
                    </span>
                    <span className="ml-auto text-sm font-bold text-heading">
                      {device.price}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Progress */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-muted">Repair progress</span>
                  <span className="text-heading">75%</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={75}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Repair progress"
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
                >
                  <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-accent-600 to-accent-400" />
                </div>
              </div>

              {/* Technicians online */}
              <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <div aria-hidden="true" className="flex -space-x-2">
                  {["AR", "MK", "JS"].map((initials, index) => (
                    <span
                      key={initials}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-surface ${
                        index === 0
                          ? "bg-navy-800"
                          : index === 1
                            ? "bg-accent-600"
                            : "bg-navy-700"
                      }`}
                    >
                      {initials}
                    </span>
                  ))}
                </div>
                <p className="text-xs leading-5 text-muted">
                  <span className="font-semibold text-heading">
                    12 verified technicians
                  </span>
                  <br />
                  online near you right now
                </p>
              </div>
            </div>

            {/* Floating stat cards (decorative) */}
            <div
              aria-hidden="true"
              className="absolute -left-8 top-24 z-10 hidden items-center gap-2.5 rounded-xl border border-border bg-surface/95 px-3.5 py-2.5 shadow-md backdrop-blur-sm xl:flex"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                className="h-[18px] w-[18px] text-warning"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-xs">
                <span className="block font-bold text-heading">4.9 / 5</span>
                <span className="text-muted">12k+ reviews</span>
              </span>
            </div>

            <div
              aria-hidden="true"
              className="absolute -right-8 top-1/2 z-10 hidden -translate-y-1/2 items-center gap-2.5 rounded-xl border border-border bg-surface/95 px-3.5 py-2.5 shadow-md backdrop-blur-sm xl:flex"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                className="h-[18px] w-[18px] text-accent-500"
              >
                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
              <span className="text-xs">
                <span className="block font-bold text-heading">
                  Same-day service
                </span>
                <span className="text-muted">in most areas</span>
              </span>
            </div>

            <div
              aria-hidden="true"
              className="absolute -left-8 bottom-14 z-10 hidden items-center gap-2.5 rounded-xl border border-border bg-surface/95 px-3.5 py-2.5 shadow-md backdrop-blur-sm xl:flex"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[18px] w-[18px] text-success"
              >
                <path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10z" />
                <path d="m9 12 2 2 4-4.5" />
              </svg>
              <span className="text-xs">
                <span className="block font-bold text-heading">
                  90-day warranty
                </span>
                <span className="text-muted">on every repair</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
