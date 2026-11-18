"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Types mirror the public GET /api/services contract (no auth, JWT or
 *  ownership data): only approved + available services, projecting out
 *  technicianId, technicianEmail, rejectionReason. */

const CATEGORIES = [
  "Mobile Repair",
  "Laptop Repair",
  "Refrigerator Repair",
  "AC Repair",
  "TV Repair",
  "Home Appliance Repair",
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]["value"];

interface PublicService {
  _id: string;
  title: string;
  category: (typeof CATEGORIES)[number];
  location: string;
  image: string;
  hourlyRate: number;
  securityDeposit: number;
  maxCapacity: number;
  amenities: string[];
  overview: string;
  createdAt: string;
  updatedAt: string;
}

interface ServicesPagination {
  currentPage: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface ServicesPageData {
  items: PublicService[];
  pagination: ServicesPagination;
}

type ServicesErrorKind = "network" | "server" | "parse";

class ServicesError extends Error {
  readonly kind: ServicesErrorKind;
  constructor(kind: ServicesErrorKind, message: string) {
    super(message);
    this.name = "ServicesError";
    this.kind = kind;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 350;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ServicesError("parse", "The server returned an unexpected service payload.");
  }
  return value;
}

function requiredFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ServicesError("parse", "The server returned an unexpected service payload.");
  }
  return value;
}

