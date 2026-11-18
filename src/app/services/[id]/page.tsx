import ServiceDetails from "@/components/services/ServiceDetails";

/**
 * Public service-details page.
 *
 * Route: /services/[id] — the service itself is fetched from the public
 * GET /api/services/:id endpoint (no auth required). Booking is handled by
 * the client component, which uses the Better Auth session and a dynamic
 * JWT only when a customer actually submits a request.
 *
 * `instant = false` opts this route out of instant-navigation prerender
 * validation (Cache Components): the client subtree reads the session for
 * the booking panel, so the shell can't be fully prerendered.
 */
export const instant = false;

export default async function ServiceDetailsPage({
  params,
}: PageProps<"/services/[id]">) {
  const { id } = await params;

  return (
    <main>
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
            FixMate · Service Details
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#f2f7fd] sm:text-3xl xl:text-4xl">
            Repair{" "}
            <span className="bg-gradient-to-r from-accent-400 via-accent-500 to-accent-600 bg-clip-text text-transparent">
              Service
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#a8bdd4]">
            Everything you need to know before requesting this repair — scope,
            pricing, capacity and what&apos;s included.
          </p>
        </div>
      </section>

      <section className="container-page py-8 lg:py-12">
        <ServiceDetails serviceId={id} />
      </section>
    </main>
  );
}
