/**
 * Client-safe suggestion fetch for the homepage hero search.
 * Reuses the PUBLIC services endpoint (approved + available only, safe
 * projection — no owner/account data). Nothing here is server-only, so it
 * can be called from client components; every request is abortable.
 */

import { displayCategory } from "@/lib/service-categories";

export interface ServiceSuggestion {
  id: string;
  title: string;
  /** Canonical-ish display category (legacy aliases mapped where safe). */
  category: string;
  location: string;
  hourlyRate: number;
  rating: {
    averageRating: number | null;
    reviewCount: number;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const FETCH_LIMIT = 8;
const MAX_SUGGESTIONS = 6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSuggestion(raw: unknown): ServiceSuggestion | null {
  if (!isRecord(raw)) return null;
  const id = raw._id;
  const title = raw.title;
  if (typeof id !== "string" || id.length === 0) return null;
  if (typeof title !== "string" || title.trim().length === 0) return null;
  const hourlyRate = raw.hourlyRate;
  const rating = isRecord(raw.rating) ? raw.rating : null;
  const reviewCount =
    rating && typeof rating.reviewCount === "number" && Number.isFinite(rating.reviewCount) && rating.reviewCount >= 0
      ? Math.floor(rating.reviewCount)
      : 0;
  const averageRating =
    rating && typeof rating.averageRating === "number" && Number.isFinite(rating.averageRating) &&
    rating.averageRating >= 1 && rating.averageRating <= 5
      ? rating.averageRating
      : null;
  return {
    id,
    title: title.trim(),
    category:
      typeof raw.category === "string" && raw.category.trim().length > 0
        ? displayCategory(raw.category.trim())
        : "Service",
    location:
      typeof raw.location === "string" && raw.location.trim().length > 0 ? raw.location.trim() : "",
    hourlyRate:
      typeof hourlyRate === "number" && Number.isFinite(hourlyRate) && hourlyRate >= 0 ? hourlyRate : 0,
    rating: { averageRating: reviewCount > 0 ? averageRating : null, reviewCount },
  };
}

/**
 * Rank a suggestion against the query: title matches first, then category,
 * then location; ties break toward the shorter (more specific) title. The
 * API already regex-matches title/description/overview/location/category
 * case-insensitively, so an item that reaches this function is relevant —
 * this only orders the visible list.
 */
function scoreSuggestion(suggestion: ServiceSuggestion, query: string): number {
  const q = query.toLowerCase();
  const title = suggestion.title.toLowerCase();
  const category = suggestion.category.toLowerCase();
  const location = suggestion.location.toLowerCase();
  if (title.startsWith(q)) return 100;
  if (title.includes(q)) return 80;
  if (category.includes(q)) return 60;
  if (location.includes(q)) return 40;
  return 20; // matched description/overview only
}

export async function fetchServiceSuggestions(
  query: string,
  signal: AbortSignal
): Promise<ServiceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  // The server escapes the pattern — special characters are safe as-is.
  const params = new URLSearchParams({ search: trimmed, limit: String(FETCH_LIMIT), sort: "newest" });
  const response = await fetch(`${API_BASE}/api/services?${params.toString()}`, {
    method: "GET",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Suggestion request failed with status ${response.status}`);
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    throw new Error("Suggestion request returned an unreadable response");
  }
  if (!isRecord(body) || body.success !== true || !Array.isArray(body.data)) {
    return [];
  }
  return body.data
    .map(parseSuggestion)
    .filter((item): item is ServiceSuggestion => item !== null)
    .sort((a, b) => scoreSuggestion(b, trimmed) - scoreSuggestion(a, trimmed) || a.title.length - b.title.length)
    .slice(0, MAX_SUGGESTIONS);
}
