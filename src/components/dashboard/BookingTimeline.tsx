export interface PublicTimelineEvent {
  type: string;
  at: string;
  by: string;
  note?: string;
}

const ORDER: Record<string, { dot: string; ring: string; label: string }> = {
  requested: { dot: "bg-accent-500", ring: "ring-accent-500/30", label: "Booking requested" },
  accepted: { dot: "bg-success", ring: "ring-success/30", label: "Technician accepted" },
  rejected: { dot: "bg-error", ring: "ring-error/30", label: "Technician declined" },
  cancelled: { dot: "bg-muted", ring: "ring-border", label: "Customer cancelled" },
  started: { dot: "bg-warning", ring: "ring-warning/30", label: "Work started" },
  completed: { dot: "bg-success", ring: "ring-success/30", label: "Work completed" },
  payment_confirmed: { dot: "bg-accent-500", ring: "ring-accent-500/30", label: "Payment confirmed" },
  refunded: { dot: "bg-warning", ring: "ring-warning/30", label: "Refund processed" },
  schedule_changed: { dot: "bg-accent-500", ring: "ring-accent-500/30", label: "Schedule changed" },
};

function formatEventDate(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

export default function BookingTimeline({
  events,
}: {
  events: PublicTimelineEvent[];
}) {
  if (!events || events.length === 0) {
    return (
      <p className="mt-3 text-sm leading-relaxed text-muted">
        No activity yet — the timeline is written automatically as things happen.
      </p>
    );
  }

  const sorted = [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  return (
    <ol className="mt-4 flex flex-col gap-0" aria-label="Booking timeline">
      {sorted.map((event, index) => {
        const meta = ORDER[event.type] ?? { dot: "bg-muted", ring: "ring-border", label: event.type };
        const isLast = index === sorted.length - 1;
        return (
          <li key={`${event.type}-${event.at}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ${meta.dot} ${meta.ring}`}
              />
              {!isLast && <span aria-hidden="true" className="my-1 w-px flex-1 bg-border" />}
            </div>
            <div className={`min-w-0 pb-4 ${isLast ? "" : ""}`}>
              <p className="text-sm font-semibold text-heading">{meta.label}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted">
                <time dateTime={event.at}>{formatEventDate(event.at)}</time>
                {" · "}
                {event.by === "customer" ? "Customer" : event.by === "technician" ? "Technician" : event.by === "admin" ? "Admin" : "System"}
              </p>
              {event.note && (
                <p className="mt-1 text-xs leading-5 text-muted">{event.note}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

