"use client";

import { useState } from "react";

/**
 * Service image for the popular-services spotlight card, with a wrench
 * glyph fallback when the remote image is missing or fails to load —
 * mirrors the onError fallback used across service cards.
 */
export default function PopularSpotlightImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-2xl border border-accent-500/20 bg-navy-950/60 ${className}`}
      >
        <svg
          viewBox="0 0 120 120"
          width="120"
          height="120"
          fill="none"
          stroke="#2fb8f5"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-80"
        >
          <circle cx="60" cy="60" r="46" strokeDasharray="5 7" opacity="0.55" />
          <path d="M74.5 44.2a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l4.6-4.6a7.3 7.3 0 0 1-9.7 9.7l-9.1 9a2.3 2.3 0 0 1-3.2-3.2l9-9.1a7.3 7.3 0 0 1 9.7-9.7l-4.7 4.8z" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- backend image URLs are remote and not known at build time, so next/image remotePatterns can't be configured.
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-2xl object-cover ring-1 ring-inset ring-accent-400/30 ${className}`}
    />
  );
}
