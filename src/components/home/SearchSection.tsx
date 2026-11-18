"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  "Mobile Repair",
  "Laptop Repair",
  "Refrigerator Repair",
  "AC Repair",
  "TV Repair",
  "Home Appliance Repair",
] as const;

export default function SearchSection() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (category.trim()) params.set("category", category.trim());
    if (location.trim()) params.set("location", location.trim());

    const queryString = params.toString();
    router.push(queryString ? `/services?${queryString}` : "/services");
  }

  const fieldClass =
    "h-12 w-full rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted transition-colors duration-200 focus:border-accent-500";

  return (
    <section
      aria-labelledby="search-heading"
      className="relative overflow-x-clip border-t border-border"
    >
      {/* Ambient accent glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-64 w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-400/10 blur-3xl"
      />

      <div className="container-page relative py-14 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="search-heading"
            className="text-2xl font-extrabold tracking-tight text-heading sm:text-3xl"
          >
            Find the Right Repair Service
          </h2>
          <p className="mt-3 text-base text-muted">
            Search trusted technicians for your devices and home appliances.
          </p>
        </div>

        {/* Search panel */}
        <form
          onSubmit={handleSubmit}
          role="search"
          aria-label="Repair service search"
          className="mx-auto mt-8 max-w-5xl rounded-2xl border border-border bg-surface p-4 shadow-lg sm:mt-10 sm:p-6"
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
            <div className="relative md:col-span-2 lg:col-span-4">
              <label htmlFor="service-search" className="sr-only">
                What needs to be repaired?
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
                id="service-search"
                name="search"
                type="text"
                autoComplete="off"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="What needs to be repaired?"
                className={`${fieldClass} pl-11 pr-4`}
              />
            </div>

            <div className="relative lg:col-span-3">
              <label htmlFor="service-category" className="sr-only">
                Category
              </label>
              <select
                id="service-category"
                name="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className={`${fieldClass} appearance-none pl-4 pr-10 ${
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
              <label htmlFor="service-location" className="sr-only">
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
                id="service-location"
                name="location"
                type="text"
                autoComplete="off"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Enter your location"
                className={`${fieldClass} pl-11 pr-4`}
              />
            </div>

            <button
              type="submit"
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md md:col-span-2 lg:col-span-3"
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
              Search Services
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
