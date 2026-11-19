import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  let sitemap: string | undefined;
  if (rawSiteUrl) {
    try {
      const parsed = new URL(rawSiteUrl);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        sitemap = new URL("/sitemap.xml", parsed).toString();
      }
    } catch {
      sitemap = undefined;
    }
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/api/"],
      },
    ],
    ...(sitemap ? { sitemap } : {}),
  };
}
