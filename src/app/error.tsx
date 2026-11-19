"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep details out of the UI; logging stays minimal for diagnostics.
    console.error("Route error:", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-16 sm:px-6">
      <section
        role="alert"
        aria-labelledby="route-error-heading"
        className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 text-center shadow-xs sm:p-8"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-strong dark:text-accent">
          Something went wrong
        </p>
        <h1 id="route-error-heading" className="mt-2 text-2xl font-extrabold tracking-tight text-heading">
          We couldn&apos;t load this page
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Please try again. If the problem continues, you can return to a safe page.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="cursor-pointer rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="cursor-pointer rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted"
          >
            Go to home
          </Link>
        </div>
      </section>
    </main>
  );
}
