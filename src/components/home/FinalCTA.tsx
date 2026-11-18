import Link from "next/link";

export default function FinalCTA() {
  return (
    <section aria-labelledby="final-cta-heading" className="relative">
      <div className="container-page pb-16 pt-4 sm:pb-20 lg:pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-navy-700 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 px-6 py-16 text-center shadow-lg sm:px-12 sm:py-20">
          {/* Ambient glows */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-72 w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-500/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent-400/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-16 h-64 w-64 rounded-full bg-accent-600/15 blur-3xl"
          />

          {/* Dot textures */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-6 top-8 hidden h-32 w-32 opacity-30 sm:block"
            style={{
              backgroundImage:
                "radial-gradient(circle, #2fb8f5 1.4px, transparent 1.4px)",
              backgroundSize: "16px 16px",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-8 right-6 hidden h-32 w-32 opacity-30 sm:block"
            style={{
              backgroundImage:
                "radial-gradient(circle, #38bdf8 1.4px, transparent 1.4px)",
              backgroundSize: "16px 16px",
            }}
          />

          {/* Decorative geometric accent — orbiting wrench */}
          <svg
            viewBox="0 0 200 200"
            width="220"
            height="220"
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 top-1/2 hidden h-56 w-56 -translate-y-1/2 opacity-70 md:block lg:right-6 lg:h-64 lg:w-64"
            fill="none"
          >
            <circle cx="100" cy="100" r="86" stroke="#1b3454" strokeWidth="1.5" strokeDasharray="5 8" />
            <circle cx="100" cy="100" r="58" stroke="#274565" strokeWidth="1.5" strokeDasharray="3 6" />
            <circle cx="100" cy="100" r="30" fill="#0d1f36" stroke="#2fb8f5" strokeWidth="2" />
            {/* Wrench glyph */}
            <path
              d="M104.4 92.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
              stroke="#2fb8f5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(-8 -8) scale(1.15)"
            />
            <circle cx="100" cy="14" r="3" fill="#2fb8f5" />
            <circle cx="186" cy="100" r="2.4" fill="#38bdf8" />
            <circle cx="100" cy="186" r="2.4" fill="#38bdf8" fillOpacity="0.8" />
            <circle cx="14" cy="100" r="3" fill="#2fb8f5" fillOpacity="0.8" />
          </svg>

          <div className="relative mx-auto max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-400/30 bg-accent-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-400">
              Get Started with FixMate
            </span>
            <h2
              id="final-cta-heading"
              className="mt-5 text-3xl font-extrabold leading-[1.15] tracking-tight text-[#f2f7fd] sm:text-4xl lg:text-5xl"
            >
              Ready to Get Your Device{" "}
              <span className="bg-gradient-to-r from-accent-400 via-accent-500 to-accent-400 bg-clip-text text-transparent">
                Fixed?
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#b7c6da] sm:text-lg">
              Find the right repair service, connect with a technician, and get
              your device back in working order. Start your repair journey with
              FixMate today.
            </p>

            {/* CTAs */}
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-7 py-3.5 text-sm font-semibold text-[#04121f] shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-400"
              >
                Get Started
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-4 w-4"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-[#e6eef8] backdrop-blur-sm transition-colors duration-200 hover:border-accent-400/40 hover:bg-white/10 hover:text-white"
              >
                Explore Services
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
                  className="h-4 w-4"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
