import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you requested could not be found.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-16 sm:px-6">
      <section
        aria-labelledby="not-found-heading"
        className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 text-center shadow-xs sm:p-8"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-strong dark:text-accent">
          404
        </p>
        <h1 id="not-found-heading" className="mt-2 text-2xl font-extrabold tracking-tight text-heading">
          Page not found
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="cursor-pointer rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98]"
          >
            Go to home
          </Link>
          <Link
            href="/services"
            className="cursor-pointer rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted"
          >
            Browse services
          </Link>
        </div>
      </section>
    </main>
  );
}
