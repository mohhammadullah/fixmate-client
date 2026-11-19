"use client";

export default function CurrentYear() {
  const year = String(new Date().getFullYear());

  return <span suppressHydrationWarning>{year}</span>;
}