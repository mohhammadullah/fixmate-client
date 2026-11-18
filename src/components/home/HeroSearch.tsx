"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Compact hero search — routes to the public Services listing with the
 * existing `search` query parameter, which ServicesListing already reads,
 * validates and applies. Empty queries go straight to /services.
 */
export default function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(
      trimmed ? `/services?search=${encodeURIComponent(trimmed)}` : "/services"
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Search repair services"
      className="mt-6 flex w-full max-w-lg items-center gap-1.5 rounded-2xl border border-white/10 bg-navy-900/70 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-colors focus-within:border-accent-500/60"
    >
      <label htmlFor="hero-service-search" className="sr-only">
        Search repair services
      </label>
      <span aria-hidden="true" className="pl-2.5 text-navy-100/50">
        <Search className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <input
        id="hero-service-search"
        name="search"
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search repair services, devices, appliances…"
        className="h-10 min-w-0 flex-1 border-0 bg-transparent text-sm text-white placeholder:text-navy-100/40 focus:outline-none"
      />
      <button
        type="submit"
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-accent-500 px-3.5 text-[13px] font-bold tracking-wide text-navy-950 transition-colors duration-200 hover:bg-accent-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 sm:px-5"
      >
        <span className="hidden sm:inline">Search</span>
        <Search className="h-4 w-4 sm:hidden" strokeWidth={2.4} aria-hidden="true" />
      </button>
    </form>
  );
}
