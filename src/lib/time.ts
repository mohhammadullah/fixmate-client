const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** Short relative time like "5 minutes ago". Falls back to the ISO date on parse failure. */
export function formatRelativeTime(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  const diffMs = time - Date.now();
  const divisions: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let duration = diffMs / 1000;
  for (const [amount, unit] of divisions) {
    if (Math.abs(duration) < amount) {
      return relativeTimeFormatter.format(Math.round(duration), unit);
    }
    duration /= amount;
  }
  return "recently";
}

export function formatDateTime(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}
