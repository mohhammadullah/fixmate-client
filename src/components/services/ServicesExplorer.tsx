"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";

const CATEGORIES = SERVICE_CATEGORIES;

type ServicesExplorerProps = {
  initialSearch: string;
  initialCategory: string;
  initialLocation: string;
};

const fieldClass =
  "h-12 w-full rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted transition-colors duration-200 hover:border-accent-500 focus:border-accent-500";

export default function ServicesExplorer({
  initialSearch,
  initialCategory,
  initialLocation,
}: ServicesExplorerProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [location, setLocation] = useState(initialLocation);

  const filtersActive =
    search.trim() !== "" || category !== "" || location.trim() !== "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Reflect the filters in the URL so the view can be shared/bookmarked.
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (category.trim()) params.set("category", category.trim());
    if (location.trim()) params.set("location", location.trim());
    const queryString = params.toString();
    router.replace(queryString ? `/services?${queryString}` : "/services", {
      scroll: false,
    });
  }

  function handleClearFilters() {
    setSearch("");
    setCategory("");
    setLocation("");
    router.replace("/services", { scroll: false });
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        role="search"
        aria-label="Filter repair services"
        className="mx-auto mt-8 max-w-5xl rounded-2xl border border-border bg-surface p-4 shadow-lg sm:mt-10 sm:p-6"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
          <div className="relative md:col-span-2 lg:col-span-4">
            <label htmlFor="services-filter-search" className="sr-only">
              Search repair services
            </label>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              id="services-filter-search"
              name="search"
              type="text"
              autoComplete="off"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search repair services..."
              className={`${fieldClass} pl-11 pr-4`}
            />
          </div>

          <div className="relative lg:col-span-3">
            <label htmlFor="services-filter-category" className="sr-only">
              Category
            </label>
            <select
              id="services-filter-category"
              name="category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={`${fieldClass} appearance-none pl-4 pr-10 cursor-pointer ${
                category === "" ? "text-muted" : ""
              }`}
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>

          <div className="relative lg:col-span-2">
            <label htmlFor="services-filter-location" className="sr-only">
              Location
            </label>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <input
              id="services-filter-location"
              name="location"
              type="text"
              autoComplete="off"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Enter your location"
              className={`${fieldClass} pl-11 pr-4`}
            />
          </div>

          <div className="flex gap-3 md:col-span-2 lg:col-span-3">
            <button
              type="submit"
              aria-label="Apply filters"
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] active:bg-primary-hover cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-[18px] w-[18px]"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span className="hidden sm:inline">Apply</span>
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted active:scale-[0.98] active:bg-surface-muted cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
              Clear Filters
            </button>
          </div>
        </div>
      </form>

      <div className="mx-auto mt-12 max-w-6xl lg:mt-16">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-xl font-extrabold tracking-tight text-heading sm:text-2xl">
            Available Repair Services
          </h2>
          {filtersActive && (
            <p className="text-xs font-medium text-muted" role="status">
              Filters applied — no matches yet
            </p>
          )}
        </div>

        {/* Empty state — no backend-connected services yet */}
        <div
          aria-labelledby="services-empty-heading"
          className="mt-5 rounded-2xl border border-dashed border-border-strong bg-surface/60 px-6 py-14 text-center shadow-xs sm:py-18"
        >
          <svg
            viewBox="0 0 200 140"
            width="200"
            height="140"
            role="img"
            aria-label="Illustration of a wrench and magnifying glass waiting for listed services"
            className="mx-auto h-32 w-auto"
            fill="none"
          >
            <circle
              cx="100"
              cy="64"
              r="52"
              stroke="var(--border-strong)"
              strokeWidth="1.5"
              strokeDasharray="5 6"
            />
            <circle cx="100" cy="64" r="34" fill="var(--surface-muted)" />
            <circle
              cx="94"
              cy="60"
              r="12"
              stroke="var(--color-accent-500)"
              strokeWidth="2.5"
            />
            <path
              d="m103 69 8 8"
              stroke="var(--color-accent-500)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M120 38a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
              stroke="var(--color-accent-400)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(6 6) scale(0.9)"
            />
          </svg>
          <h3
            id="services-empty-heading"
            className="mt-6 text-lg font-extrabold tracking-tight text-heading sm:text-xl"
          >
            Services Will Appear Here
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            Once technicians publish approved services, you will be able to
            explore and book them here.
          </p>
          {filtersActive && (
            <p className="mt-4 text-xs text-muted">
              You have filters applied — real services will respect them once
              they go live.{" "}
              <button
                type="button"
                onClick={handleClearFilters}
                className="font-semibold text-accent-strong underline-offset-2 hover:underline hover:text-accent-600 dark:text-accent dark:hover:text-accent-400 cursor-pointer"
              >
                Clear them now
              </button>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
