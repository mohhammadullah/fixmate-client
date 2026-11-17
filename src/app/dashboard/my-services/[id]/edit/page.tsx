import EditService from "@/components/dashboard/EditService";

/**
 * Technician-only Edit Service page — dynamic route shell.
 *
 * Route: /dashboard/my-services/[id]/edit
 * Params: Promise<{ id: string }> — the service ObjectId hex string.
 *
 * The dashboard layout has already confirmed the session; the client
 * component adds the technician role check, finds the matching service from
 * the technician's own /api/services/my list, and renders the pre-filled
 * form. Identity comes exclusively from the verified JWT; the server
 * derives technicianId from it, never from the body. Updating a service
 * resets its approval status to "pending" (server-controlled).
 *
 * `instant = false` opts this route out of instant-navigation prerender
 * validation (Cache Components), matching the other session-gated routes.
 */
export const instant = false;

export default async function EditServicePage({
  params,
}: PageProps<"/dashboard/my-services/[id]/edit">) {
  // Next.js 16: params is a Promise; await it in this Server Component and
  // pass the plain string down to the client component.
  const { id } = await params;

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
            Dashboard · Technician · My Services
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#f2f7fd] sm:text-3xl xl:text-4xl">
            Edit{" "}
            <span className="bg-gradient-to-r from-accent-400 via-accent-500 to-accent-600 bg-clip-text text-transparent">
              Service
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#a8bdd4]">
            Update the details of one of your services. Saving resets its
            approval status to pending while the FixMate team reviews the
            changes.
          </p>
        </div>
      </section>

      {/* ============ Edit service form ============ */}
      <section aria-label="Edit service" className="px-4 py-6 sm:px-8 sm:py-8">
        <EditService serviceId={id} />
      </section>
    </>
  );
}
