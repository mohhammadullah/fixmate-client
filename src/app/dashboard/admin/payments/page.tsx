import AdminPayments from "@/components/dashboard/AdminPayments";

/**
 * Admin-only payment reconciliation page (Server Component shell).
 * The client screen adds the admin role gate and renders the view — and,
 * as always, the backend is the real authority (`verifyAdmin` on the
 * endpoint). Payment rows here are strictly read-only; statuses are owned
 * by the verified Stripe webhook.
 */
export const instant = false;

export default function AdminPaymentsPage() {
  return (
    <>
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
            Dashboard · Admin
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#f2f7fd] sm:text-3xl xl:text-4xl">
            Payment{" "}
            <span className="bg-gradient-to-r from-accent-400 via-accent-500 to-accent-600 bg-clip-text text-transparent">
              Management
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#a8bdd4]">
            Every Stripe Checkout settled on FixMate — amount, status,
            customer and references. Read-only; statuses come from the
            verified Stripe webhook.
          </p>
        </div>
      </section>

      <section aria-label="Payments" className="px-4 py-6 sm:px-8 sm:py-8">
        <AdminPayments />
      </section>
    </>
  );
}
