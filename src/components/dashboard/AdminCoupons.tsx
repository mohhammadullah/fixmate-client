"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchAdminCoupons,
  createCoupon,
  updateCoupon,
  disableCoupon,
  type AdminCoupon,
} from "@/lib/admin-api";

const INITIAL_FORM = {
  code: "",
  kind: "percent" as "percent" | "fixed",
  value: "10",
  currency: "usd",
  minBookingAmount: "0",
  maxDiscount: "",
  startsAt: new Date().toISOString().slice(0, 10),
  expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  globalLimit: "",
  perCustomerLimit: "1",
};

export default function AdminCoupons() {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; message: string }
    | { phase: "success"; coupons: AdminCoupon[]; isMainAdmin: boolean }
  >({ phase: "loading" });
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { coupons, isMainAdmin } = await fetchAdminCoupons();
      setState({ phase: "success", coupons, isMainAdmin });
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "Could not load coupons.",
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchAdminCoupons()
      .then((result) => {
        if (cancelled) return;
        setState({ phase: "success", coupons: result.coupons, isMainAdmin: result.isMainAdmin });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          phase: "error",
          message: error instanceof Error ? error.message : "Could not load coupons.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    if (state.phase !== "success" || !state.isMainAdmin) {
      toast.error("Only the Main Admin can create coupons.");
      return;
    }

    const value = Number(form.value);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid discount value.");
      return;
    }
    if (form.kind === "percent" && value > 100) {
      toast.error("Percent coupons can be at most 100%.");
      return;
    }

    setIsSaving(true);
    try {
      await createCoupon({
        code: form.code.trim().toUpperCase(),
        kind: form.kind,
        value,
        ...(form.kind === "fixed" ? { currency: form.currency.trim().toLowerCase() } : {}),
        minBookingAmount: Number(form.minBookingAmount) || 0,
        ...(form.maxDiscount.trim() ? { maxDiscount: Number(form.maxDiscount) } : {}),
        startsAt: new Date(`${form.startsAt}T00:00:00.000Z`).toISOString(),
        expiresAt: new Date(`${form.expiresAt}T23:59:59.999Z`).toISOString(),
        ...(form.globalLimit.trim() ? { globalLimit: Number(form.globalLimit) } : {}),
        perCustomerLimit: Number(form.perCustomerLimit) || 1,
      });
      toast.success(`Coupon ${form.code.trim().toUpperCase()} created.`);
      setForm(INITIAL_FORM);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the coupon.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(coupon: AdminCoupon) {
    if (busyCode) return;
    setBusyCode(coupon.code);
    try {
      await updateCoupon(coupon.code, { active: !coupon.active });
      toast.success(coupon.active ? `${coupon.code} disabled.` : `${coupon.code} re-enabled.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the coupon.");
    } finally {
      setBusyCode(null);
    }
  }

  async function handleDisable(coupon: AdminCoupon) {
    if (busyCode) return;
    setBusyCode(coupon.code);
    try {
      await disableCoupon(coupon.code);
      toast.success(`${coupon.code} disabled.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disable the coupon.");
    } finally {
      setBusyCode(null);
    }
  }

  const formatMoney = (amount: number, currency?: string) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency ?? "usd").toUpperCase(),
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);

  if (state.phase === "loading") {
    return (
      <div role="status" aria-label="Loading coupons…" className="space-y-4">
        <span className="sr-only">Loading coupons…</span>
        <div className="h-48 animate-pulse rounded-2xl border border-border bg-surface" />
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-surface" />
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div role="alert" className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm font-medium text-error">{state.message}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 cursor-pointer rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Try again
        </button>
      </div>
    );
  }

  const { coupons, isMainAdmin } = state;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Create form — Main Admin only */}
      <section aria-labelledby="create-coupon-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6 lg:col-span-2">
        <h2 id="create-coupon-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
          New coupon
        </h2>
        {!isMainAdmin && (
          <p className="mt-2 rounded-lg border border-warning/40 bg-warning-soft/60 px-3 py-2 text-xs leading-5 text-warning" role="status">
            Only the Main Admin can create or edit coupons. You can view the list.
          </p>
        )}
        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              Code
              <input
                type="text"
                required
                value={form.code}
                maxLength={32}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                placeholder="EID20"
                pattern="[A-Z0-9_\-]+"
                disabled={!isMainAdmin}
                className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm uppercase text-foreground placeholder:text-muted focus:border-accent-500 focus:outline-none disabled:opacity-50"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Type
              <select
                value={form.kind}
                disabled={!isMainAdmin}
                onChange={(event) => setForm({ ...form, kind: event.target.value as "percent" | "fixed" })}
                className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-accent-500 focus:outline-none disabled:opacity-50"
              >
                <option value="percent">Percent off</option>
                <option value="fixed">Fixed amount off</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              Value {form.kind === "percent" ? "(%)" : "(amount)"}
              <input
                type="number"
                required
                min={0.01}
                step="0.01"
                value={form.value}
                disabled={!isMainAdmin}
                onChange={(event) => setForm({ ...form, value: event.target.value })}
                className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-accent-500 focus:outline-none disabled:opacity-50"
              />
            </label>
            {form.kind === "fixed" ? (
              <label className="text-xs font-semibold text-muted">
                Currency
                <input
                  type="text"
                  required
                  maxLength={3}
                  value={form.currency}
                  disabled={!isMainAdmin}
                  onChange={(event) => setForm({ ...form, currency: event.target.value.toLowerCase() })}
                  placeholder="usd"
                  className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm lowercase text-foreground placeholder:text-muted focus:border-accent-500 focus:outline-none disabled:opacity-50"
                />
              </label>
            ) : (
              <label className="text-xs font-semibold text-muted">
                Max discount ({form.currency || "usd"}) — optional
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.maxDiscount}
                  disabled={!isMainAdmin}
                  onChange={(event) => setForm({ ...form, maxDiscount: event.target.value })}
                  placeholder="No cap"
                  className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted focus:border-accent-500 focus:outline-none disabled:opacity-50"
                />
              </label>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              Min. booking amount
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.minBookingAmount}
                disabled={!isMainAdmin}
                onChange={(event) => setForm({ ...form, minBookingAmount: event.target.value })}
                className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-accent-500 focus:outline-none disabled:opacity-50"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-muted">
                Per-customer limit
                <input
                  type="number"
                  required
                  min={1}
                  step="1"
                  value={form.perCustomerLimit}
                  disabled={!isMainAdmin}
                  onChange={(event) => setForm({ ...form, perCustomerLimit: event.target.value })}
                  className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-accent-500 focus:outline-none disabled:opacity-50"
                />
              </label>
              <label className="text-xs font-semibold text-muted">
                Global limit — optional
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={form.globalLimit}
                  disabled={!isMainAdmin}
                  onChange={(event) => setForm({ ...form, globalLimit: event.target.value })}
                  placeholder="Unlimited"
                  className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted focus:border-accent-500 focus:outline-none disabled:opacity-50"
                />
              </label>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              Starts
              <input type="date" value={form.startsAt} disabled={!isMainAdmin} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-accent-500 focus:outline-none disabled:opacity-50" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Expires
              <input type="date" value={form.expiresAt} disabled={!isMainAdmin} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-accent-500 focus:outline-none disabled:opacity-50" />
            </label>
          </div>

          <button
            type="submit"
            disabled={isSaving || !isMainAdmin || !form.code.trim()}
            className="mt-1 inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Creating…" : "Create coupon"}
          </button>
        </form>
      </section>

      {/* List */}
      <section aria-labelledby="coupons-list-heading" className="rounded-2xl border border-border bg-surface shadow-xs lg:col-span-3">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id="coupons-list-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
            All coupons ({coupons.length})
          </h2>
        </div>
        {coupons.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-heading">No coupons yet</p>
            <p className="mt-1 text-xs text-muted">Create the first coupon using the form.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {coupons.map((coupon) => (
              <li key={coupon.code} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-surface-muted px-2 py-1 font-mono text-xs font-bold text-heading">
                        {coupon.code}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${coupon.active ? "border-success/40 bg-success-soft text-success" : "border-muted/40 bg-surface-muted text-muted"}`}>
                        {coupon.active ? "Active" : "Disabled"}
                      </span>
                      {coupon.globalLimit !== undefined && (
                        <span className="text-[10px] font-medium text-muted">
                          {coupon.usageCount}/{coupon.globalLimit} used
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-heading">
                      {coupon.kind === "percent"
                        ? `${coupon.value}% off`
                        : `${formatMoney(coupon.value, coupon.currency)} off`}
                      {coupon.minBookingAmount > 0 && (
                        <span className="ml-2 text-xs font-normal text-muted">min {formatMoney(coupon.minBookingAmount, coupon.currency)}</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      Per-customer limit {coupon.perCustomerLimit}
                      {coupon.expiresAt && ` · Expires ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(coupon.expiresAt))}`}
                      {" · "}Used {coupon.usageCount} {coupon.usageCount === 1 ? "time" : "times"}
                    </p>
                  </div>
                  {isMainAdmin && (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={busyCode === coupon.code}
                        onClick={() => handleToggle(coupon)}
                        className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-heading transition-colors hover:bg-surface-muted disabled:opacity-50"
                      >
                        {busyCode === coupon.code ? "…" : coupon.active ? "Disable" : "Enable"}
                      </button>
                      {coupon.active && (
                        <button
                          type="button"
                          disabled={busyCode === coupon.code}
                          onClick={() => handleDisable(coupon)}
                          className="cursor-pointer rounded-full border border-error/40 px-3 py-1.5 text-[11px] font-semibold text-error transition-colors hover:bg-error-soft disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
