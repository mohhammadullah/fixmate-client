import type { MetadataRoute } from "next";
import { API_BASE } from "@/lib/api";
import { absoluteUrl } from "@/lib/seo";

type PublicServiceSitemapEntry = {
  id: string;
  updatedAt?: string;
  createdAt?: string;
};

type ServicesApiResponse = {
  success?: unknown;
  data?: unknown;
  pagination?: {
    hasNextPage?: unknown;
    currentPage?: unknown;
    totalPages?: unknown;
  };
};

const STATIC_PUBLIC_PATHS: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/services", changeFrequency: "daily", priority: 0.9 },
  { path: "/reviews", changeFrequency: "weekly", priority: 0.8 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseServiceDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parsePublicService(raw: unknown): PublicServiceSitemapEntry | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw._id === "string" ? raw._id.trim() : "";
  if (!/^[0-9a-fA-F]{24}$/.test(id)) return null;

  const updatedAt =
    typeof raw.updatedAt === "string" && raw.updatedAt.trim()
      ? raw.updatedAt
      : undefined;
  const createdAt =
    typeof raw.createdAt === "string" && raw.createdAt.trim()
      ? raw.createdAt
      : undefined;

  return { id, updatedAt, createdAt };
}

async function fetchPublicServiceEntries(): Promise<PublicServiceSitemapEntry[]> {
  const entries: PublicServiceSitemapEntry[] = [];
  const seen = new Set<string>();
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage && page <= 20) {
    const params = new URLSearchParams({
      page: String(page),
      limit: "50",
      sort: "newest",
    });

    try {
      const response = await fetch(`${API_BASE}/api/services?${params.toString()}`, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) break;

      const body = (await response.json()) as ServicesApiResponse;
      if (body.success !== true || !Array.isArray(body.data)) break;

      for (const raw of body.data) {
        const parsed = parsePublicService(raw);
        if (!parsed || seen.has(parsed.id)) continue;
        seen.add(parsed.id);
        entries.push(parsed);
      }

      const pagination = isRecord(body.pagination) ? body.pagination : null;
      const next =
        pagination && typeof pagination.hasNextPage === "boolean"
          ? pagination.hasNextPage
          : false;
      hasNextPage = next;
      page += 1;
    } catch {
      break;
    }
  }

  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PUBLIC_PATHS.map((entry) => ({
    url: absoluteUrl(entry.path),
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));

  const services = await fetchPublicServiceEntries();
  const serviceEntries: MetadataRoute.Sitemap = services.map((service) => {
    const lastModified =
      parseServiceDate(service.updatedAt) ?? parseServiceDate(service.createdAt);
    return {
      url: absoluteUrl(`/services/${service.id}`),
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "weekly",
      priority: 0.8,
    };
  });

  return [...staticEntries, ...serviceEntries];
}
