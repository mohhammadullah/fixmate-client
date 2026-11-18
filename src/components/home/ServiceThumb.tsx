"use client";

import { useState } from "react";

/**
 * Small real-photo thumbnail for the Popular Services list rows. Falls back
 * to a neutral wrench glyph when the remote image is missing or fails.
 */
export default function ServiceThumb({
  src,
  alt,
  className = "",
  bare = false,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Render edge-to-edge without border/radius — e.g. full-bleed card media. */
  bare?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center ${
          bare
            ? "bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 text-accent-400/70"
            : "rounded-xl border border-accent-100 bg-accent-50 text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent"
        } ${className}`}
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote backend image URLs are not known at build time
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 object-cover ${
        bare ? "" : "rounded-xl border border-border-strong"
      } ${className}`}
    />
  );
}
