"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { API_BASE } from "@/lib/api";

/**
 * Appointment date/slot picker for the booking form. Reads the assigned
 * technician's public availability (working hours, days off, busy slots)
 * and lets the customer pick a valid slot. Entirely optional — bookings
 * may be created without a schedule.
 */

export interface BookingScheduleValue {
  date: string; // YYYY-MM-DD
  slotStart: string; // HH:00
  timezone: string;
}

interface AvailabilityWeeklyDay {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
  breaks?: Array<{ start: string; end: string }>;
}

interface AvailabilityData {
  status: "available" | "busy";
  timezone: string;
  weekly: AvailabilityWeeklyDay[];
  unavailableDates: string[];
  bookedSlots?: string[];
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export default function BookingScheduleFields({
  serviceId,
  onChange,
  disabled,
}: {
  serviceId: string;
  onChange: (schedule: BookingScheduleValue | null) => void;
  disabled?: boolean;
}) {
  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka",
    []
  );

  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const timezone = availability?.timezone ?? browserTimezone;

  const fetchAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const response = await authClient.$fetch<{ token: string }>("/token", {
        method: "GET",
      });
      const token = (response.data as { token?: unknown } | null)?.token;
      return typeof token === "string" ? token : null;
    } catch {
      return null;
    }
  }, []);

  // Auto-load the technician's public working pattern — awaited before any
  // state update, so the mount effect stays side-effect clean.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const token = await fetchAccessToken();
      if (!token) {
        if (!cancelled) setMessage("Could not verify your session — scheduling disabled.");
        return;
      }
      try {
        const response = await fetch(
          `${API_BASE}/api/services/${encodeURIComponent(serviceId)}/availability`,
          { headers: { authorization: `Bearer ${token}`, accept: "application/json" } }
        );
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { data?: AvailabilityData };
        if (body.data && !cancelled) setAvailability(body.data);
      } catch {
        if (!cancelled) setMessage("Could not load this technician's availability. You can still book without a slot.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [serviceId, fetchAccessToken]);

  const dateConstraints = useMemo(() => {
    const today = new Date();
    const min = today.toISOString().slice(0, 10);
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 60);
    return { min, max: maxDate.toISOString().slice(0, 10) };
  }, []);

  // Compute open slots for a given date. Event-handler driven — no effects.
  const fetchSlotsForDay = useCallback(
    async (day: string) => {
      setSlot("");
      setSlots([]);
      setIsLoadingSlots(true);
      setMessage(null);
      onChange(null);

      const token = await fetchAccessToken();
      try {
        const response = token
          ? await fetch(
              `${API_BASE}/api/services/${encodeURIComponent(serviceId)}/availability?date=${encodeURIComponent(day)}`,
              { headers: { authorization: `Bearer ${token}`, accept: "application/json" } }
            )
          : null;
        const dayData: AvailabilityData | null =
          response && response.ok
            ? (((await response.json()) as { data?: AvailabilityData }).data ?? null)
            : null;
        if (dayData) {
          setAvailability((current) => ({ ...(current ?? { status: "available", timezone: browserTimezone, weekly: [], unavailableDates: [] }), ...dayData } as AvailabilityData));
        }

        const booked = new Set(dayData?.bookedSlots ?? []);
        // Compute this weekday's hourly slots from the weekly pattern.
        const parsed = new Date(`${day}T12:00:00Z`);
        const dayOfWeek = Number.isNaN(parsed.getTime()) ? -1 : parsed.getUTCDay();
        const weekly = dayData?.weekly ?? availability?.weekly ?? [];
        const dayConfig = weekly.find((entry) => entry.day === dayOfWeek);
        const onUnavailable = (dayData?.unavailableDates ?? availability?.unavailableDates ?? []).includes(day);
        const computed: string[] = [];
        if (dayConfig?.enabled && !onUnavailable) {
          for (let mins = toMinutes(dayConfig.start); mins + 60 <= toMinutes(dayConfig.end); mins += 60) {
            const h = String(Math.floor(mins / 60)).padStart(2, "0");
            const candidate = `${h}:00`;
            // Skip slots overlapping breaks.
            const overlapsBreak = (dayConfig.breaks ?? []).some((brk) => {
              const bStart = toMinutes(brk.start);
              const bEnd = toMinutes(brk.end);
              return bStart < mins + 60 && mins < bEnd;
            });
            if (!overlapsBreak && !booked.has(candidate)) {
              computed.push(candidate);
            }
          }
        }
        setSlots(computed);
      } catch {
        setMessage("Could not load slots. You can book without a slot.");
      } finally {
        setIsLoadingSlots(false);
      }
    },
    [serviceId, fetchAccessToken, availability, browserTimezone, onChange]
  );

  function handleDateChange(nextDate: string) {
    setDate(nextDate);
    if (nextDate) {
      void fetchSlotsForDay(nextDate);
    } else {
      setSlots([]);
      setSlot("");
      onChange(null);
    }
  }

  function handleSlotChange(nextSlot: string) {
    setSlot(nextSlot);
    if (date && nextSlot) {
      onChange({ date, slotStart: nextSlot, timezone });
    } else {
      onChange(null);
    }
  }

  if (availability?.status === "busy") {
    return (
      <div className="mt-3 rounded-xl border border-warning/40 bg-warning-soft/60 px-4 py-3 text-xs leading-relaxed text-warning" role="status">
        <span className="font-semibold">Technician is currently busy.</span> Booking requests will be declined — please try again later.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-background p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        Preferred appointment (optional)
      </p>

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-muted">
          Date
          <input
            type="date"
            value={date}
            min={dateConstraints.min}
            max={dateConstraints.max}
            disabled={disabled}
            onChange={(event) => handleDateChange(event.target.value)}
            className="mt-1 block h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25 disabled:opacity-60"
          />
        </label>
        <label className="text-xs font-semibold text-muted">
          Time slot{" "}
          {isLoadingSlots ? (
            <span className="font-normal normal-case text-accent-strong dark:text-accent">(loading…)</span>
          ) : null}
          <select
            value={slot}
            disabled={disabled || !date || isLoadingSlots}
            onChange={(event) => handleSlotChange(event.target.value)}
            className="mt-1 block h-11 w-full appearance-none rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25 disabled:opacity-60"
          >
            <option value="">
              {!date
                ? "Pick a date first"
                : isLoadingSlots
                  ? "Loading slots…"
                  : slots.length === 0
                    ? "No open slots that day"
                    : "Select a time"}
            </option>
            {slots.map((option) => (
              <option key={option} value={option}>
                {option} (60 min)
              </option>
            ))}
          </select>
        </label>
      </div>

      {message && (
        <p role="alert" className="mt-2 text-[11px] leading-4 text-warning">
          {message}
        </p>
      )}
      {!message && (
        <p className="mt-2 text-[11px] leading-4 text-muted">
          Times are {timezone}. The technician confirms the appointment when accepting your booking.
        </p>
      )}
    </div>
  );
}
