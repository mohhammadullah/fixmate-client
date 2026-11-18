import { RoleGate } from "@/components/dashboard/RoleGate";
import AdminBookingDetails from "@/components/dashboard/AdminBookingDetails";

export const instant = false;

export default async function AdminBookingDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-navy-950">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-500/15 blur-3xl"
        />
        <div className="container-page py-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-400">
            Admin
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#f2f7fd]">
            Booking Details
          </h1>
        </div>
      </section>

      <div className="container-page py-8">
        <RoleGate role="admin">
          <AdminBookingDetails bookingId={id} />
        </RoleGate>
      </div>
    </>
  );
}
