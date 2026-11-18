import { TechnicianBookingsScreen } from "@/components/dashboard/TechnicianBookings";

/**
 * Technician-only Incoming Bookings page (Server Component shell).
 *
 * The dashboard layout has already confirmed the session; the client screen
 * adds the technician role check. Customer/admin accounts (or unknown
 * roles) see an honest access-denied panel instead of private booking data —
 * and, as always, the backend remains the real authority (`verifyTechnician`
 * on the endpoint). Identity comes exclusively from the verified JWT; no
 * technicianId is ever sent from the client.
 *
 * `instant = false` opts this route out of instant-navigation prerender
 * validation (Cache Components), matching the other session-gated routes.
 */
export const instant = false;

export default function IncomingBookingsPage() {
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
            Dashboard · Technician
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#f2f7fd] sm:text-3xl xl:text-4xl">
            Incoming{" "}
            <span className="bg-gradient-to-r from-accent-400 via-accent-500 to-accent-600 bg-clip-text text-transparent">
              Bookings
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#a8bdd4]">
            Every repair request sent your way — customer details, the problem
            they reported, and where each booking stands.
          </p>
        </div>
      </section>

      <section aria-label="Incoming bookings" className="px-4 py-6 sm:px-8 sm:py-8">
        <TechnicianBookingsScreen />
      </section>
    </>
  );
}
