"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { fetchAdminAnalytics, type AdminAnalyticsData } from "@/lib/admin-api";
import { minorUnitExponent } from "@/lib/currency";

const STATUS_COLORS: Record<string, string> = {
  requested: "#38bdf8",
  accepted: "#0ea5e9",
  "in-progress": "#f59e0b",
  completed: "#22c55e",
  rejected: "#f87171",
  cancelled: "#64748b",
};

const NAVY = "#0b1b30";
const ACCENT = "#0ea5e9";

const toMajor = (minor: number, currency: string): number =>
  minor / 10 ** minorUnitExponent(currency);

const formatMoney = (minor: number, currency: string) => {
  const exponent = minorUnitExponent(currency);
  const major = toMajor(minor, currency);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(major);
  } catch {
    return `${major.toFixed(exponent)} ${currency.toUpperCase()}`;
  }
};

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-extrabold tabular-nums tracking-tight text-heading">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

const INITIAL_RANGE = (() => {
  const to = new Date();
  to.setUTCHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
})();

export default function AdminAnalytics() {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; message: string }
    | { phase: "success"; data: AdminAnalyticsData }
  >({ phase: "loading" });

  const [from, setFrom] = useState(INITIAL_RANGE.from);
  const [to, setTo] = useState(INITIAL_RANGE.to);
  const [currency, setCurrency] = useState<string>("");

  const load = useCallback(async (range?: { from?: string; to?: string }) => {
    try {
      const data = await fetchAdminAnalytics(range);
      setState({ phase: "success", data });
      // Auto-select the first currency for the revenue chart.
      setCurrency((current) => current || data.payments.byCurrency[0]?.currency || "");
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "Could not load analytics.",
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchAdminAnalytics(INITIAL_RANGE)
      .then((data) => {
        if (cancelled) return;
        setState({ phase: "success", data });
        setCurrency((current) => current || data.payments.byCurrency[0]?.currency || "");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          phase: "error",
          message: error instanceof Error ? error.message : "Could not load analytics.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function exportCsv() {
    if (state.phase !== "success") return;
    const data = state.data;
    const lines: string[] = [
      "metric,value",
      `range_from,${data.range.from}`,
      `range_to,${data.range.to}`,
      `users_total,${data.users.total}`,
      `customers,${data.users.customers}`,
      `technicians,${data.users.technicians}`,
      `active_technicians,${data.users.activeTechnicians}`,
      `services_approved,${data.services.approved}`,
      `services_pending,${data.services.pending}`,
      `bookings_total,${data.bookings.total}`,
      `bookings_completed,${data.bookings.completed}`,
      `bookings_cancelled,${data.bookings.cancelled}`,
    ];
    for (const bucket of data.payments.byCurrency) {
      lines.push(`revenue_${bucket.currency}_minor,${bucket.succeededMinor}`);
      lines.push(`net_${bucket.currency}_minor,${bucket.netMinor}`);
      lines.push(`refunds_${bucket.currency}_minor,${bucket.refundMinor}`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fixmate-analytics-${from}-to-${to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (state.phase === "loading") {
    return (
      <div role="status" aria-label="Loading analytics…" className="space-y-4">
        <span className="sr-only">Loading analytics…</span>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-surface" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-surface" />
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm font-medium text-error">{state.message}</p>
        <button
          type="button"
          onClick={() => void load({ from, to })}
          className="mt-4 cursor-pointer rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Try again
        </button>
      </div>
    );
  }

  const data = state.data;
  const currencyOptions = data.payments.byCurrency.map((bucket) => bucket.currency);
  const selectedCurrency = currency || currencyOptions[0] || "usd";
  const currencyBucket = data.payments.byCurrency.find((bucket) => bucket.currency === selectedCurrency);
  const refundsBucket = data.payments.totalRefundedMinorByCurrency.find((bucket) => bucket.currency === selectedCurrency);

  const bookingStatusChart = Object.entries(data.bookings.byStatus).map(([status, count]) => ({
    name: status,
    value: count,
  }));

  const revenueTrend = data.trends.revenuePerDay
    .filter((row) => row.currency === selectedCurrency)
    .map((row) => ({ date: row.date.slice(5), net: toMajor(row.netMinor, row.currency) }));

  const bookingTrend = data.trends.bookingsPerDay.map((row) => ({ date: row.date.slice(5), count: row.count }));

  return (
    <div className="flex flex-col gap-6">
      {/* Date-range toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-muted">
            From
            <input
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 block h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-accent-500 focus:outline-none"
            />
          </label>
          <label className="text-xs font-semibold text-muted">
            To
            <input
              type="date"
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 block h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-accent-500 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void load({ from, to })}
            className="h-10 cursor-pointer rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            Apply
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {currencyOptions.length > 0 && (
            <label className="text-xs font-semibold text-muted">
              Currency
              <select
                value={selectedCurrency}
                onChange={(event) => setCurrency(event.target.value)}
                className="mt-1 block h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-accent-500 focus:outline-none"
              >
                {currencyOptions.map((code) => (
                  <option key={code} value={code}>
                    {code.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={exportCsv}
            className="mt-auto inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-4 text-xs font-semibold text-heading transition-colors hover:bg-surface-muted"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></svg>
            CSV
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Users" value={data.users.total} hint={`${data.users.customers} customers · ${data.users.technicians} technicians`} />
        <KpiCard label="Active technicians" value={data.users.activeTechnicians} hint={`${data.users.busyTechnicians} busy`} />
        <KpiCard label="Approved services" value={data.services.approved} hint={`${data.services.pending} pending approval`} />
        <KpiCard label="Total bookings" value={data.bookings.total} hint={`${data.bookings.completed} completed`} />
        <KpiCard label="Completed" value={data.bookings.completed} hint={`${data.bookings.cancelled} cancelled`} />
        <KpiCard label="Coupon redemptions" value={data.coupons.redemptions} hint={data.coupons.discountMinorByCurrency.map((d) => `${formatMoney(d.discountMinor, d.currency)} off`).join(" · ") || "no discounts yet"} />
        <KpiCard label={`Collected (${selectedCurrency.toUpperCase()})`} value={currencyBucket ? formatMoney(currencyBucket.succeededMinor, selectedCurrency) : "—"} hint={`${currencyBucket?.succeededCount ?? 0} payments`} />
        <KpiCard label={`Net revenue (${selectedCurrency.toUpperCase()})`} value={currencyBucket ? formatMoney(currencyBucket.netMinor, selectedCurrency) : "—"} hint={`${refundsBucket ? formatMoney(refundsBucket.succeededMinor, selectedCurrency) : "0"} refunded`} />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 xl:grid-cols-5">
        {/* Revenue trend */}
        <section aria-labelledby="revenue-trend-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6 xl:col-span-3">
          <h2 id="revenue-trend-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
            Revenue trend ({selectedCurrency.toUpperCase()})
          </h2>
          {revenueTrend.length > 0 ? (
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f3a5f" opacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#93a7bf" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#93a7bf" }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip contentStyle={{ background: NAVY, border: `1px solid ${ACCENT}`, borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#f2f7fd" }} />
                  <Line type="monotone" dataKey="net" name="Net revenue" stroke={ACCENT} strokeWidth={2.5} dot={{ r: 2.5, fill: ACCENT }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-10 text-center text-sm text-muted">No revenue in this period yet.</p>
          )}
        </section>

        {/* Booking status donut */}
        <section aria-labelledby="booking-status-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6 xl:col-span-2">
          <h2 id="booking-status-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
            Bookings by status
          </h2>
          {bookingStatusChart.length > 0 ? (
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={bookingStatusChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {bookingStatusChart.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#38bdf8"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: NAVY, border: `1px solid ${ACCENT}`, borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-10 text-center text-sm text-muted">No bookings yet.</p>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* Booking trend */}
        <section aria-labelledby="booking-trend-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6 xl:col-span-3">
          <h2 id="booking-trend-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
            Bookings per day
          </h2>
          {bookingTrend.length > 0 ? (
            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bookingTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f3a5f" opacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#93a7bf" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#93a7bf" }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip cursor={{ fill: "#0ea5e9", fillOpacity: 0.08 }} contentStyle={{ background: NAVY, border: `1px solid ${ACCENT}`, borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="count" name="Bookings" fill={ACCENT} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-10 text-center text-sm text-muted">No bookings in this period.</p>
          )}
        </section>

        {/* Top technicians */}
        <section aria-labelledby="top-techs-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6 xl:col-span-2">
          <h2 id="top-techs-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
            Top technicians
          </h2>
          {data.technicianPerformance.length > 0 ? (
            <ol className="mt-3 divide-y divide-border">
              {data.technicianPerformance.map((tech, index) => (
                <li key={tech.technicianId} className="flex items-center gap-3 py-2.5">
                  <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-800 text-[11px] font-bold text-accent-400">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-heading">{tech.name}</span>
                    <span className="text-[10px] text-muted">
                      {tech.completed} {tech.completed === 1 ? "job" : "jobs"}
                      {tech.averageRating !== null ? ` · ★ ${tech.averageRating.toFixed(1)} (${tech.reviewCount})` : " · no reviews"}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-6 text-center text-sm text-muted">No completed jobs yet.</p>
          )}
        </section>
      </div>

      {/* Per-currency revenue table */}
      <section aria-labelledby="revenue-table-heading" className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
        <h2 id="revenue-table-heading" className="border-b border-border px-5 py-4 text-sm font-bold uppercase tracking-[0.14em] text-muted">
          Revenue by currency
        </h2>
        {data.payments.byCurrency.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">No payments in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted">
                  <th className="px-5 py-3">Currency</th>
                  <th className="px-5 py-3 text-right">Collected</th>
                  <th className="px-5 py-3 text-right">Refunds</th>
                  <th className="px-5 py-3 text-right">Net revenue</th>
                  <th className="px-5 py-3 text-right">Pending</th>
                  <th className="px-5 py-3 text-right">Failed</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.byCurrency.map((bucket) => (
                  <tr key={bucket.currency} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 font-bold uppercase text-heading">{bucket.currency}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground">{formatMoney(bucket.succeededMinor, bucket.currency)} <span className="text-muted">({bucket.succeededCount})</span></td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground">−{formatMoney(bucket.refundMinor, bucket.currency)} <span className="text-muted">({bucket.refundCount})</span></td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-heading">{formatMoney(bucket.netMinor, bucket.currency)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted">{formatMoney(bucket.pendingMinor, bucket.currency)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted">{bucket.failedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent activity */}
      <section aria-labelledby="recent-activity-heading" className="rounded-2xl border border-border bg-surface shadow-xs">
        <h2 id="recent-activity-heading" className="border-b border-border px-5 py-4 text-sm font-bold uppercase tracking-[0.14em] text-muted">
          Recent activity
        </h2>
        {data.recentActivity.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">No activity in this period.</p>
        ) : (
          <ol className="divide-y divide-border">
            {data.recentActivity.map((event, index) => (
              <li key={`${event.bookingId}-${index}`} className="flex items-center gap-3 px-5 py-3 text-xs">
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-accent-500" />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-heading">{event.type.replace(/_/g, " ")}</span>
                  {event.serviceTitle && <span className="text-muted"> · {event.serviceTitle}</span>}
                </span>
                <time dateTime={event.at} className="shrink-0 tabular-nums text-muted">
                  {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(event.at))}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
