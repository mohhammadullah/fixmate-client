import Link from "next/link";

const SERVICES = [
  {
    title: "Smartphone Screen Repair",
    description:
      "Cracked glass, flickering or unresponsive displays — replaced with quality components.",
    category: "Mobile Repair",
    icon: (
      // Smartphone with crack
      <>
        <rect x="7" y="2" width="10" height="20" rx="2.5" />
        <path d="M13.5 7 11 11h3l-2.5 4" />
      </>
    ),
  },
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

export default function FeaturedServices() {
  return (
    <section
      aria-labelledby="featured-services-heading"
      className="relative border-t border-border bg-surface"
    >
      <div className="container-page py-14 lg:py-20">
        {/* Heading */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent">
            Featured
          </span>
          <h2
            id="featured-services-heading"
            className="mt-4 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl"
          >
            Popular Repair Services
          </h2>
          <p className="mt-3 text-base text-muted">
            Discover reliable repair solutions for the devices and appliances
            you depend on.
          </p>
        </div>

        {/* Service cards */}
        <ul className="mt-10 grid gap-6 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <li key={service.title} className="h-full">
              <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-lg">
                {/* Banner */}
                <div className="relative flex h-28 shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700">
                  {/* Decorative glow + dot texture */}
                  <div
                    aria-hidden="true"
                    className="absolute -left-6 -top-10 h-32 w-32 rounded-full bg-accent-500/20 blur-2xl"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute -bottom-10 right-10 h-28 w-28 rounded-full bg-accent-400/10 blur-2xl"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-1 top-2 h-24 w-24 opacity-20"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle, var(--color-accent-400) 1.3px, transparent 1.3px)",
                      backgroundSize: "14px 14px",
                    }}
                  />

                  {/* Category label */}
                  <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-100 backdrop-blur-sm">
                    {service.category}
                  </span>

                  {/* Icon */}
                  <svg
                    viewBox="0 0 24 24"
                    width="48"
                    height="48"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-12 w-12 text-accent-400 transition-transform duration-300 group-hover:scale-110"
                  >
                    {service.icon}
                  </svg>
                </div>

                {/* Body */}
                <div className="flex grow flex-col p-5">
                  <h3 className="text-lg font-bold tracking-tight text-heading">
                    {service.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {service.description}
                  </p>

                  <Link
                    href={`/services?category=${encodeURIComponent(service.category)}`}
                    aria-label={`View details for ${service.title}`}
                    className="mt-auto inline-flex w-fit items-center gap-2 pt-5 text-sm font-semibold text-accent-strong transition-colors duration-200 hover:text-accent-600 dark:text-accent dark:hover:text-accent-400"
                  >
                    View Details
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
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
