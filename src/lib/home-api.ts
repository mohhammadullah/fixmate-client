import { API_BASE } from "@/lib/api";

/**
 * Shared, typed access to the public home endpoints (GET /api/home/summary
 * and GET /api/home/popular-services) — no authentication, aggregate,
 * privacy-safe data only. Lenient parsing: malformed payloads degrade to
 * `{ ok: false }` (or skip the malformed entry) rather than throwing, so
 * the homepage always renders an honest state instead of a crash.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

/** A stored average rating is only meaningful inside 1..5 (one decimal). */
function asAverageRating(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 1 &&
    value <= 5
    ? Math.round(value * 10) / 10
    : null;
}

export interface HomeSummaryStats {
  /** Bookings with status "completed". */
  completedRepairs: number;
  /** Users with role "technician" and an approved technician application. */
  verifiedTechnicians: number;
  /** Every stored booking, regardless of status. */
  totalBookings: number;
  /** Mean of genuine 1–5 review ratings, one decimal; null when unrated. */
  averageRating: number | null;
  /** Number of genuine stored reviews behind averageRating. */
  totalReviews: number;
}

export type HomeSummaryResult =
  | { ok: true; stats: HomeSummaryStats }
  | { ok: false };

/**
 * Fetch the platform summary for the hero statistics panel (public endpoint,
 * no-store). Never throws.
 */
export async function fetchHomeSummary(): Promise<HomeSummaryResult> {
  try {
    const response = await fetch(`${API_BASE}/api/home/summary`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return { ok: false };

    const body: unknown = await response.json();
    if (!isRecord(body) || body.success !== true || !isRecord(body.data)) {
      return { ok: false };
    }
    const stats = isRecord(body.data.stats) ? body.data.stats : null;
    if (!stats) return { ok: false };

    const totalReviews = asCount(stats.totalReviews);
    return {
      ok: true,
      stats: {
        completedRepairs: asCount(stats.completedRepairs),
        verifiedTechnicians: asCount(stats.verifiedTechnicians),
        totalBookings: asCount(stats.totalBookings),
        totalReviews,
        // A rating with zero backing reviews is meaningless — render as null.
        averageRating: totalReviews > 0 ? asAverageRating(stats.averageRating) : null,
      },
    };
  } catch {
    return { ok: false };
  }
}

export interface PopularServiceCategory {
  /** Canonical category value (stored category for unmapped legacy data). */
  category: string;
  reviewCount: number;
  /** Mean of genuine 1–5 review ratings, one decimal. */
  averageRating: number;
}

export type PopularServicesResult =
  | { ok: true; categories: PopularServiceCategory[] }
  | { ok: false };

/**
 * Fetch the top service categories ranked by genuine review volume (public
 * endpoint, no-store). Malformed entries are skipped; the list is already
 * ranked and sliced to four by the server. Never throws.
 */
export async function fetchPopularServices(): Promise<PopularServicesResult> {
  try {
    const response = await fetch(`${API_BASE}/api/home/popular-services`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return { ok: false };

    const body: unknown = await response.json();
    if (!isRecord(body) || body.success !== true || !Array.isArray(body.data)) {
      return { ok: false };
    }

    const categories: PopularServiceCategory[] = [];
    for (const entry of body.data) {
      if (!isRecord(entry)) continue;
      const category =
        typeof entry.category === "string" && entry.category.trim().length > 0
          ? entry.category.trim()
          : null;
      const reviewCount = asCount(entry.reviewCount);
      const averageRating = asAverageRating(entry.averageRating);
      if (!category || reviewCount === 0 || averageRating === null) continue;
      categories.push({ category, reviewCount, averageRating });
    }

    return { ok: true, categories: categories.slice(0, 4) };
  } catch {
    return { ok: false };
  }
}
