import Link from "next/link";

const SPOTLIGHT = {
  title: "Smartphone Screen Repair",
  description:
    "Cracked glass, flickering or unresponsive displays — replaced with quality components.",
  category: "Mobile Repair",
} as const;

const SERVICES = [
  {
    title: "Laptop Repair & Troubleshooting",
    description:
      "Hardware faults, boot issues, slow performance and software diagnostics, fixed right.",
    category: "Laptop Repair",
    icon: (
      // Laptop with tools
      <>
        <rect x="4" y="5" width="16" height="11" rx="2" />
        <path d="M2 19h20" />
        <path d="M10 10.5 12 12.5l2.5-3.5" />
      </>
    ),
  },
  {
    title: "Refrigerator Repair",
    description:
      "Cooling failures, strange noises, leaks and temperature problems resolved at home.",
    category: "Refrigerator Repair",
    icon: (
      // Refrigerator
      <>
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M6 9.5h12" />
        <path d="M9.5 5.5v2M9.5 12.5v2" />
      </>
    ),
  },
  {
    title: "Air Conditioner Servicing",
    description:
      "Deep cleaning, gas refill, filter and coil care to restore powerful, even cooling.",
    category: "AC Repair",
    icon: (
      // Wind — airflow
      <>
        <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
        <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
        <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
      </>
    ),
  },
  {
    title: "Television Repair",
    description:
      "No picture, no sound, dead pixels and smart-TV glitches — diagnosed and repaired.",
    category: "TV Repair",
    icon: (
      // TV
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="m17 2-5 5-5-5" />
      </>
    ),
  },
  {
    title: "Home Appliance Repair",
    description:
      "Washing machines, microwaves and kitchen appliances — fixed at your doorstep.",
    category: "Home Appliance Repair",
    icon: (
      // Washing machine
      <>
        <rect x="3" y="2" width="18" height="20" rx="2" />
        <circle cx="12" cy="13" r="4.5" />
        <path d="M7 6h.01M10.5 6h.01" />
      </>
    ),
  },
] as const;

function serviceHref(category: string) {
  return `/services?category=${encodeURIComponent(category)}`;
}

