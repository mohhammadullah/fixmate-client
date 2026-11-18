"use client";

import { useState } from "react";
import { initialsFor } from "@/lib/initials";

/**
 * Avatar for a public customer review: the profile image when one is
 * available, otherwise a professional initials-based fallback. `name` is
 * the privacy-safe display name from the public review DTO.
 */
export default function ReviewAvatar({
  name,
  image,
}: {
  name: string;
  image: string | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  if (image && !imageFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote avatar hosts are not configured for next/image
      <img
        src={image}
        alt={`${name}'s profile photo`}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setImageFailed(true)}
        className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-inset ring-border-strong"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 select-none items-center justify-center rounded-full bg-navy-800 text-[11px] font-bold tracking-wide text-accent-400 ring-1 ring-inset ring-accent-400/30 dark:bg-navy-700 dark:text-accent-400"
    >
      {initialsFor(name)}
    </span>
  );
}
