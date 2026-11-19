export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading dashboard content" className="px-4 py-6 sm:px-8 sm:py-8">
      <span className="sr-only">Loading dashboard content…</span>
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-muted" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} aria-hidden="true" className="h-28 animate-pulse rounded-2xl border border-border bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}
