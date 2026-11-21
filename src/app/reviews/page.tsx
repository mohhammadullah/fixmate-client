import Link from "next/link";
import type { Metadata } from "next";
import ReviewsExplorer from "@/components/reviews/ReviewsExplorer";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Customer Reviews",
  description:
    "Read genuine FixMate customer reviews from completed repair bookings to understand real service experiences before you book.",
  path: "/reviews",
});

export default function ReviewsPage() {
  return (
    <main>
      {/* Navy page banner */}
      <section className="relative overflow-hidden border-b border-border bg-navy-950">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-500/15 blur-3xl"
        />
        <div className="container-page py-10 lg:py-14">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 transition-colors hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            Back to home
          </Link>
          <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-400">
            Customer Stories
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#f2f7fd] sm:text-4xl">
            Every FixMate Review, In One Place
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
            Each review is tied to a completed repair booked through FixMate.
            No curated praise — just what customers actually experienced.
          </p>
        </div>
      </section>

      <section className="container-page py-10 lg:py-14">
        <ReviewsExplorer />
      </section>
    </main>
  );
}
