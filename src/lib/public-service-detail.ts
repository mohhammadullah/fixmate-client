import { cache } from "react";
import { API_BASE } from "@/lib/api";
import { displayCategory } from "@/lib/service-categories";

export type PublicServiceDetail = {
  _id: string;
  title: string;
  category: string;
  description: string;
  overview: string;
  hourlyRate: number;
  securityDeposit: number;
  maxCapacity: number;
  location: string;
  image: string;
  amenities: string[];
  rating: {
    averageRating: number | null;
    reviewCount: number;
  };
  createdAt: string;
  updatedAt: string;
};

const OBJECT_ID_HEX = /^[0-9a-fA-F]{24}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseRating(raw: unknown): PublicServiceDetail["rating"] {
  if (!isRecord(raw)) return { averageRating: null, reviewCount: 0 };
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

function parseService(raw: unknown): PublicServiceDetail | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw._id);
  const title = asString(raw.title);
  const category = asString(raw.category);
  const location = asString(raw.location);
  if (!id || !title || !category || !location) return null;

  return {
    _id: id,
    title,
    category: displayCategory(category as never),
    description: asString(raw.description),
    overview: asString(raw.overview),
    hourlyRate: asFiniteNumber(raw.hourlyRate),
    securityDeposit: asFiniteNumber(raw.securityDeposit),
    maxCapacity: asFiniteNumber(raw.maxCapacity),
    location,
    image: asString(raw.image),
    amenities: Array.isArray(raw.amenities)
      ? raw.amenities.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    rating: parseRating(raw.rating),
    createdAt: asString(raw.createdAt),
    updatedAt: asString(raw.updatedAt),
  };
}

export type PublicServiceDetailResult = {
  service: PublicServiceDetail | null;
  notFound: boolean;
};

export const getPublicServiceDetail = cache(async function getPublicServiceDetail(
  serviceId: string,
): Promise<PublicServiceDetailResult> {
  if (!OBJECT_ID_HEX.test(serviceId)) {
    return { service: null, notFound: true };
  }

  try {
    const response = await fetch(`${API_BASE}/api/services/${encodeURIComponent(serviceId)}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (response.status === 404 || response.status === 400) {
      return { service: null, notFound: true };
    }
    if (!response.ok) {
      return { service: null, notFound: false };
    }
    const body: unknown = await response.json();
    if (!isRecord(body) || body.success !== true) {
      return { service: null, notFound: false };
    }
    const service = parseService(body.data);
    if (!service) return { service: null, notFound: false };
    return { service, notFound: false };
  } catch {
    return { service: null, notFound: false };
  }
});