function parseService(raw: unknown): PublicService {
  if (!isRecord(raw)) {
    throw new ServicesError("parse", "The server returned an unexpected service payload.");
  }
  const category = raw.category;
  if (
    typeof category !== "string" ||
    !CATEGORIES.some((allowed) => allowed === category)
  ) {
    throw new ServicesError("parse", "The server returned an unknown service category.");
  }
  return {
    _id: requiredString(raw, "_id"),
    title: requiredString(raw, "title"),
    category: category as (typeof CATEGORIES)[number],
    location: requiredString(raw, "location"),
    image: typeof raw.image === "string" ? raw.image : "",
    hourlyRate: requiredFiniteNumber(raw, "hourlyRate"),
    securityDeposit:
      typeof raw.securityDeposit === "number" && Number.isFinite(raw.securityDeposit)
        ? raw.securityDeposit
        : 0,
    maxCapacity: requiredFiniteNumber(raw, "maxCapacity"),
    amenities: Array.isArray(raw.amenities)
      ? raw.amenities.filter((item): item is string => typeof item === "string")
      : [],
    overview: typeof raw.overview === "string" ? raw.overview : "",
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function parsePagination(raw: unknown): ServicesPagination {
  if (!isRecord(raw)) {
    throw new ServicesError("parse", "The server returned an unexpected pagination payload.");
  }
  const currentPage = requiredFiniteNumber(raw, "currentPage");
  const limit = requiredFiniteNumber(raw, "limit");
  const totalItems = requiredFiniteNumber(raw, "totalItems");
  const totalPages = requiredFiniteNumber(raw, "totalPages");
  if (typeof raw.hasNextPage !== "boolean" || typeof raw.hasPrevPage !== "boolean") {
    throw new ServicesError("parse", "The server returned an unexpected pagination payload.");
  }
  return {
    currentPage,
    limit,
    totalItems,
    totalPages,
    hasNextPage: raw.hasNextPage,
    hasPrevPage: raw.hasPrevPage,
  };
}

function parseServicesResponse(body: unknown): ServicesPageData {
  if (!isRecord(body)) {
    throw new ServicesError("parse", "The server returned an unexpected response.");
  }
  if (body.success !== true) {
    const message =
      typeof body.message === "string" && body.message.length > 0 && body.message.length <= 200
        ? body.message
        : "The server couldn't load services.";
    throw new ServicesError("server", message);
  }
  if (!Array.isArray(body.data)) {
    throw new ServicesError("parse", "The server returned an unexpected services payload.");
  }
  return {
    items: body.data.map(parseService),
    pagination: parsePagination(body.pagination),
  };
}

/** Public endpoint — never sends credentials or a JWT. */

interface FetchOptions {
  page: number;
  limit: number;
  search: string;
  category: string;
  location: string;
  minPrice: string;
  maxPrice: string;
  sort: SortOption;
  signal: AbortSignal;
}

async function fetchServices(options: FetchOptions): Promise<ServicesPageData> {
  const params = new URLSearchParams({
    page: String(options.page),
    limit: String(options.limit),
    sort: options.sort,
  });
  if (options.search) params.set("search", options.search);
  if (options.category) params.set("category", options.category);
  if (options.location) params.set("location", options.location);
  if (options.minPrice) params.set("minPrice", options.minPrice);
  if (options.maxPrice) params.set("maxPrice", options.maxPrice);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/services?${params.toString()}`, {
      method: "GET",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ServicesError(
      "network",
      "Couldn't reach the FixMate server. Check your connection and try again."
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Handled below — a non-JSON error page or empty body.
  }

  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.message === "string" && body.message.length <= 200
        ? body.message
        : "The server couldn't load services. Please try again.";
    throw new ServicesError("server", message);
  }

  return parseServicesResponse(body);
}


function getPriceError(minPrice: string, maxPrice: string): string | null {
  for (const [label, value] of [
    ["Minimum price", minPrice],
    ["Maximum price", maxPrice],
  ] as const) {
    if (value.trim() === "") continue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return `${label} must be a number of 0 or more.`;
    }
  }
  if (
    minPrice.trim() !== "" &&
    maxPrice.trim() !== "" &&
    Number(minPrice) > Number(maxPrice)
  ) {
    return "Minimum price must not exceed maximum price.";
  }
  return null;
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}


const fieldClass =
  "h-12 w-full rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25";

function ServicesSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading services…"
      className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      <span className="sr-only">Loading services…</span>
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs"
        >
          <div className="h-48 animate-pulse bg-surface-muted" />
          <div className="space-y-3 p-5">
            <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-surface-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-muted" />
            <div className="h-8 w-28 animate-pulse rounded-full bg-surface-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorPanel({ error, onRetry }: { error: ServicesError; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto mt-10 max-w-xl rounded-2xl border border-error/40 bg-error-soft/60 px-6 py-10 text-center"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mx-auto h-9 w-9 text-error"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <h2 className="mt-3 text-lg font-bold text-heading">Couldn&apos;t load services</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
        {error.message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md"
      >
        Try again
      </button>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-dashed border-border-strong bg-surface/60 px-6 py-14 text-center shadow-xs">
      <div
        aria-hidden="true"
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-accent-100 bg-accent-50 text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <h2 className="mt-5 text-lg font-extrabold tracking-tight text-heading sm:text-xl">
        No services match your search
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
        Try a different search term, category or price range. New approved
        services appear here as technicians publish them.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md"
      >
        Reset filters
      </button>
    </div>
  );
}

function ServiceCard({ service }: { service: PublicService }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = service.image.length > 0 && !imageFailed;
  const shownAmenities = service.amenities.slice(0, 3);
  const hiddenAmenities = service.amenities.length - shownAmenities.length;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative h-48 w-full overflow-hidden bg-navy-900">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- backend image URLs are remote and not known at build time, so next/image remotePatterns can't be configured.
          <img
            src={service.image}
            alt={service.title}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-12 w-12 text-accent-400/60"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-navy-950/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-100 backdrop-blur-sm">
          {service.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-bold leading-snug text-heading sm:text-lg">
          {service.title}
        </h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0"
          >
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="min-w-0 truncate">{service.location}</span>
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-border py-3.5 text-xs">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Hourly rate
            </dt>
            <dd className="mt-0.5 text-sm font-bold tabular-nums text-heading">
              {formatAmount(service.hourlyRate)}
              <span className="ml-1 text-[11px] font-medium text-muted">/hr</span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Max capacity
            </dt>
            <dd className="mt-0.5 text-sm font-bold tabular-nums text-heading">
              {service.maxCapacity}
            </dd>
          </div>
        </dl>

        {service.amenities.length > 0 && (
          <ul aria-label="Amenities" className="mt-3 flex flex-wrap gap-1.5">
            {shownAmenities.map((amenity) => (
              <li
                key={amenity}
                className="rounded-full border border-border-strong bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-foreground"
              >
                {amenity}
              </li>
            ))}
            {hiddenAmenities > 0 && (
              <li
                title={service.amenities.join(", ")}
                className="rounded-full border border-border-strong bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted"
              >
                +{hiddenAmenities} more
              </li>
            )}
          </ul>
        )}

        <Link
          href={`/services/${service._id}`}
          aria-label={`View details for ${service.title}`}
          className="mt-auto inline-flex w-fit items-center gap-2 pt-5 text-xs font-semibold text-accent-strong transition-colors duration-200 hover:text-accent-600 dark:text-accent dark:hover:text-accent-400"
        >
          View Details
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-3.5 w-3.5"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </article>
  );
}


export interface ServicesListingProps {
  initialSearch?: string;
  initialCategory?: string;
  initialLocation?: string;
  initialMinPrice?: string;
  initialMaxPrice?: string;
  initialSort?: string;
}

export default function ServicesListing({
  initialSearch = "",
  initialCategory = "",
  initialLocation = "",
  initialMinPrice = "",
  initialMaxPrice = "",
  initialSort = "newest",
}: ServicesListingProps) {
  const validInitialCategory = CATEGORIES.some((value) => value === initialCategory)
    ? initialCategory
    : "";
  const validInitialSort = SORT_OPTIONS.some((option) => option.value === initialSort)
    ? (initialSort as SortOption)
    : "newest";

  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [category, setCategory] = useState(validInitialCategory);
  const [location, setLocation] = useState(initialLocation);
  const [minPrice, setMinPrice] = useState(initialMinPrice);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);
  const [sort, setSort] = useState<SortOption>(validInitialSort);
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: ServicesError }
    | { phase: "success"; data: ServicesPageData }
  >({ phase: "loading" });

  const priceError = getPriceError(minPrice, maxPrice);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    // Invalid price input is surfaced inline; don't send an invalid query.
    if (priceError) return;

    const controller = new AbortController();
    let cancelled = false;

    fetchServices({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch,
      category,
      location: location.trim(),
      minPrice: minPrice.trim(),
      maxPrice: maxPrice.trim(),
      sort,
      signal: controller.signal,
    })
      .then((data) => {
        if (cancelled) return;
        setState({ phase: "success", data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof ServicesError) {
          setState({ phase: "error", error });
          return;
        }
        setState({
          phase: "error",
          error: new ServicesError(
            "server",
            "Something went wrong while loading services. Please try again."
          ),
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, debouncedSearch, category, location, minPrice, maxPrice, sort, reloadToken, priceError]);

  function beginLoading() {
    setState({ phase: "loading" });
  }

  function resetPage() {
    setPage(1);
  }

  function reload() {
    beginLoading();
    setReloadToken((token) => token + 1);
  }

  function resetFilters() {
    beginLoading();
    setSearch("");
    setDebouncedSearch("");
    setCategory("");
    setLocation("");
    setMinPrice("");
    setMaxPrice("");
    setSort("newest");
    setPage(1);
  }

  const isLoading = state.phase === "loading";
  const totalItems = state.phase === "success" ? state.data.pagination.totalItems : null;

  return (
    <div className="mx-auto mt-8 max-w-6xl lg:mt-10">
      <form
        role="search"
        aria-label="Filter repair services"
        onSubmit={(event) => event.preventDefault()}
        className="rounded-2xl border border-border bg-surface p-4 shadow-lg sm:p-6"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
          <div className="relative lg:col-span-4">
            <label htmlFor="public-service-search" className="sr-only">
              Search repair services
            </label>
            <svg
              viewBox="0 0 24 24"
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
              id="public-service-search"
              type="search"
              autoComplete="off"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              placeholder="Search services…"
              className={`${fieldClass} pl-11 pr-4`}
            />
          </div>

          <div className="relative lg:col-span-3">
            <label htmlFor="public-service-category" className="sr-only">
              Category
            </label>
            <select
              id="public-service-category"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                resetPage();
              }}
              className={`${fieldClass} appearance-none pl-4 pr-10 ${category === "" ? "text-muted" : ""}`}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 24 24"
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
            <label htmlFor="public-service-location" className="sr-only">
              Location
            </label>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <input
              id="public-service-location"
              type="text"
              autoComplete="off"
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                resetPage();
              }}
              placeholder="Location"
              className={`${fieldClass} pl-11 pr-4`}
            />
          </div>

          <div className="lg:col-span-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="public-service-min-price" className="sr-only">
                  Minimum hourly price
                </label>
                <input
                  id="public-service-min-price"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={minPrice}
                  onChange={(event) => {
                    setMinPrice(event.target.value);
                    resetPage();
                  }}
                  placeholder="Min /hr"
                  aria-invalid={Boolean(priceError) || undefined}
                  aria-describedby={priceError ? "public-service-price-error" : undefined}
                  className={`${fieldClass} px-3`}
                />
              </div>
              <div>
                <label htmlFor="public-service-max-price" className="sr-only">
                  Maximum hourly price
                </label>
                <input
                  id="public-service-max-price"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={maxPrice}
                  onChange={(event) => {
                    setMaxPrice(event.target.value);
                    resetPage();
                  }}
                  placeholder="Max /hr"
                  aria-invalid={Boolean(priceError) || undefined}
                  aria-describedby={priceError ? "public-service-price-error" : undefined}
                  className={`${fieldClass} px-3`}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <label htmlFor="public-service-sort" className="sr-only">
              Sort services
            </label>
            <select
              id="public-service-sort"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as SortOption);
                resetPage();
              }}
              className={fieldClass}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 md:col-span-2 lg:col-span-2">
            <button
              type="button"
              onClick={resetFilters}
              className="h-12 flex-1 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={reload}
              disabled={isLoading}
              aria-label="Refresh services"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border-strong bg-surface text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-heading disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`h-5 w-5 ${isLoading ? "animate-spin motion-reduce:animate-none" : ""}`}
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
              </svg>
            </button>
          </div>
        </div>
        {priceError && (
          <p id="public-service-price-error" role="alert" className="mt-3 text-xs font-medium text-error">
            {priceError}
          </p>
        )}
      </form>

      <div className="mt-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-xl font-extrabold tracking-tight text-heading sm:text-2xl">
          Available Repair Services
        </h2>
        {totalItems !== null && (
          <p role="status" className="text-xs font-medium tabular-nums text-muted sm:text-sm">
            {totalItems} {totalItems === 1 ? "service" : "services"}
          </p>
        )}
      </div>

      {state.phase === "loading" && <ServicesSkeleton />}
      {state.phase === "error" && <ErrorPanel error={state.error} onRetry={reload} />}
      {priceError && state.phase === "success" && (
        <p role="alert" className="mx-auto mt-6 max-w-xl text-center text-sm text-error">
          {priceError}
        </p>
      )}
      {state.phase === "success" && state.data.items.length === 0 && (
        <EmptyState onReset={resetFilters} />
      )}

      {state.phase === "success" && state.data.items.length > 0 && (
        <>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {state.data.items.map((service) => (
              <li key={service._id} className="h-full">
                <ServiceCard service={service} />
              </li>
            ))}
          </ul>

          <nav
            aria-label="Services pagination"
            className="mt-10 flex items-center justify-between gap-3 border-t border-border pt-6"
          >
            <button
              type="button"
              onClick={() => {
                beginLoading();
                setPage(Math.max(1, state.data.pagination.currentPage - 1));
              }}
              disabled={!state.data.pagination.hasPrevPage || isLoading}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d="M19 12H5M11 18l-6-6 6-6" />
              </svg>
              <span className="hidden sm:inline">Previous</span>
            </button>
            <p className="text-center text-xs font-medium tabular-nums text-muted sm:text-sm">
              Page{" "}
              <span className="font-semibold text-heading">
                {state.data.pagination.currentPage}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-heading">
                {Math.max(state.data.pagination.totalPages, 1)}
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                beginLoading();
                setPage(state.data.pagination.currentPage + 1);
              }}
              disabled={!state.data.pagination.hasNextPage || isLoading}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="hidden sm:inline">Next</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </nav>
        </>
      )}
    </div>
  );
}
