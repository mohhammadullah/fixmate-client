const BENEFITS = [
  {
    title: "Verified Technicians",
    description:
      "Find repair professionals whose profiles and services are reviewed through our platform.",
    icon: (
      // Badge check — verification
      <>
        <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  {
    title: "Transparent Pricing",
    description:
      "See service pricing information before submitting a repair request.",
    icon: (
      // Receipt — clear line-item pricing
      <>
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
        <path d="M8 7.5h8M8 11.5h8M8 15.5h5" />
      </>
    ),
  },
  {
    title: "Easy Booking",
    description:
      "Request a repair through a simple and convenient booking process.",
    icon: (
      // Calendar with plus — effortless booking
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
        <path d="M12 14v4M10 16h4" />
      </>
    ),
  },
  {
    title: "Repair Tracking",
    description:
      "Follow your repair request as it moves through each service stage.",
    icon: (
      // Route — track progress from pickup to delivery
      <>
        <circle cx="6" cy="19" r="3" />
        <circle cx="18" cy="5" r="3" />
        <path d="M9 16h6.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H15" />
      </>
    ),
  },
  {
    title: "Secure Payments",
    description:
      "Complete payments securely after your repair service is finished.",
    icon: (
      // Lock — secure payment
      <>
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        <path d="M12 15v2" />
      </>
    ),
  },
  {
    title: "Customer Support",
    description:
      "Get help when you need assistance with your repair experience.",
    icon: (
      // Life buoy — always-there support
      <>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="4" />
        <path d="m4.93 4.93 4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M9.17 14.83l-4.24 4.24" />
      </>
    ),
  },
] as const;

export default function WhyChooseFixMate() {
  return (
    <section
      aria-labelledby="why-fixmate-heading"
      className="relative border-t border-border bg-surface"
    >
      <div className="container-page py-14 lg:py-20">
        {/* Header — split layout, distinct from centered sections */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent">
              The FixMate Advantage
            </span>
            <h2
              id="why-fixmate-heading"
              className="mt-4 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl"
            >
              Why Choose FixMate?
            </h2>
          </div>
          <p className="max-w-md text-base leading-7 text-muted lg:pb-1 lg:text-right">
            We make finding reliable repair services easier, safer, and more
            convenient.
          </p>
        </div>

        {/* Benefits — hairline-divided grid (spec-sheet style) */}
        <ul className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-sm sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="h-full">
              <div className="group flex h-full flex-col p-6 transition-colors duration-300 hover:bg-surface-muted/50">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent-100 bg-accent-50 text-accent-strong transition-transform duration-300 group-hover:-translate-y-0.5 dark:border-border dark:bg-surface-muted dark:text-accent"
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
                    {benefit.icon}
                  </svg>
                </span>
                <h3 className="mt-4 text-base font-bold tracking-tight text-heading">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {benefit.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
