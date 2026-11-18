import Link from "next/link";

const KEY_POINTS = [
  {
    title: "One Convenient Platform",
    description:
      "Explore different repair services and find solutions for your everyday needs.",
    icon: (
      // Layout grid — everything in one place
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    title: "Connecting Customers & Technicians",
    description:
      "Bring customers and repair professionals together through a single platform.",
    icon: (
      // Users with swap arrows — two-sided connection
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M3.5 20v-1a4.5 4.5 0 0 1 4.5-4.5h2" />
        <path d="M14 16l3 3 3-3" />
        <path d="M17 13v6" />
      </>
    ),
  },
  {
    title: "A Simpler Repair Experience",
    description:
      "Make repair requests and follow their progress through a clear service journey.",
    icon: (
      // Gauge — clear progress at a glance
      <>
        <path d="M12 15l4-5" />
        <path d="M5 17a9 9 0 1 1 14 0" />
        <circle cx="12" cy="15" r="1.5" />
      </>
    ),
  },
] as const;

export default function AboutSection() {
  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="relative scroll-mt-20 border-t border-border"
    >
      <div className="container-page py-14 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent">
              About FixMate
            </span>
            <h2
              id="about-heading"
              className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-tight text-heading sm:text-4xl"
            >
              Making Repair Services{" "}
              <span className="bg-gradient-to-r from-accent-600 via-accent-500 to-accent-400 bg-clip-text text-transparent">
                Simple, Reliable and Accessible
              </span>
            </h2>
            <p className="mt-5 text-base leading-7 text-muted sm:text-lg">
              FixMate is a repair service platform designed to connect
              customers with technicians who can help repair their devices and
              home appliances. We aim to make discovering services, requesting
              repairs and following service progress easier through one
              convenient platform.
            </p>

            {/* Key points */}
            <ul className="mt-8 flex flex-col gap-5">
              {KEY_POINTS.map((point) => (
                <li key={point.title} className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent-100 bg-accent-50 text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {point.icon}
                    </svg>
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-heading sm:text-base">
                      {point.title}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-muted">
                      {point.description}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Link
              href="/services"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md"
            >
              Explore Our Services
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
          </div>

          <div
            aria-hidden="true"
            className="relative mx-auto flex w-full max-w-md items-center justify-center overflow-hidden rounded-3xl border border-navy-700 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-8 shadow-lg lg:max-w-lg"
          >
            {/* Ambient glows */}
            <div className="absolute -left-16 top-8 h-56 w-56 rounded-full bg-accent-500/15 blur-3xl" />
            <div className="absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-accent-400/10 blur-3xl" />
            {/* Dot texture */}
            <div
              className="absolute bottom-5 right-6 h-24 w-24 opacity-25"
              style={{
                backgroundImage:
                  "radial-gradient(circle, #2fb8f5 1.3px, transparent 1.3px)",
                backgroundSize: "14px 14px",
              }}
            />

            <svg
              viewBox="0 0 320 240"
              width="320"
              height="240"
              role="presentation"
              fill="none"
              className="relative h-56 w-full sm:h-64"
            >
              {/* Laptop — back right */}
              <rect x="150" y="52" width="132" height="86" rx="10" fill="#0d1f36" stroke="#2fb8f5" strokeWidth="2.5" />
              <path d="M132 162h168" stroke="#274565" strokeWidth="10" strokeLinecap="round" />
              <path d="M132 162h168" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 10" />
              {/* Laptop screen content lines */}
              <path d="M168 78h96M168 96h72M168 114h48" stroke="#1b3454" strokeWidth="6" strokeLinecap="round" />

              {/* Smartphone — front left */}
              <rect x="44" y="86" width="86" height="136" rx="16" fill="#081426" stroke="#38bdf8" strokeWidth="2.5" />
              <rect x="60" y="104" width="54" height="8" rx="4" fill="#1b3454" />
              <rect x="60" y="122" width="40" height="8" rx="4" fill="#1b3454" />
              <rect x="60" y="140" width="47" height="8" rx="4" fill="#1b3454" />
              <circle cx="87" cy="190" r="10" stroke="#274565" strokeWidth="2.5" />
              <circle cx="87" cy="190" r="3.5" fill="#2fb8f5" />

              {/* Wrench badge — where repair happens */}
              <circle cx="146" cy="128" r="26" fill="#0b1b30" stroke="#2fb8f5" strokeWidth="2.5" />
              <path
                d="M150.7 119.3a1.2 1.2 0 0 0 0 1.7l1.9 1.9a1.2 1.2 0 0 0 1.7 0l4.5-4.5a7.2 7.2 0 0 1-9.5 9.5l-8.3 8.3a2.55 2.55 0 0 1-3.6-3.6l8.3-8.3a7.2 7.2 0 0 1 9.5-9.5l-4.5 4.6z"
                stroke="#2fb8f5"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Check chip — job done */}
              <circle cx="248" cy="168" r="15" fill="#0f2c1e" stroke="#22c55e" strokeWidth="2" />
              <path d="m241.5 168 4.5 4.5 8-9" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

              {/* Sparkles */}
              <path d="M96 34l2.4 5.4L104 42l-5.6 2.6L96 50l-2.4-5.4L88 42l5.6-2.6L96 34Z" fill="#38bdf8" fillOpacity="0.9" />
              <path d="M262 24l1.8 4 4 1.8-4 1.8-1.8 4-1.8-4-4-1.8 4-1.8 1.8-4Z" fill="#2fb8f5" fillOpacity="0.8" />

              {/* Orbit dots */}
              <circle cx="146" cy="98" r="2" fill="#2fb8f5" fillOpacity="0.9" />
              <circle cx="118" cy="146" r="2" fill="#38bdf8" fillOpacity="0.7" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
