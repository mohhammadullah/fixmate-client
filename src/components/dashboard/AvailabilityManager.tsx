"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { API_BASE } from "@/lib/api";

/** Technician self-service availability editor (talks to the real API). */

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const COMMON_TIMEZONES = [
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Karachi",
  "Asia/Kathmandu",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
] as const;

interface WeeklyDay {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
  breakEnabled: boolean;
  breakStart: string;
  breakEnd: string;
}

const buildDefaultWeekly = (): WeeklyDay[] =>
  Array.from({ length: 7 }, (_, day) => ({
    day,
    enabled: day !== 0, // Mon–Sat by default
    start: "09:00",
    end: "18:00",
    breakEnabled: false,
    breakStart: "13:00",
    breakEnd: "14:00",
  }));

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export default function AvailabilityManager() {
  const [status, setStatus] = useState<"available" | "busy">("available");
  const [weekly, setWeekly] = useState<WeeklyDay[]>(buildDefaultWeekly());
  const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [newArea, setNewArea] = useState("");
  const [timezone, setTimezone] = useState("Asia/Dhaka");
  const [state, setState] = useState<"loading" | "ready" | "error" | "saving">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function fetchAccessToken(): Promise<string> {
    const response = await authClient.$fetch<{ token: string }>("/token", {
      method: "GET",
    });
    const token = (response.data as { token?: unknown } | null)?.token;
    if (typeof token !== "string" || !token) {
      throw new Error("Your session has expired. Sign in again.");
    }
    return token;
  }

  async function load() {
    setState("loading");
    setErrorMessage(null);
    try {
      const token = await fetchAccessToken();
      const response = await fetch(`${API_BASE}/api/users/me/availability`, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Could not load availability (${response.status}).`);
      }
      const body = (await response.json()) as {
        data?: {
          status?: "available" | "busy";
          weekly?: Array<{
            day: number;
            enabled: boolean;
            start: string;
            end: string;
            breaks?: Array<{ start: string; end: string }>;
          }>;
          unavailableDates?: string[];
          serviceAreas?: string[];
          timezone?: string;
        };
      };
      const data = body.data;
      if (data) {
        setStatus(data.status ?? "available");
        if (Array.isArray(data.weekly) && data.weekly.length === 7) {
          setWeekly(
            data.weekly.map((day) => {
              const firstBreak = day.breaks?.[0];
              return {
                day: day.day,
                enabled: day.enabled,
                start: day.start,
                end: day.end,
                breakEnabled: Boolean(firstBreak),
                breakStart: firstBreak?.start ?? "13:00",
                breakEnd: firstBreak?.end ?? "14:00",
              };
            })
          );
        }
        setUnavailableDates(data.unavailableDates ?? []);
        setServiceAreas(data.serviceAreas ?? []);
        setTimezone(data.timezone ?? "Asia/Dhaka");
      }
      setState("ready");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load your availability.");
      setState("error");
    }
  }

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const token = await fetchAccessToken();
        const response = await fetch(`${API_BASE}/api/users/me/availability`, {
          headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(`Could not load availability (${response.status}).`);
        }
        const body = (await response.json()) as {
          data?: {
            status?: "available" | "busy";
            weekly?: Array<{
              day: number;
              enabled: boolean;
              start: string;
              end: string;
              breaks?: Array<{ start: string; end: string }>;
            }>;
            unavailableDates?: string[];
            serviceAreas?: string[];
            timezone?: string;
          };
        };
        if (cancelled) return;
        const data = body.data;
        if (data) {
          setStatus(data.status ?? "available");
          if (Array.isArray(data.weekly) && data.weekly.length === 7) {
            setWeekly(
              data.weekly.map((day) => {
                const firstBreak = day.breaks?.[0];
                return {
                  day: day.day,
                  enabled: day.enabled,
                  start: day.start,
                  end: day.end,
                  breakEnabled: Boolean(firstBreak),
                  breakStart: firstBreak?.start ?? "13:00",
                  breakEnd: firstBreak?.end ?? "14:00",
                };
              })
            );
          }
          setUnavailableDates(data.unavailableDates ?? []);
          setServiceAreas(data.serviceAreas ?? []);
          setTimezone(data.timezone ?? "Asia/Dhaka");
        }
        setState("ready");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : "Could not load your availability.");
        setState("error");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  function validateClient(): string | null {
    for (const day of weekly) {
      if (!day.enabled) continue;
      if (minutesOf(day.start) >= minutesOf(day.end)) {
        return `${DAY_LABELS[day.day]}: start must be before end.`;
      }
      if (day.breakEnabled) {
        if (minutesOf(day.breakStart) >= minutesOf(day.breakEnd)) {
          return `${DAY_LABELS[day.day]}: break start must be before break end.`;
        }
        if (minutesOf(day.breakStart) < minutesOf(day.start) || minutesOf(day.breakEnd) > minutesOf(day.end)) {
          return `${DAY_LABELS[day.day]}: break must fall inside working hours.`;
        }
      }
    }
    return null;
  }

  async function handleSave() {
    if (state === "saving") return;
    const validation = validateClient();
    if (validation) {
      toast.error(validation);
      return;
    }
    setState("saving");
    setErrorMessage(null);

    try {
      const token = await fetchAccessToken();
      const response = await fetch(`${API_BASE}/api/users/me/availability`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          status,
          weekly: weekly.map((day) => ({
            day: day.day,
            enabled: day.enabled,
            start: day.start,
            end: day.end,
            breaks: day.breakEnabled
              ? [{ start: day.breakStart, end: day.breakEnd }]
              : [],
          })),
          unavailableDates,
          serviceAreas,
          timezone,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
        errors?: Array<{ message?: string }>;
      } | null;

      if (!response.ok) {
        const detail = body?.errors?.map((entry) => entry.message).filter(Boolean).join(" ") ?? body?.message;
        toast.error(detail ?? `Could not save availability (${response.status}).`);
        setState("ready");
        return;
      }
      toast.success("Availability saved — customers can now see your open slots.");
      setState("ready");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save availability.");
      setState("ready");
    }
  }

  if (state === "loading") {
    return (
      <div role="status" aria-label="Loading availability…" className="space-y-6">
        <span className="sr-only">Loading availability…</span>
        <div className="h-24 animate-pulse rounded-2xl bg-surface-muted/70" />
        <div className="space-y-3">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-muted/60" />
          ))}
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
        <h2 className="text-base font-bold text-heading">Couldn&apos;t load your availability</h2>
        <p className="mt-1.5 text-sm text-muted">{errorMessage}</p>
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

  return (
    <div className="space-y-6">
      {/* Availability status */}
      <section aria-labelledby="availability-status-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
        <h2 id="availability-status-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
          Booking availability
        </h2>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Availability status">
          {(["available", "busy"] as const).map((value) => {
            const active = status === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setStatus(value)}
                className={`cursor-pointer rounded-xl border px-5 py-3 text-left transition-all duration-200 ${
                  active
                    ? value === "available"
                      ? "border-success/50 bg-success-soft text-success shadow-xs"
                      : "border-warning/50 bg-warning-soft text-warning shadow-xs"
                    : "border-border bg-background text-foreground hover:border-border-strong"
                }`}
              >
                <span className="block text-sm font-bold">{value === "available" ? "Available for bookings" : "Busy — not accepting bookings"}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {value === "available"
                    ? "New booking requests can be sent to you."
                    : "Customers will not be able to book you until you switch back."}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Weekly schedule */}
      <section aria-labelledby="weekly-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="weekly-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
              Weekly working hours
            </h2>
            <p className="mt-1 text-xs text-muted">Times are in your selected timezone ({timezone}).</p>
          </div>
          <label className="text-xs font-semibold text-muted">
            Timezone
            <select
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="mt-1 block h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-accent-500 focus:outline-none"
            >
              {COMMON_TIMEZONES.includes(timezone as (typeof COMMON_TIMEZONES)[number]) || !timezone ? null : (
                <option value={timezone}>{timezone}</option>
              )}
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </label>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {weekly.map((day) => (
            <li key={day.day} className="rounded-xl border border-border bg-background p-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex min-w-28 cursor-pointer items-center gap-2 text-sm font-semibold text-heading">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(event) =>
                      setWeekly((current) =>
                        current.map((entry) =>
                          entry.day === day.day ? { ...entry, enabled: event.target.checked } : entry
                        )
                      )
                    }
                    className="h-4 w-4 accent-[#0ea5e9]"
                  />
                  {DAY_LABELS[day.day]}
                </label>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  From
                  <input
                    type="time"
                    value={day.start}
                    disabled={!day.enabled}
                    onChange={(event) =>
                      setWeekly((current) =>
                        current.map((entry) =>
                          entry.day === day.day ? { ...entry, start: event.target.value } : entry
                        )
                      )
                    }
                    className="mt-0.5 block h-9 rounded-lg border border-border bg-surface px-2 text-xs disabled:opacity-40"
                  />
                </label>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Until
                  <input
                    type="time"
                    value={day.end}
                    disabled={!day.enabled}
                    onChange={(event) =>
                      setWeekly((current) =>
                        current.map((entry) =>
                          entry.day === day.day ? { ...entry, end: event.target.value } : entry
                        )
                      )
                    }
                    className="mt-0.5 block h-9 rounded-lg border border-border bg-surface px-2 text-xs disabled:opacity-40"
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted">
                  <input
                    type="checkbox"
                    checked={day.breakEnabled}
                    disabled={!day.enabled}
                    onChange={(event) =>
                      setWeekly((current) =>
                        current.map((entry) =>
                          entry.day === day.day ? { ...entry, breakEnabled: event.target.checked } : entry
                        )
                      )
                    }
                    className="h-3.5 w-3.5 accent-[#0ea5e9] disabled:opacity-40"
                  />
                  Break
                </label>
                {day.breakEnabled && (
                  <>
                    <input
                      type="time"
                      value={day.breakStart}
                      disabled={!day.enabled}
                      onChange={(event) =>
                        setWeekly((current) =>
                          current.map((entry) =>
                            entry.day === day.day ? { ...entry, breakStart: event.target.value } : entry
                          )
                        )
                      }
                      aria-label={`${DAY_LABELS[day.day]} break start`}
                      className="h-9 rounded-lg border border-border bg-surface px-2 text-xs disabled:opacity-40"
                    />
                    <input
                      type="time"
                      value={day.breakEnd}
                      disabled={!day.enabled}
                      onChange={(event) =>
                        setWeekly((current) =>
                          current.map((entry) =>
                            entry.day === day.day ? { ...entry, breakEnd: event.target.value } : entry
                          )
                        )
                      }
                      aria-label={`${DAY_LABELS[day.day]} break end`}
                      className="h-9 rounded-lg border border-border bg-surface px-2 text-xs disabled:opacity-40"
                    />
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Unavailable dates */}
        <section aria-labelledby="unavailable-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <h2 id="unavailable-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
            Dates off
          </h2>
          <p className="mt-1 text-xs text-muted">Full-day closures — holidays, travel, off days.</p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!newDate) return;
              setUnavailableDates((current) =>
                current.includes(newDate) || current.length >= 60 ? current : [...current, newDate].sort()
              );
              setNewDate("");
            }}
          >
            <input
              type="date"
              value={newDate}
              onChange={(event) => setNewDate(event.target.value)}
              aria-label="Add an unavailable date"
              className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-accent-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newDate || unavailableDates.length >= 60}
              className="h-10 cursor-pointer rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </button>
          </form>
          {unavailableDates.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {unavailableDates.map((date) => (
                <li key={date} className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-muted px-3 py-1 text-xs font-medium text-foreground">
                  {date}
                  <button
                    type="button"
                    onClick={() => setUnavailableDates((current) => current.filter((d) => d !== date))}
                    aria-label={`Remove ${date}`}
                    className="cursor-pointer rounded-full text-muted transition-colors hover:text-error"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted">No dates off scheduled.</p>
          )}
        </section>

        {/* Service areas */}
        <section aria-labelledby="areas-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <h2 id="areas-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
            Service areas
          </h2>
          <p className="mt-1 text-xs text-muted">Neighborhoods or districts you cover, e.g. &ldquo;Dhanmondi&rdquo;.</p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = newArea.trim();
              if (trimmed.length < 2) return;
              setServiceAreas((current) =>
                current.includes(trimmed) || current.length >= 10 ? current : [...current, trimmed]
              );
              setNewArea("");
            }}
          >
            <input
              type="text"
              value={newArea}
              maxLength={80}
              onChange={(event) => setNewArea(event.target.value)}
              placeholder="e.g. Dhanmondi, Khulna, Gulshan"
              aria-label="Add a service area"
              className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted focus:border-accent-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={newArea.trim().length < 2 || serviceAreas.length >= 10}
              className="h-10 cursor-pointer rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </button>
          </form>
          {serviceAreas.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {serviceAreas.map((area) => (
                <li key={area} className="inline-flex items-center gap-1.5 rounded-full border border-accent-100 bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent">
                  {area}
                  <button
                    type="button"
                    onClick={() => setServiceAreas((current) => current.filter((a) => a !== area))}
                    aria-label={`Remove ${area}`}
                    className="cursor-pointer text-accent-strong/70 transition-colors hover:text-error dark:text-accent"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted">No service areas yet — customers matching these will find you first.</p>
          )}
        </section>
      </div>

      {errorMessage && (
        <p role="alert" className="rounded-xl border border-error/40 bg-error-soft px-4 py-3 text-sm text-error">
          {errorMessage}
        </p>
      )}

      {/* Save */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-500/25 bg-accent-50/40 p-4 dark:bg-surface-muted/40 sm:p-5">
        <p className="max-w-md text-xs leading-5 text-muted">
          While you are <span className="font-semibold text-heading">Busy</span>, new booking requests for your services will be declined automatically with a clear message — even with open working hours. Flip to <span className="font-semibold text-heading">Available</span> to accept new work.
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={state === "saving"}
          className="cursor-pointer rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          {state === "saving" ? "Saving…" : "Save availability"}
        </button>
      </div>
    </div>
  );
}
