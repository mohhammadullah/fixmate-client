import PaymentSuccess from "@/components/dashboard/PaymentSuccess";

/**
 * Payment return page (Stripe success_url).
 *
 * The `booking_id` query param is a navigation hint only — the page never
 * treats the redirect, or the parameter, as proof of payment. The client
 * screen polls the backend until the webhook flips the booking to paid.
 *
 * `instant = false` opts this route out of instant-navigation prerender
 * validation (Cache Components), same pattern as the booking details page.
 */
export const instant = false;

export default async function PaymentSuccessPage({
  searchParams,
}: PageProps<"/dashboard/payments/success">) {
  const resolved = await searchParams;
  const raw = resolved?.["booking_id"];
  const bookingId = typeof raw === "string" ? raw : undefined;

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
            Confirming{" "}
            <span className="bg-gradient-to-r from-accent-400 via-accent-500 to-accent-600 bg-clip-text text-transparent">
              Payment
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#a8bdd4]">
            Stripe notifies FixMate securely after your payment — this page
            never takes the redirect&apos;s word for it.
          </p>
        </div>
      </section>

      {/* ============ Confirmation ============ */}
      <section aria-label="Payment confirmation" className="px-4 py-6 sm:px-8 sm:py-8">
        <PaymentSuccess bookingId={bookingId} />
      </section>
    </>
  );
}
