"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f8fafc] text-[#0f172a] antialiased">
        <main className="flex min-h-screen items-center justify-center px-4 py-16">
          <section
            role="alert"
            aria-labelledby="global-error-heading"
            className="w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-8 text-center shadow-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0284c7]">
              Application error
            </p>
            <h1 id="global-error-heading" className="mt-2 text-2xl font-extrabold tracking-tight">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#475569]">
              We couldn&apos;t load FixMate right now. Please try again.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="cursor-pointer rounded-full bg-[#0f172a] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1e293b]"
              >
                Try again
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error replaces the root layout; Next Link may be unavailable */}
              <a
                href="/"
                className="cursor-pointer rounded-full border border-[#e2e8f0] px-5 py-2.5 text-sm font-semibold text-[#0f172a] transition-colors hover:bg-[#f1f5f9]"
              >
                Go to home
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
