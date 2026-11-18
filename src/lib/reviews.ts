import { API_BASE } from "@/lib/api";

/**
 * Shared access to the public reviews API (GET /api/reviews), used by the
 * homepage testimonials slice and the full /reviews page. Only privacy-safe
 * public fields exist in this shape — no emails, phones, or internal ids.
 */

export interface CustomerReview {
  customer: { name: string; image: string | null };
  rating: number;
  comment: string;
  createdAt: string;
  service: { title: string; category: string };
  technician: { name: string };
}

export interface ReviewsPage {
  reviews: CustomerReview[];
  pagination: {
    currentPage: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Lenient parse — skips malformed reviews instead of failing the grid. */
export function parseReview(raw: unknown): CustomerReview | null {
  if (!isRecord(raw)) return null;

  const rating = raw.rating;
  const comment = raw.comment;
  const createdAt = raw.createdAt;
  const customer = isRecord(raw.customer) ? raw.customer : null;
  const service = isRecord(raw.service) ? raw.service : null;
  const technician = isRecord(raw.technician) ? raw.technician : null;

  if (
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    typeof comment !== "string" ||
    comment.trim().length === 0 ||
    typeof createdAt !== "string" ||
    Number.isNaN(Date.parse(createdAt)) ||
    !customer ||
    !service ||
    !technician
  ) {
    return null;
  }

  const customerName =
    typeof customer.name === "string" && customer.name.trim()
      ? customer.name.trim()
      : "FixMate Customer";

  return {
    customer: {
      name: customerName,
      image: typeof customer.image === "string" && customer.image.trim() ? customer.image : null,
    },
    rating,
    comment: comment.trim(),
    createdAt,
    service: {
      title:
        typeof service.title === "string" && service.title.trim()
          ? service.title.trim()
          : "Repair service",
      category:
        typeof service.category === "string" && service.category.trim()
          ? service.category.trim()
          : "Repair",
    },
    technician: {
      name:
        typeof technician.name === "string" && technician.name.trim()
          ? technician.name.trim()
          : "FixMate Technician",
    },
  };
}

/** Fetch a page of reviews. Never throws — degrade to `{ ok: false }`. */
export async function fetchReviews(
  page: number,
  limit: number
): Promise<{ ok: true; data: ReviewsPage } | { ok: false }> {
  try {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeLimit = Math.min(Math.max(Math.floor(limit) || 6, 1), 24);
    const response = await fetch(
      `${API_BASE}/api/reviews?page=${safePage}&limit=${safeLimit}`,
      {
        cache: "no-store",
        headers: { accept: "application/json" },
      }
    );
    if (!response.ok) return { ok: false };

    const body: unknown = await response.json();
    if (!isRecord(body) || body.success !== true || !Array.isArray(body.data)) {
      return { ok: false };
    }

    const reviews = body.data
      .map(parseReview)
      .filter((review): review is CustomerReview => review !== null);

    const pagination = isRecord(body.pagination) ? body.pagination : {};
    const totalItems =
      typeof pagination.totalItems === "number" && Number.isFinite(pagination.totalItems)
        ? pagination.totalItems
        : reviews.length;
    const totalPages =
      typeof pagination.totalPages === "number" && Number.isFinite(pagination.totalPages)
        ? pagination.totalPages
        : totalItems === 0
          ? 0
          : 1;
    const currentPage =
      typeof pagination.currentPage === "number" && Number.isFinite(pagination.currentPage)
        ? pagination.currentPage
        : safePage;

    return {
      ok: true,
      data: {
        reviews,
        pagination: {
          currentPage,
          limit: safeLimit,
          totalItems,
          totalPages,
          hasNextPage:
            typeof pagination.hasNextPage === "boolean"
              ? pagination.hasNextPage
              : currentPage < totalPages,
          hasPrevPage:
            typeof pagination.hasPrevPage === "boolean"
              ? pagination.hasPrevPage
              : currentPage > 1,
        },
      },
    };
  } catch {
    return { ok: false };
  }
}
