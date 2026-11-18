import Link from "next/link";

const CATEGORIES = [
  {
    name: "Mobile Repair",
    description:
      "Screen, battery, charging-port and water-damage fixes for all major smartphone brands.",
    icon: (
      // Smartphone
      <>
        <rect x="7" y="2" width="10" height="20" rx="2.5" />
        <path d="M11 18h2" />
      </>
    ),
  },
  {
    name: "Laptop Repair",
    description:
      "From battery swaps and keyboard issues to software and performance troubleshooting.",
    icon: (
      // Laptop
      <>
        <rect x="4" y="5" width="16" height="11" rx="2" />
        <path d="M2 19h20" />
      </>
    ),
  },
  {
    name: "Refrigerator Repair",
    description:
      "Cooling, compressor, thermostat and ice-maker repairs to keep food fresh.",
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
    name: "AC Repair",
    description:
      "Installation, gas refills, filter cleaning and cooling fixes for split and window units.",
    icon: (
      // Wind — airflow for air conditioning
      <>
        <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
        <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
        <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
      </>
    ),
  },
  {
    name: "TV Repair",
    description:
      "Picture, sound, backlight and board-level repairs for LED, LCD and smart TVs.",
    icon: (
      // TV
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="m17 2-5 5-5-5" />
      </>
    ),
  },
  {
    name: "Home Appliance Repair",
    description:
      "Washing machines, microwaves, blenders and more — fixed at your doorstep.",
    icon: (
      // Washing machine — home appliance
      <>
        <rect x="3" y="2" width="18" height="20" rx="2" />
        <circle cx="12" cy="13" r="4.5" />
        <path d="M7 6h.01M10.5 6h.01" />
      </>
    ),
  },
] as const;

export default function ServiceCategories() {
  return (
    <section aria-labelledby="categories-heading" className="relative">
      <div className="container-page py-14 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="categories-heading"
            className="text-2xl font-extrabold tracking-tight text-heading sm:text-3xl"
          >
            Explore Repair Categories
          </h2>
          <p className="mt-3 text-base text-muted">
            From everyday gadgets to home essentials — pick a category and find
            a trusted technician near you.
          </p>
        </div>

        {/* Category grid */}
        <ul className="mt-10 grid gap-5 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((category) => (
            <li key={category.name} className="h-full">
              <div className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-lg">
                {/* Icon */}
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50 text-accent-strong transition-colors duration-300 group-hover:bg-accent-100 dark:bg-surface-muted dark:text-accent dark:group-hover:bg-navy-800"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                  >
                    {category.icon}
                  </svg>
                </span>

                <h3 className="mt-5 text-lg font-bold tracking-tight text-heading">
                  {category.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {category.description}
                </p>

                {/* Explore link */}
                <Link
                  href={`/services?category=${encodeURIComponent(category.name)}`}
                  aria-label={`Explore ${category.name} services`}
                  className="mt-auto inline-flex w-fit items-center gap-2 pt-5 text-sm font-semibold text-accent-strong transition-colors duration-200 hover:text-accent-600 dark:text-accent dark:hover:text-accent-400 cursor-pointer"
                >
                  Explore
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
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
