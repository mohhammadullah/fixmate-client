/**
 * Shared fallback for service imagery — a polished wrench-in-a-dashed-ring
 * on a navy gradient with a soft electric-blue glow. Used wherever a
 * service photo is missing or fails to load (cards, hero, dashboard grids)
 * so every surface degrades the same way.
 *
 * Decorative only: the surrounding <Link>/heading already names the
 * service, so the graphic is aria-hidden.
 */
export default function ServiceImageFallback() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center overflow-hidden bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950"
    >
      {/* Soft glow behind the glyph — depth without an image */}
      <div className="pointer-events-none absolute h-40 w-40 rounded-full bg-accent-500/15 blur-3xl" />
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-accent-400/40 bg-navy-800/50 sm:h-20 sm:w-20">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8 text-accent-400/80 sm:h-9 sm:w-9"
        >
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </span>
    </div>
  );
}
