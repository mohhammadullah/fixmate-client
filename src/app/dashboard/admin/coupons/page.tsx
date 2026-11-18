import { RoleGate } from "@/components/dashboard/RoleGate";
import AdminCoupons from "@/components/dashboard/AdminCoupons";

export default function AdminCouponsPage() {
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
            Coupon Codes
          </h1>
          <p className="mt-1.5 max-w-lg text-sm leading-6 text-slate-300">
            Promotional codes for customer checkouts. Creation and edits are
            restricted to the Main Admin; every redemption is verified server-side.
          </p>
        </div>
      </section>

      <div className="container-page py-8">
        <RoleGate role="admin">
          <AdminCoupons />
        </RoleGate>
      </div>
    </>
  );
}
