const STEPS = [
  {
    number: "01",
    title: "Choose a Service",
    description:
      "Browse repair categories and find the service that matches your needs.",
    icon: (
      // Layout grid — browse categories
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    number: "02",
    title: "Find a Technician",
    description:
      "Explore available services from trusted technicians.",
    icon: (
      // User with checkmark — trusted technician
      <>
        <path d="M16 21v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V21" />
        <circle cx="9.5" cy="8" r="4" />
        <path d="m16 11 2 2 3.5-4" />
      </>
    ),
  },
  {
    number: "03",
    title: "Book a Repair",
    description:
      "Submit your repair request with your device details and preferred information.",
    icon: (
      // Calendar with check — booking
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
        <path d="m10.5 15 1.5 1.5 2.5-3" />
      </>
    ),
  },
  {
    number: "04",
    title: "Get It Fixed",
    description:
      "Track your repair progress and pay securely after the work is completed.",
    icon: (
      // Shield with check — trust & completion
      <>
        <path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10z" />
        <path d="m9 12 2 2 4-4.5" />
      </>
    ),
  },
] as const;

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="relative scroll-mt-20 border-t border-border"
    >
      <div className="container-page py-14 lg:py-20">
        {/* Heading */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent">
            Simple Process
          </span>
          <h2
            id="how-it-works-heading"
            className="mt-4 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl"
          >
            How FixMate Works
          </h2>
          <p className="mt-3 text-base text-muted">
            Getting your device repaired is simple. Follow four easy steps.
          </p>
        </div>

        {/* Steps */}
        <div className="relative mt-10 sm:mt-12">
          {/* Dashed connector line — desktop only, behind the icon chips */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-14 hidden border-t-2 border-dashed border-border-strong lg:block"
          />

          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.number} className="h-full">
                <div className="group relative flex h-full gap-4 overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-md sm:gap-5 sm:p-6 lg:flex-col lg:items-center lg:gap-0 lg:p-6 lg:pt-6 lg:text-center">
                  {/* Ghost step numeral */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-4 top-3 select-none text-5xl font-extrabold leading-none tracking-tighter text-accent-500/20"
                  >
                    {step.number}
                  </span>

                  {/* Icon chip */}
                  <span
                    aria-hidden="true"
                    className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center self-start rounded-2xl bg-navy-900 text-accent-400 shadow-sm transition-transform duration-300 group-hover:scale-105 lg:self-auto"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="26"
                      height="26"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-[26px] w-[26px]"
                    >
                      {step.icon}
                    </svg>
                  </span>

                  {/* Copy */}
                  <span className="min-w-0 lg:mt-5 lg:block">
                    <span className="block text-[11px] font-semibold uppercase tracking-widest text-accent-strong dark:text-accent">
                      Step {index + 1}
                    </span>
                    <span className="mt-1 block text-lg font-bold tracking-tight text-heading">
                      {step.title}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-muted">
                      {step.description}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
