import Link from "next/link";

/**
 * Payment return page (Stripe cancel_url).
 *
 * Reached when the customer closes or abandons Checkout. Nothing was paid,
 * nothing is marked paid — the booking stays exactly as it was, and the
 * customer can retry payment any time from the booking details page.
 *
 * `instant = false` opts this route out of instant-navigation prerender
 * validation (Cache Components), same pattern as the booking details page.
 */
export const instant = false;

const OBJECT_ID_HEX_REGEX = /^[0-9a-fA-F]{24}$/;

export default async function PaymentCancelPage({
  searchParams,
}: PageProps<"/dashboard/payments/cancel">) {
  const resolved = await searchParams;
  const raw = resolved?.["booking_id"];
  const bookingId =
    typeof raw === "string" && OBJECT_ID_HEX_REGEX.test(raw) ? raw : undefined;

  return (
    <>
      {/* ============ Slim cinematic header band ============ */}
      <section className="relative overflow-hidden border-b border-border bg-navy-950 text-[#dbe4ef]">
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
        <div className="relative px-4 py-8 sm:px-8 sm:py-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-400 sm:text-[11px]">
            Dashboard · Payment
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#f2f7fd] sm:text-3xl xl:text-4xl">
            Checkout{" "}
            <span className="bg-gradient-to-r from-accent-400 via-accent-500 to-accent-600 bg-clip-text text-transparent">
              Cancelled
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#a8bdd4]">
            Nothing was charged — your booking is untouched.
          </p>
        </div>
      </section>

      {/* ============ Cancellation panel ============ */}
      <section aria-label="Checkout cancelled" className="px-4 py-6 sm:px-8 sm:py-8">
        <div className="max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-xs sm:p-8">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-warning/40 bg-warning-soft text-warning"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          </div>
          <h2 className="mt-5 text-xl font-extrabold tracking-tight text-heading">
            No payment was made
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            You left Stripe Checkout before completing the payment, so your booking
            remains unpaid. If you closed the window by accident, you can simply start
            again from the booking details page — the previous checkout session expires
            harmlessly on Stripe&apos;s side.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {bookingId ? (
              <Link
                href={`/dashboard/bookings/${bookingId}`}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md"
              >
                Back to booking details
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
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            ) : (
              <Link
                href="/dashboard/bookings"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md"
              >
                Go to My Bookings
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
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            )}
            <Link
              href="/dashboard/payments"
              className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted"
            >
              Payment history
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
