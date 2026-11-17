export default function Testimonials() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="relative border-t border-border"
    >
      <div className="container-page py-14 lg:py-20">
        {/* Section heading */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent">
            Testimonials
          </span>
          <h2
            id="testimonials-heading"
            className="mt-4 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl"
          >
            What Our Customers Say
          </h2>
          <p className="mt-3 text-base text-muted">
            We believe a great repair experience starts with trust and ends
            with satisfaction.
          </p>
        </div>

        {/* Feature panel — navy artwork left, honest empty-state copy right */}
        <figure className="mx-auto mt-10 grid max-w-5xl overflow-hidden rounded-2xl border border-border bg-surface shadow-lg sm:mt-12 lg:grid-cols-2">
          {/* Visual artwork panel */}
          <div
            aria-hidden="true"
            className="relative flex min-h-56 items-center justify-center overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-10 sm:min-h-72"
          >
            {/* Ambient glows */}
            <div className="absolute -left-16 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-accent-500/15 blur-3xl" />
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent-400/10 blur-3xl" />

            {/* Dot texture */}
            <div
              className="absolute bottom-6 right-8 h-28 w-28 opacity-25"
              style={{
                backgroundImage:
                  "radial-gradient(circle, var(--color-accent-400) 1.3px, transparent 1.3px)",
                backgroundSize: "14px 14px",
              }}
            />

            {/* Quote illustration */}
            <svg
              viewBox="0 0 220 160"
              width="240"
              height="175"
              role="presentation"
              fill="none"
              className="relative h-44 w-full max-w-xs sm:h-52"
            >
              {/* Concentric circles */}
              <circle cx="110" cy="80" r="72" stroke="#1b3454" strokeWidth="1.5" strokeDasharray="4 6" />
              <circle cx="110" cy="80" r="52" stroke="#274565" strokeWidth="1.5" strokeDasharray="3 5" />

              {/* Speech bubble */}
              <path
                d="M64 46h92a18 18 0 0 1 18 18v34a18 18 0 0 1-18 18H108l-26 20v-20h-18a18 18 0 0 1-18-18V64a18 18 0 0 1 18-18Z"
                fill="#0d1f36"
                stroke="#2fb8f5"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />

              {/* Quotation marks */}
              <path
                d="M92 78c0-6.6 5.4-12 12-12"
                stroke="#2fb8f5"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M118 78c0-6.6 5.4-12 12-12"
                stroke="#38bdf8"
                strokeWidth="4"
                strokeLinecap="round"
              />

              {/* Decorative dots */}
              <circle cx="150" cy="36" r="3" fill="#2fb8f5" fillOpacity="0.9" />
              <circle cx="58" cy="126" r="3" fill="#38bdf8" fillOpacity="0.8" />
              <circle cx="178" cy="112" r="2.4" fill="#7dd3fc" fillOpacity="0.7" />
            </svg>
          </div>

          {/* Empty-state copy */}
          <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-12">
            <span
              aria-hidden="true"
              className="text-xs font-semibold uppercase tracking-widest text-accent-strong dark:text-accent"
            >
              Customer Stories
            </span>
            <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">
              Customer Stories Coming Soon
            </h3>
            <p className="mt-4 max-w-md text-base leading-7 text-muted">
              We&rsquo;re looking forward to sharing real experiences from
              customers who use FixMate.
            </p>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted">
              Every story you&rsquo;ll see here will come from a genuine repair
              booked through FixMate — shared honestly, and never invented.
            </p>

            {/* Decorative divider */}
            <div
              aria-hidden="true"
              className="mt-6 flex items-center gap-2"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400/70" />
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400/40" />
              <span className="ml-2 h-px w-24 bg-border-strong" />
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}
