import Link from "next/link";

const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "About Us", href: "/about" },
] as const;

const SERVICE_CATEGORIES = [
  { label: "Mobile Repair", href: "/services#mobile-repair" },
  { label: "Laptop Repair", href: "/services#laptop-repair" },
  { label: "Refrigerator Repair", href: "/services#refrigerator-repair" },
  { label: "AC Repair", href: "/services#ac-repair" },
  { label: "TV Repair", href: "/services#tv-repair" },
  { label: "Home Appliance Repair", href: "/services#home-appliance-repair" },
] as const;

const CONTACT = [
  {
    label: "support@fixmate.com",
    href: "mailto:support@fixmate.com",
    icon: (
      // Mail
      <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 1 8 6 8-6" />
    ),
  },
  {
    label: "+880 1XXX-XXXXXX",
    href: "tel:+8801000000000",
    icon: (
      // Phone
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 11.91a16 16 0 0 0 6 6l3.27-1.22a2 2 0 0 1 2.11.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    ),
  },
  {
    label: "Bangladesh",
    href: null,
    icon: (
      // Map pin
      <>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
  },
] as const;

const linkClass =
  "inline-flex w-fit rounded-sm text-sm text-muted transition-colors duration-200 hover:text-heading";

export default async function Footer() {
  "use cache";
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-page py-12 lg:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-3">
            <Link
              href="/"
              aria-label="FixMate — home"
              className="inline-flex items-center gap-2.5 rounded-lg"
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
              {SERVICE_CATEGORIES.map((service) => (
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
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {item.icon}
                    </svg>
                  </span>
                  {item.href ? (
                    <a href={item.href} className={linkClass}>
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
            © {currentYear} FixMate. All rights reserved.
          </p>
          <nav aria-label="Legal">
            <ul className="flex items-center gap-6">
              <li>
                <Link href="/privacy-policy" className={linkClass}>
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
