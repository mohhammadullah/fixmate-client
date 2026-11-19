import Link from "next/link";

/**
 * Shared shell for the /terms and /privacy pages — navy/electric-blue
 * hero, "last updated" metadata, sticky table of contents on desktop and
 * consistent section typography. Content itself lives in the page files.
 */

export interface LegalTocItem {
  id: string;
  title: string;
}

export default function LegalPage({
  eyebrow,
  title,
  lede,
  lastUpdated,
  sections,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  lastUpdated: string;
  sections: LegalTocItem[];
  children: React.ReactNode;
}) {
  return (
    <main>
      {/* Hero — mirrors the dashboard inner-page banner pattern */}
      <section
        aria-labelledby="legal-page-heading"
        className="relative overflow-hidden border-b border-border bg-navy-950 text-[#dbe4ef]"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(56,189,248,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.055) 1px, transparent 1px)",
            backgroundSize: "46px 46px",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-600/20 blur-3xl"
        />
        <div className="relative px-4 py-10 sm:px-8 sm:py-12">
          <Link
            href="/"
            className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-accent-400 transition-colors duration-200 hover:text-accent-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            Back to FixMate
          </Link>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-400 sm:text-[11px]">
            {eyebrow}
          </p>
          <h1
            id="legal-page-heading"
            className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight text-[#f2f7fd] sm:text-4xl xl:text-5xl"
          >
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a8bdd4] sm:text-base sm:leading-7">
            {lede}
          </p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-100">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-3.5 w-3.5"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            Last updated: {lastUpdated}
          </p>
        </div>
      </section>

      {/* Body — article + sticky TOC */}
      <section className="px-4 py-10 sm:px-8 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem] xl:gap-14">
          <article className="max-w-3xl space-y-10">{children}</article>
          <aside aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-border bg-surface p-5 shadow-xs">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                On this page
              </p>
              <nav aria-label="Table of contents" className="mt-3">
                <ol className="flex flex-col gap-1.5 text-[13px] leading-5">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="block cursor-pointer rounded-md px-2 py-1 text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  Questions?
                </p>
                <a
                  href="mailto:gmhgazi92@gmail.com"
                  className="mt-1.5 block cursor-pointer break-all text-[13px] font-semibold text-accent-strong transition-colors duration-150 hover:text-accent-600 dark:text-accent dark:hover:text-accent-400"
                >
                  gmhgazi92@gmail.com
                </a>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

/** One numbered section with a stable anchor id. */
export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <h2
        id={`${id}-heading`}
        className="text-lg font-extrabold tracking-tight text-heading sm:text-xl"
      >
        {title}
      </h2>
      <div className="mt-2.5 space-y-3 text-[15px] leading-7 text-foreground/90">
        {children}
      </div>
    </section>
  );
}

/** Honest-limits callout used on both pages. */
export function LegalNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-accent-500/40 bg-accent-50/60 px-5 py-4 text-[13px] leading-6 text-foreground/90 dark:border-accent-400/25 dark:bg-accent-400/5">
      {children}
    </div>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-accent-500">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
