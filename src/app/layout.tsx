import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
let siteUrl: URL | undefined;
if (rawSiteUrl) {
  try {
    const parsed = new URL(rawSiteUrl);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      siteUrl = parsed;
    }
  } catch {
    siteUrl = undefined;
  }
}

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: siteUrl } : {}),
  title: {
    default: "FixMate — Expert Repairs. Reliable Solutions. Every Time.",
    template: "%s | FixMate",
  },
  description:
    "Find verified repair technicians for smartphones, laptops and home appliances. Approved services, transparent hourly rates and genuine customer reviews — book trusted repairs with FixMate.",
  applicationName: "FixMate",
  openGraph: {
    type: "website",
    siteName: "FixMate",
    title: "FixMate — Expert Repairs. Reliable Solutions. Every Time.",
    description:
      "Find verified repair technicians for smartphones, laptops and home appliances. Approved services, transparent hourly rates and genuine customer reviews — book trusted repairs with FixMate.",
    ...(siteUrl ? { url: siteUrl } : {}),
  },
  twitter: {
    card: "summary_large_image",
    title: "FixMate — Expert Repairs. Reliable Solutions. Every Time.",
    description:
      "Find verified repair technicians for smartphones, laptops and home appliances. Book trusted repairs with FixMate.",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "zTJTdV-KqTWoI_QPgKXx8oi7ZqlPdc03PgqGeubJd-0",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
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
