import { RoleGate } from "@/components/dashboard/RoleGate";
import AdminRefunds from "@/components/dashboard/AdminRefunds";

export default function AdminRefundsPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-navy-950">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-500/15 blur-3xl"
        />
        <div className="container-page py-8 lg:py-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-400">
            Admin
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#f2f7fd] sm:text-3xl">
            Refund Requests
          </h1>
          <p className="mt-1.5 max-w-lg text-sm leading-6 text-slate-300">
            Approve or reject customer refund requests. Approved refunds are
            issued through Stripe with idempotent keys — never manually.
          </p>
        </div>
      </section>

      <div className="container-page py-8">
        <RoleGate role="admin">
          <AdminRefunds />
        </RoleGate>
      </div>
    </>
  );
}
