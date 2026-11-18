"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import ServiceCard, { type ServiceCardData } from "@/components/services/ServiceCard";
import {
  SERVICE_CATEGORIES,
  ALL_SERVICE_CATEGORIES,
  normalizeCategoryInput,
} from "@/lib/service-categories";

/** Types mirror the public GET /api/services contract (no auth, JWT or
 *  ownership data): only approved + available services, projecting out
 *  technicianId, technicianEmail, rejectionReason. */

// Parse/accept every known category so legacy records are never hidden.
// The filter UI itself offers only the seven canonical assignment categories.
const CATEGORIES = ALL_SERVICE_CATEGORIES;

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
  /** Public display name of the assigned technician. */
  technicianName: string;
  /** Actual aggregated rating from stored booking reviews. */
  rating: ServiceCardData["rating"];
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

function parseRating(raw: unknown): PublicService["rating"] {
  if (!isRecord(raw)) {
    return { averageRating: null, reviewCount: 0 };
  }
  const reviewCount =
    typeof raw.reviewCount === "number" && Number.isFinite(raw.reviewCount) && raw.reviewCount >= 0
      ? Math.floor(raw.reviewCount)
      : 0;
  const averageRating =
    typeof raw.averageRating === "number" &&
    Number.isFinite(raw.averageRating) &&
    raw.averageRating >= 1 &&
    raw.averageRating <= 5
      ? raw.averageRating
      : null;
  return reviewCount > 0 && averageRating !== null
    ? { averageRating, reviewCount }
    : { averageRating: null, reviewCount: 0 };
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
    technicianName:
      typeof raw.technicianName === "string" && raw.technicianName.trim().length > 0
        ? raw.technicianName.trim()
        : "FixMate Technician",
    rating: parseRating(raw.rating),
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

/** Public endpoint â€” never sends credentials or a JWT. */

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
    // Handled below â€” a non-JSON error page or empty body.
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



const fieldClass =
  "h-12 w-full rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted transition-colors duration-200 hover:border-accent-500 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25";

function ServicesSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading servicesâ€¦"
      className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      <span className="sr-only">Loading servicesâ€¦</span>
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
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] active:bg-primary-hover cursor-pointer"
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
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] active:bg-primary-hover cursor-pointer"
      >
        Reset filters
      </button>
    </div>
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
  // A legacy alias from an old bookmark is normalised to its canonical value
  // so the dropdown and the API filter stay in sync.
  const validInitialCategory = normalizeCategoryInput(initialCategory);
  const validInitialSort = SORT_OPTIONS.some((option) => option.value === initialSort)
    ? (initialSort as SortOption)
    : "newest";

  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [category, setCategory] = useState<string>(validInitialCategory);
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
      category: normalizeCategoryInput(category) || "",
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
    setNearbyState(null);
  }

  const isLoading = state.phase === "loading";
  const totalItems = state.phase === "success" ? state.data.pagination.totalItems : null;
  const [locating, setLocating] = useState(false);
  const [nearbyState, setNearbyState] = useState<
    { items: PublicService[]; meta: { sort: string } } | null
  >(null);

  // Nearby services: only with explicit user consent via the button below —
  // coordinates never leave the device except to the FixMate API, and the
  // API never returns raw coordinates to anyone.
  async function handleNearMe() {
    if (locating) return;
    if (!("geolocation" in navigator)) {
      toast.error("Your browser can't share your location. Try the Location search instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude.toFixed(5);
          const lng = position.coords.longitude.toFixed(5);
          const response = await fetch(
            `${API_BASE}/api/services/nearby?lat=${lat}&lng=${lng}&limit=12`,
            { headers: { accept: "application/json" } }
          );
          const body = (await response.json().catch(() => null)) as {
            success?: boolean;
            data?: unknown[];
            meta?: { sort?: string };
            message?: string;
          } | null;
          if (!response.ok || body?.success !== true || !Array.isArray(body.data)) {
            toast.error(body?.message ?? "Could not load nearby services.");
            return;
          }
          const items = (body.data as unknown[])
            .map((raw) => {
              try {
                return parseService(raw);
              } catch {
                return null;
              }
            })
            .filter((service): service is PublicService => service !== null);
          setNearbyState({ items, meta: { sort: body.meta?.sort ?? "distance" } });
          if (items.length === 0) {
            toast("No services near you yet — try the area search above.");
          }
        } catch {
          toast.error("Could not load nearby services. Please try again.");
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        toast.error(
          error.code === error.PERMISSION_DENIED
            ? "Location permission denied — use the Location search instead."
            : "Couldn't get your location. Use the Location search instead."
        );
      },
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  }

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
              placeholder="Search servicesâ€¦"
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
              className={`${fieldClass} appearance-none pl-4 pr-10 cursor-pointer ${category === "" ? "text-muted" : ""}`}
            >
              <option value="">All categories</option>
              {SERVICE_CATEGORIES.map((name) => (
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
              className={`${fieldClass} cursor-pointer`}
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
              className="h-12 flex-1 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted active:scale-[0.98] active:bg-surface-muted cursor-pointer"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={reload}
              disabled={isLoading}
              aria-label="Refresh services"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border-strong bg-surface text-muted transition-all duration-200 enabled:hover:bg-surface-muted enabled:hover:text-heading enabled:active:scale-95 enabled:active:bg-surface-muted enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
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

      {/* Nearby discovery — explicit opt-in only */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleNearMe()}
          disabled={locating}
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-accent-500/40 bg-accent-50 px-4 text-xs font-semibold text-accent-strong transition-all duration-200 hover:bg-accent-100 hover:shadow-xs active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 dark:border-accent-500/30 dark:bg-accent-400/10 dark:text-accent"
        >
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`h-[15px] w-[15px] ${locating ? "animate-ping" : ""}`}
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
          {locating ? "Locating…" : "Use my location for nearby services"}
        </button>
        {nearbyState && (
          <button
            type="button"
            onClick={() => setNearbyState(null)}
            className="inline-flex h-10 cursor-pointer items-center rounded-full border border-border px-4 text-xs font-semibold text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-heading"
          >
            Hide nearby results
          </button>
        )}
      </div>

      {nearbyState && (
        <section aria-label="Nearby services" className="mt-6">
          <p className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Nearest to you · {nearbyState.items.length} {nearbyState.items.length === 1 ? "service" : "services"} · sorted by distance
          </p>
          {nearbyState.items.length > 0 && (
            <ul className="mt-3 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {nearbyState.items.map((service) => (
                <li key={service._id} className="h-full">
                  <ServiceCard service={service} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted enabled:active:bg-surface-muted enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
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
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-heading transition-colors duration-200 enabled:hover:bg-surface-muted enabled:active:bg-surface-muted enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
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
