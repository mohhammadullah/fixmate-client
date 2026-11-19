export default function RootLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading page" className="container-page py-16">
      <span className="sr-only">Loading…</span>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-8 w-2/3 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-surface-muted" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-surface-muted" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="h-32 animate-pulse rounded-2xl border border-border bg-surface" />
          <div className="h-32 animate-pulse rounded-2xl border border-border bg-surface" />
        </div>
      </div>
    </div>
  );
}
