import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { SERVICE_CATEGORIES, categoryHref } from "@/lib/service-categories";
import CurrentYear from "./CurrentYear";

const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "About Us", href: "/about" },
] as const;

// One canonical link per assignment category. Every link lands on the real
// Services listing with that category filter applied (no dead fragments).
const CATEGORY_LINKS = SERVICE_CATEGORIES.map((label) => ({
  label,
  href: categoryHref(label),
}));

interface ContactItem {
  label: string;
  href: string | null;
  /** Lucide icon for standard glyphs; inline SVG only for the LinkedIn brand mark. */
  icon: React.ReactNode;
  ariaLabel?: string;
  external?: boolean;
}

const CONTACT: ContactItem[] = [
  {
    label: "gmhgazi92@gmail.com",
    href: "mailto:gmhgazi92@gmail.com",
    icon: <Mail className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />,
    ariaLabel: "Email gmhgazi92@gmail.com",
  },
  {
    label: "01952182385",
    href: "tel:+8801952182385",
    icon: <Phone className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />,
    ariaLabel: "Call 01952182385",
  },
  {
    label: "Khulna, Bangladesh",
    href: null,
    icon: <MapPin className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />,
  },
  {
    label: "LinkedIn / gazi-mohammadullah",
    href: "https://www.linkedin.com/in/gazi-mohammadullah",
    // Lucide has no brand glyphs in this build — inline the recognizable LinkedIn "in" mark.
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56z" />
      </svg>
    ),
    ariaLabel: "Gazi Mohammadullah on LinkedIn",
    external: true,
  },
];

const linkClass =
  "inline-flex w-fit cursor-pointer rounded-sm text-sm text-muted transition-colors duration-200 hover:text-heading hover:underline hover:underline-offset-4 active:text-accent-strong dark:active:text-accent";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-page py-12 lg:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-3">
            <Link
              href="/"
              aria-label="FixMate — home"
              className="inline-flex cursor-pointer items-center gap-2.5 rounded-lg transition-opacity duration-200 hover:opacity-80 active:opacity-60"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-accent-400"
              >
                {/* Wrench — consistent with the Navbar brand mark */}
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </span>
              <span className="text-xl font-bold tracking-tight">
                <span className="text-heading">Fix</span>
                <span className="text-accent-strong dark:text-accent">
                  Mate
                </span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted">
              FixMate connects you with trusted technicians for reliable
              smart-device and home-appliance repair — fast, affordable and
              done right the first time.
            </p>
          </div>

          {/* Quick Links */}
          <nav aria-label="Quick links" className="lg:col-span-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-heading">
              Quick Links
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Service Categories */}
          <nav aria-label="Service categories" className="lg:col-span-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-heading">
              Service Categories
            </h2>
            <ul className="mt-4 grid grid-cols-1 gap-2.5">
              {CATEGORY_LINKS.map((service) => (
                <li key={service.label}>
                  <Link href={service.href} className={linkClass}>
                    {service.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div className="lg:col-span-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-heading">
              Contact
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {CONTACT.map((item) => (
                <li key={item.label} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-accent-strong dark:text-accent"
                  >
                    {item.icon}
                  </span>
                  {item.href ? (
                    <a
                      href={item.href}
                      {...(item.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      aria-label={item.ariaLabel ?? item.label}
                      className={`${linkClass} break-all`}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <span className="text-sm text-muted">{item.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-sm text-muted">
            © <CurrentYear /> FixMate. All rights reserved.
          </p>
          <nav aria-label="Legal">
            <ul className="flex items-center gap-6">
              <li>
                <Link href="/privacy" className={linkClass}>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className={linkClass}>
                  Terms &amp; Conditions
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
