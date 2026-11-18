import { API_BASE } from "@/lib/api";
import type { ServiceCardData } from "@/components/services/ServiceCard";

/**
 * Shared access to the public services API (GET /api/services), which only
 * ever returns approved + available services and strips internal-only
 * fields. Used by the homepage service sections so they render identical,
 * consistent data. Lenient parsing: malformed records are skipped rather
 * than failing the whole grid/section.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

/** Lenient parse — returns null for malformed records instead of throwing. */
export function parseServiceSummary(raw: unknown): ServiceCardData | null {
  if (!isRecord(raw)) return null;

  const id = typeof raw._id === "string" && raw._id.trim() ? raw._id : null;
  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : null;
  const category = typeof raw.category === "string" && raw.category.trim() ? raw.category : null;
  const location =
    typeof raw.location === "string" && raw.location.trim() ? raw.location.trim() : null;
  const hourlyRate = raw.hourlyRate;
  const maxCapacity = raw.maxCapacity;

  if (
    !id ||
    !title ||
    !category ||
    !location ||
    typeof hourlyRate !== "number" ||
    !Number.isFinite(hourlyRate) ||
    typeof maxCapacity !== "number" ||
    !Number.isFinite(maxCapacity)
  ) {
    return null;
  }

  const ratingRaw = isRecord(raw.rating) ? raw.rating : {};
  const reviewCount = asCount(ratingRaw.reviewCount);
  const averageRating =
    typeof ratingRaw.averageRating === "number" &&
    Number.isFinite(ratingRaw.averageRating) &&
    ratingRaw.averageRating >= 1 &&
    ratingRaw.averageRating <= 5
      ? ratingRaw.averageRating
      : null;

  return {
    _id: id,
    title,
    category,
    location,
    image: typeof raw.image === "string" ? raw.image : "",
    hourlyRate,
    maxCapacity,
    amenities: Array.isArray(raw.amenities)
      ? raw.amenities.filter((item): item is string => typeof item === "string")
      : [],
    technicianName:
      typeof raw.technicianName === "string" && raw.technicianName.trim()
        ? raw.technicianName.trim()
        : "FixMate Technician",
    rating:
      reviewCount > 0 && averageRating !== null
        ? { averageRating, reviewCount }
        : { averageRating: null, reviewCount: 0 },
  };
}

export type FetchServicesResult =
  | { ok: true; services: ServiceCardData[] }
  | { ok: false };

/**
 * Fetch the newest approved + available services (public endpoint, no-store).
 * Never throws — failures degrade to `{ ok: false }` so callers can render
 * honest error states.
 */
export async function fetchNewestServices(limit: number): Promise<FetchServicesResult> {
  const safeLimit = Math.min(Math.max(Math.floor(limit) || 6, 1), 50);
  try {
    const response = await fetch(`${API_BASE}/api/services?limit=${safeLimit}&sort=newest`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return { ok: false };

    const body: unknown = await response.json();
    if (!isRecord(body) || body.success !== true || !Array.isArray(body.data)) {
      return { ok: false };
    }

    const services = body.data
      .map(parseServiceSummary)
      .filter((service): service is ServiceCardData => service !== null);

    return { ok: true, services };
  } catch {
    return { ok: false };
  }
}

/**
 * Order services by real popularity: most-reviewed first, then highest
 * average rating. Input order (newest-first) is kept for ties, so services
 * with no reviews yet stay in a stable, deterministic newest-first order.
 */
export function sortByPopularity<T extends ServiceCardData>(services: T[]): T[] {
  return [...services].sort((a, b) => {
    if (b.rating.reviewCount !== a.rating.reviewCount) {
      return b.rating.reviewCount - a.rating.reviewCount;
    }
    const aRating = a.rating.averageRating ?? -1;
    const bRating = b.rating.averageRating ?? -1;
    return bRating - aRating;
  });
}
