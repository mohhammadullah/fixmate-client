"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { fetchServiceSuggestions, type ServiceSuggestion } from "@/lib/service-suggest";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

function formatHourlyRate(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

/** Wrap the case-insensitive query match in <mark> — plain string slicing, no regex. */
function HighlightedTitle({ title, query }: { title: string; query: string }) {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return <>{title}</>;
  const index = title.toLowerCase().indexOf(q);
  if (index < 0) return <>{title}</>;
  return (
    <>
      {title.slice(0, index)}
      <mark className="rounded-sm bg-accent-500/35 text-inherit">
        {title.slice(index, index + q.length)}
      </mark>
      {title.slice(index + q.length)}
    </>
  );
}

function WrenchGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

/**
 * Compact hero search — live suggestions from the public services API.
 * While typing, matching approved + available services appear in a dropdown
 * (debounced, keyboard-navigable). Picking one (click, ArrowDown+Enter, or
 * plain Enter when a result is highlighted) goes straight to the service
 * details page. Submitting without a selection routes to /services?search=…
 * so the listing can show every match. Empty queries go to /services.
 */
export default function HeroSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = "hero-service-suggestions";

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [suggestions, setSuggestions] = useState<ServiceSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmedQuery = query.trim();
  const showPanel = open && trimmedQuery.length >= MIN_QUERY_LENGTH;
  const activeId = activeIndex >= 0 && activeIndex < suggestions.length
    ? `hero-suggestion-${activeIndex}`
    : undefined;

  // Debounced live suggestions — one request in flight at a time. All state
  // transitions happen inside the debounce callback so the effect body
  // itself stays free of synchronous setState.
  useEffect(() => {
    const currentQuery = query.trim();
    const debounceMs = currentQuery.length < MIN_QUERY_LENGTH ? 0 : DEBOUNCE_MS;
    let cancelled = false;
    const controller = new AbortController();

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      if (currentQuery.length < MIN_QUERY_LENGTH) {
        setSuggestions([]);
        setLoading(false);
        setLoadFailed(false);
        setActiveIndex(-1);
        setOpen(false);
        return;
      }
      setOpen(true);
      setLoading(true);
      setLoadFailed(false);
      fetchServiceSuggestions(currentQuery, controller.signal)
        .then((results) => {
          if (cancelled) return;
          setSuggestions(results);
          setActiveIndex(-1);
          setLoading(false);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          if (error instanceof DOMException && error.name === "AbortError") return;
          setSuggestions([]);
          setActiveIndex(-1);
          setLoadFailed(true);
          setLoading(false);
        });
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  // Close the dropdown on outside pointer presses.
  useEffect(() => {
    if (!showPanel) return;
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [showPanel]);

  const goToSuggestion = useCallback(
    (suggestion: ServiceSuggestion) => {
      setOpen(false);
      setActiveIndex(-1);
      router.push(`/services/${suggestion.id}`);
    },
    [router]
  );

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    const hasSuggestions = suggestions.length > 0;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!hasSuggestions) return;
      event.preventDefault();
      setOpen(true);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = (activeIndex + delta + suggestions.length) % suggestions.length;
      setActiveIndex(next);
      document.getElementById(`hero-suggestion-${next}`)?.scrollIntoView({ block: "nearest" });
      return;
    }

    if (event.key === "Enter") {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        event.preventDefault();
        goToSuggestion(suggestions[activeIndex]);
        return;
      }
      if (hasSuggestions) {
        // No explicit selection — Enter takes the best (first, ranked) match.
        event.preventDefault();
        goToSuggestion(suggestions[0]);
        return;
      }
      // No matches — fall through to the normal form submit → /services?search=…
      return;
    }

    if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    // An explicitly highlighted suggestion wins on button click too.
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      goToSuggestion(suggestions[activeIndex]);
      return;
    }
    router.push(trimmed ? `/services?search=${encodeURIComponent(trimmed)}` : "/services");
  }

  return (
    <div
      ref={containerRef}
      className="relative mt-6 w-full max-w-lg"
      onKeyDown={(event) => {
        // Catch Escapes that bubble up from suggestion buttons too.
        if (event.key === "Escape") {
          setOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <form
        onSubmit={handleSubmit}
        role="search"
        aria-label="Search repair services"
        className="flex w-full items-center gap-1.5 rounded-2xl border border-white/10 bg-navy-900/70 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-colors focus-within:border-accent-500/60"
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
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0 && trimmedQuery.length >= MIN_QUERY_LENGTH) setOpen(true);
          }}
          placeholder="Search repair services, devices, appliances…"
          className="h-10 min-w-0 flex-1 border-0 bg-transparent text-sm text-white placeholder:text-navy-100/40 focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-accent-500 px-3.5 text-[13px] font-bold tracking-wide text-navy-950 transition-colors duration-200 hover:bg-accent-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 sm:px-5"
        >
          <span className="hidden sm:inline">Search</span>
          <Search className="h-4 w-4 sm:hidden" strokeWidth={2.4} aria-hidden="true" />
        </button>
      </form>

      {/* Live suggestions — approved + available public services only */}
      {showPanel && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Matching services"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto overscroll-contain rounded-2xl border border-navy-700 bg-navy-900/95 p-1.5 shadow-2xl backdrop-blur-md"
        >
          {loading ? (
            <div role="status" className="flex items-center gap-2.5 px-3 py-3.5 text-sm text-navy-100/70">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
              >
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.4" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
              Searching services…
            </div>
          ) : loadFailed ? (
            <div role="status" className="px-3 py-3.5 text-sm text-navy-100/70">
              Couldn&apos;t load suggestions right now.{" "}
              <span className="text-navy-100/50">Press Enter to browse all services.</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div role="status" className="px-3 py-4 text-center">
              <WrenchGlyph className="mx-auto h-6 w-6 text-navy-100/40" />
              <p className="mt-2 text-sm font-semibold text-white">No matching services found</p>
              <p className="mt-1 text-xs leading-5 text-navy-100/60">
                Nothing matches “{trimmedQuery}” yet.{" "}
                <span className="hidden sm:inline">Press Enter to browse all services.</span>
              </p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {suggestions.map((suggestion, index) => {
                const active = index === activeIndex;
                return (
                  <li key={suggestion.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      id={`hero-suggestion-${index}`}
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(-1)}
                      onClick={() => goToSuggestion(suggestion)}
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
                        active ? "bg-accent-500/15" : "bg-transparent"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-navy-800 text-accent-400"
                      >
                        <WrenchGlyph className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">
                          <HighlightedTitle title={suggestion.title} query={trimmedQuery} />
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-navy-100/55">
                          <span className="font-medium text-accent-400/90">{suggestion.category}</span>
                          {suggestion.location && <> · {suggestion.location}</>}
                        </span>
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] font-bold tabular-nums text-navy-100/70">
                        {formatHourlyRate(suggestion.hourlyRate)}
                        <span className="font-medium text-navy-100/40">/hr</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
