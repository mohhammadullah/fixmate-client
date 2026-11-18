import { Suspense } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, BadgeCheck } from "lucide-react";
import HeroSearch from "@/components/home/HeroSearch";
import HeroStats, { HeroStatsSkeleton } from "@/components/home/HeroStats";

/**
 * Hero Banner — the premium first impression of the FixMate marketplace.
 * Left: trust badge, headline, short description, live service search and
 * the two primary CTAs. Right: four live platform statistics streamed from
 * MongoDB (see HeroStats / GET /api/home/summary) — real numbers only.
 */
export default function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-navy-800 bg-gradient-to-br from-navy-950 via-navy-950 to-navy-900 text-navy-100">
      {/* Ambient glows — decorative only */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-[8%] h-80 w-80 rounded-full bg-accent-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 left-[-10%] h-96 w-96 rounded-full bg-accent-600/[0.07] blur-3xl"
      />

      <div className="container-page relative py-10 sm:py-14 lg:py-16 xl:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16">
          {/* ----------------------------------------------------------------
              Left — trust badge, headline, description, search, CTAs
             ---------------------------------------------------------------- */}
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-400/20 bg-accent-500/[0.08] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-400">
              <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
              Verified &amp; Approved Technicians
            </span>

            <h1 className="mt-5 text-[2.35rem] font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl">
              <span className="block">Broken Device?</span>
              <span className="block bg-gradient-to-r from-accent-400 via-accent-500 to-sky-400 bg-clip-text text-transparent">
                Get It Fixed
              </span>
              <span className="block">by Verified Technicians</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-navy-100/75 sm:text-lg">
              Trusted technicians for phones, laptops and home appliances —
              every booking backed by approved experts and genuine customer
              reviews.
            </p>

            {/* Search — routes to /services?search=… (existing query handling) */}
            <HeroSearch />

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/services"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent-500 px-7 text-sm font-bold tracking-wide text-navy-950 shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
              >
                Explore Services
                <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
              </Link>
              <Link
                href="/#how-it-works"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-7 text-sm font-semibold tracking-wide text-navy-100 transition-colors duration-200 hover:border-accent-500/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
              >
                How It Works
                <ArrowDown className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* ----------------------------------------------------------------
              Right — live platform statistics (streamed from MongoDB)
             ---------------------------------------------------------------- */}
          <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <Suspense fallback={<HeroStatsSkeleton />}>
              <HeroStats />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}
