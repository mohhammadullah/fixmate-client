import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_SITE_DESCRIPTION,
  SITE_NAME,
  absoluteUrl,
  getMetadataBase,
} from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ogImageUrl = absoluteUrl(DEFAULT_OG_IMAGE_PATH);

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "FixMate | Book Trusted Repair and Maintenance Services",
    template: "%s | FixMate",
  },
  description: DEFAULT_SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "FixMate | Book Trusted Repair and Maintenance Services",
    description: DEFAULT_SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "FixMate repair and maintenance services",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FixMate | Book Trusted Repair and Maintenance Services",
    description: DEFAULT_SITE_DESCRIPTION,
    images: [ogImageUrl],
  },
  robots: {
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
  verification: {
    google: "zTJTdV-KqTWoI_QPgKXx8oi7ZqlPdc03PgqGeubJd-0",
  },
  category: "technology",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const siteUrl = absoluteUrl("/");
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: siteUrl,
    logo: absoluteUrl("/favicon.ico"),
    description: DEFAULT_SITE_DESCRIPTION,
    email: "gmhgazi92@gmail.com",
    telephone: "+8801952182385",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Khulna",
      addressCountry: "BD",
    },
    sameAs: ["https://www.linkedin.com/in/gazi-mohammadullah"],
  };
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl,
    description: DEFAULT_SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/services")}?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  const serializeJsonLd = (value: unknown) =>
    JSON.stringify(value).replace(/</g, "\\u003c");

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Theme bootstrap — runs before first paint to avoid a theme flash.
            Defaults to dark; restores the persisted choice from localStorage. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=window.localStorage.getItem("fixmate-theme");var d=t!=="light";var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteJsonLd) }}
        />
        <Navbar />
        {children}
        <Footer />
        {/* App-wide toast notifications (payments, actions with no inline
            surface). Dark matches the app's default theme. */}
        <Toaster position="top-right" richColors closeButton theme="dark" />
      </body>
    </html>
  );
}
