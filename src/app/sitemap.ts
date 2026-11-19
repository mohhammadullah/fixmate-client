import type { MetadataRoute } from "next";

const PUBLIC_PATHS = [
  "/",
  "/about",
  "/services",
  "/reviews",
  "/privacy",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!rawSiteUrl) return [];

  let base: URL;
  try {
    base = new URL(rawSiteUrl);
    if (base.protocol !== "https:" && base.protocol !== "http:") return [];
  } catch {
    return [];
  }

  const lastModified = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: new URL(path, base).toString(),
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/services" ? 0.9 : 0.7,
  }));
}
