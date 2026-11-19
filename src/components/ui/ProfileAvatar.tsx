"use client";

import { useState } from "react";
import { initialsFor } from "@/lib/initials";

/**
 * Shared circular profile avatar — the single avatar renderer for the
 * navbar, dashboard header, profile page and public review cards.
 *
 * - Renders the remote profile photo with `object-cover` and a face-friendly
 *   `object-position` (subjects in headshots sit in the upper third of the
 *   frame), so faces stay visible instead of being center-cropped away.
 * - Falls back to a polished initials-on-navy gradient avatar when there is
 *   no image, and again if the image fails to load (bad URL, expired host,
 *   network error). The fallback resets automatically if the image URL
 *   changes (e.g. a new photo is set after a failed load).
 * - `className` controls the outer size, text size and ring/border — callers
 *   keep their own documented sizes (h-9 w-9 navbar … h-28 w-28 profile).
 */
export interface ProfileAvatarProps {
  image?: string | null;
  name?: string | null;
  email?: string | null;
  /** Outer size + text size + ring/border classes. Must include h-* and w-*. */
  className?: string;
}

export default function ProfileAvatar({
  image,
  name,
  email,
  className = "h-9 w-9 text-[11px]",
}: ProfileAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const cleanImage = typeof image === "string" ? image.trim() : "";
  const showImage = cleanImage.length > 0 && !imageFailed;

  // A new image URL gets a fresh chance to load after a previous failure.
  // (Adjust state during render — no effect needed; see UserAvatarMenu.)
  const [lastImage, setLastImage] = useState(cleanImage);
  if (lastImage !== cleanImage) {
    setLastImage(cleanImage);
    setImageFailed(false);
  }

  const alt = name?.trim() ? `${name.trim()}'s profile photo` : "Profile photo";

  if (showImage) {
    return (
      <span
        className={`inline-flex shrink-0 overflow-hidden rounded-full bg-navy-800 ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- remote avatar hosts are not configured for next/image; referrer is withheld so Google-hosted avatars don't 403. */}
        <img
          src={cleanImage}
          alt={alt}
          referrerPolicy="no-referrer"
          decoding="async"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover object-[50%_30%]"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-navy-700 via-navy-800 to-navy-950 font-bold tracking-wide text-accent-400 ${className}`}
    >
      {initialsFor(name, email)}
    </span>
  );
}
