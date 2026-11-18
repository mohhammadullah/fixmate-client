import Link from "next/link";
import {
  SERVICE_CATEGORIES,
  categoryHref,
  type ServiceCategory,
} from "@/lib/service-categories";

/**
 * Popular Categories — one compact card per Assignment 9 category.
 *
 * The icons are Lucide's line-art icon paths inlined as SVG components so no
 * extra runtime dependency is added (the rest of the app uses inline SVGs too).
 * Each card is a real link to the Services listing with that canonical
 * category already applied as a `?category=` filter.
 */

type IconName =
  | "smartphone"
  | "laptop"
  | "wind"
  | "refrigerator"
  | "tv"
  | "washing"
  | "zap";

const CATEGORY_META: Record<
  ServiceCategory,
  { icon: IconName; description: string }
> = {
  Smartphone: {
    icon: "smartphone",
    description: "Screens, batteries & software",
  },
  "Laptop & PC": {
    icon: "laptop",
    description: "Computers, parts & upgrades",
  },
  AC: { icon: "wind", description: "Cooling & ventilation" },
  Refrigerator: { icon: "refrigerator", description: "Fridges & freezers" },
  TV: { icon: "tv", description: "Displays & home theatre" },
  "Washing Machine": {
    icon: "washing",
    description: "Washers & dryers",
  },
  Electrical: { icon: "zap", description: "Wiring, switches & lights" },
};

function CategoryIcon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const props = {
    viewBox: "0 0 24 24",
    width: 22,
    height: 22,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    className,
  };

  switch (name) {
    case "smartphone":
      return (
        <svg {...props}>
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M11 18h2" />
        </svg>
      );
    case "laptop":
      return (
        <svg {...props}>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8" />
          <path d="M12 17v4" />
        </svg>
      );
    case "wind":
      return (
        <svg {...props}>
          <path d="M12.8 19.6A2 2 0 1 0 14 16H2" />
          <path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" />
          <path d="M9.8 4.4A2 2 0 1 1 11 8H2" />
        </svg>
      );
    case "refrigerator":
      return (
        <svg {...props}>
          <path d="M5 6a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
          <path d="M5 10h14" />
          <path d="M15 2v4" />
          <path d="M15 14v4" />
        </svg>
      );
    case "tv":
      return (
        <svg {...props}>
          <rect x="2" y="7" width="20" height="15" rx="2" />
          <path d="m17 2-5 5-5-5" />
        </svg>
      );
    case "washing":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="17" rx="2" />
          <path d="M3 9h18" />
          <circle cx="12" cy="14" r="4.5" />
          <path d="M7 2v3" />
          <path d="M17 2v3" />
        </svg>
      );
    case "zap":
      return (
        <svg {...props}>
          <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
        </svg>
      );
  }
}

export default function PopularCategories() {
  return (
    <section
      aria-labelledby="popular-categories-heading"
      className="border-t border-border bg-background/40"
    >
      <div className="container-page py-12 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50 px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent">
              Categories
            </span>
            <h2
              id="popular-categories-heading"
              className="mt-3 text-xl font-extrabold tracking-tight text-heading sm:text-2xl"
            >
              Popular Categories
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Find the right specialist for your device or home appliance.
            </p>
          </div>
          <Link
            href="/services"
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-accent-strong transition-colors duration-200 hover:text-accent-600 dark:text-accent dark:hover:text-accent-400 sm:text-sm"
          >
            Browse all services
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>

        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {SERVICE_CATEGORIES.map((category) => {
            const meta = CATEGORY_META[category];
            return (
              <li key={category}>
                <Link
                  href={categoryHref(category)}
                  aria-label={`Browse ${category} repair services`}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-500/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-strong ring-1 ring-inset ring-accent-100 transition-colors duration-200 group-hover:bg-accent-500 group-hover:text-navy-950 group-hover:ring-accent-500 dark:bg-accent-400/10 dark:text-accent dark:ring-accent-400/20"
                  >
                    <CategoryIcon name={meta.icon} className="h-[22px] w-[22px]" />
                  </span>
                  <span className="mt-3 text-[13px] font-bold leading-snug text-heading sm:text-sm">
                    {category}
                  </span>
                  <span className="mt-1 text-[11px] leading-snug text-muted">
                    {meta.description}
                  </span>
                  <span
                    aria-hidden="true"
                    className="mt-3 flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted transition-all duration-200 group-hover:border-accent-500 group-hover:bg-accent-500 group-hover:text-navy-950"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
