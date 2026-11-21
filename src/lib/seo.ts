import type { Metadata } from "next";

export const SITE_NAME = "FixMate";
export const PRODUCTION_SITE_URL = "https://fixmate-client-neon.vercel.app";
export const DEFAULT_OG_IMAGE_PATH = "/opengraph-image";

const DEFAULT_DESCRIPTION =
  "FixMate helps you discover and book verified technicians for smartphone, laptop, and home appliance repairs with transparent pricing and genuine customer reviews.";

type SiteUrlResult = {
  url: URL;
  isFallback: boolean;
};

function normalizeSiteUrl(raw: string | undefined): URL | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    parsed.hash = "";
    parsed.search = "";
    return parsed;
  } catch {
    return null;
  }
}

export function getSiteUrl(): SiteUrlResult {
  const fromEnv = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (fromEnv) return { url: fromEnv, isFallback: false };
  return { url: new URL(PRODUCTION_SITE_URL), isFallback: true };
}

export function absoluteUrl(path = "/"): string {
  const { url } = getSiteUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, url).toString();
}

export function getMetadataBase(): URL {
  return getSiteUrl().url;
}

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  noIndex?: boolean;
};

export function createPageMetadata({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE_PATH,
  noIndex = false,
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const imageUrl = absoluteUrl(image);

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} - Repair and maintenance services`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
  };
}

export const PRIVATE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
};

export const DEFAULT_SITE_DESCRIPTION = DEFAULT_DESCRIPTION;