export default function FeaturedServices() {
  return (
    <section
      aria-labelledby="featured-services-heading"
      className="relative border-t border-border bg-surface"
    >
      <div className="container-page py-14 lg:py-20">
        {/* Header — editorial split */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent">
              Featured
            </span>
            <h2
              id="featured-services-heading"
              className="mt-4 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl"
            >
              Popular Repair Services
            </h2>
          </div>
          <p className="max-w-md text-base leading-7 text-muted lg:pb-1 lg:text-right">
            Discover reliable repair solutions for the devices and appliances
            you depend on.
          </p>
        </div>

        {/* Editorial grid — spotlight + list */}
        <div className="mt-10 grid gap-6 sm:mt-12 lg:grid-cols-5">
          <article className="relative flex flex-col overflow-hidden rounded-3xl border border-navy-700 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 shadow-lg lg:col-span-3">
            {/* Ambient glows */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-accent-500/20 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 right-10 h-56 w-56 rounded-full bg-accent-400/10 blur-3xl"
            />
            {/* Dot texture */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-5 top-5 h-24 w-24 opacity-25"
              style={{
                backgroundImage:
                  "radial-gradient(circle, var(--color-accent-400) 1.3px, transparent 1.3px)",
                backgroundSize: "15px 15px",
              }}
            />

            <div className="relative flex grow flex-col gap-6 p-7 sm:flex-row sm:items-center sm:p-9 lg:gap-8">
              <div className="flex max-w-xs flex-col">
                <span className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-100 backdrop-blur-sm">
                  {SPOTLIGHT.category}
                </span>
                <h3 className="mt-4 text-2xl font-extrabold leading-[1.15] tracking-tight text-[#f2f7fd] sm:text-3xl">
                  {SPOTLIGHT.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#b7c6da] sm:text-base">
                  {SPOTLIGHT.description}
                </p>
                <Link
                  href={serviceHref(SPOTLIGHT.category)}
                  aria-label="View details for Smartphone Screen Repair"
                  className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-semibold text-[#04121f] shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-400 active:scale-[0.98] cursor-pointer"
                >
                  View Details
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

              {/* Illustration — smartphone with cracked screen */}
              <svg
                viewBox="0 0 200 220"
                width="200"
                height="220"
                role="presentation"
                fill="none"
                className="mx-auto h-48 w-auto shrink-0 sm:h-56 lg:h-64"
              >
                {/* Glow ring behind phone */}
                <circle cx="100" cy="112" r="86" stroke="#1b3454" strokeWidth="1.5" strokeDasharray="4 7" />

                {/* Phone body */}
                <rect x="52" y="16" width="96" height="190" rx="18" fill="#081426" stroke="#2fb8f5" strokeWidth="2.5" />
                <path d="M88 32h24" stroke="#274565" strokeWidth="4" strokeLinecap="round" />
                <circle cx="100" cy="188" r="6" stroke="#274565" strokeWidth="2" />

                {/* Screen */}
                <rect x="64" y="46" width="72" height="124" rx="6" fill="#0d1f36" stroke="#1b3454" strokeWidth="1.5" />

                {/* Crack — lightning path across the screen */}
                <path
                  d="M96 52 84 92h14L82 128l30-34h-13l14-42z"
                  fill="#2fb8f5"
                  fillOpacity="0.18"
                  stroke="#38bdf8"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Screen UI ghost lines */}
                <path d="M74 148h18M74 158h28" stroke="#1b3454" strokeWidth="4" strokeLinecap="round" />

                {/* Orbiting wrench */}
                <circle cx="156" cy="66" r="19" fill="#0b1b30" stroke="#2fb8f5" strokeWidth="2.2" />
                <path
                  d="M160.6 61.2a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.1-3.1a5.2 5.2 0 0 1-6.4 6.4l-5.6 5.6a1.7 1.7 0 0 1-2.4-2.4l5.6-5.6a5.2 5.2 0 0 1 6.4-6.4l-3.2 2.5z"
                  stroke="#2fb8f5"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Sparkles */}
                <path d="M38 74l2 4.4 4.4 2-4.4 2-2 4.4-2-4.4-4.4-2 4.4-2 2-4.4Z" fill="#38bdf8" fillOpacity="0.85" />
                <circle cx="168" cy="130" r="2.2" fill="#2fb8f5" />
                <circle cx="30" cy="130" r="2.2" fill="#38bdf8" fillOpacity="0.75" />
              </svg>
            </div>
          </article>

          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-3xl border border-border bg-background shadow-xs lg:col-span-2">
            {SERVICES.map((service) => (
              <li key={service.title} className="group flex flex-1">
                <div className="relative flex flex-1 items-center gap-4 p-4 transition-colors duration-200 hover:bg-surface-muted/50 active:bg-surface-muted sm:gap-5 sm:p-5">
                  {/* Icon */}
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-accent-100 bg-accent-50 text-accent-strong transition-transform duration-200 group-hover:scale-105 dark:border-border dark:bg-surface-muted dark:text-accent"
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
                      {service.icon}
                    </svg>
                  </span>

                  {/* Copy + link */}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">
                      {service.category}
                    </span>
                    <span className="mt-0.5 block text-sm font-bold leading-snug text-heading sm:text-[15px]">
                      {service.title}
                    </span>
                    <span className="mt-1 hidden text-xs leading-5 text-muted xl:block">
                      {service.description}
                    </span>
                    <Link
                      href={serviceHref(service.category)}
                      aria-label={`View details for ${service.title}`}
                      className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-strong transition-colors duration-200 hover:text-accent-600 after:absolute after:inset-0 after:content-[''] dark:text-accent dark:hover:text-accent-400 cursor-pointer"
                    >
                      View Details
                      <svg
                        viewBox="0 0 24 24"
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="h-3 w-3"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </span>

                  {/* Arrow affordance */}
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
                    className="hidden h-[18px] w-[18px] shrink-0 text-muted transition-all duration-200 group-hover:translate-x-1 group-hover:text-accent-strong sm:block dark:group-hover:text-accent"
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
