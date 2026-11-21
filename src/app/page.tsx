import type { Metadata } from "next";
import { Suspense } from "react";
import { DEFAULT_SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "@/lib/seo";
import HeroSection from "@/components/home/HeroSection";
import FeaturedServices, {
  FeaturedServicesSkeleton,
} from "@/components/home/FeaturedServices";
import PopularCategories from "@/components/home/PopularCategories";
import PopularServices, {
  PopularServicesSkeleton,
} from "@/components/home/PopularServices";
import HowItWorks from "@/components/home/HowItWorks";
import WhyChooseFixMate from "@/components/home/WhyChooseFixMate";
import AboutSection from "@/components/home/AboutSection";
import Testimonials, {
  TestimonialsSkeleton,
} from "@/components/home/Testimonials";
import FinalCTA from "@/components/home/FinalCTA";

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME} | Book Trusted Repair and Maintenance Services`,
  },
  description: DEFAULT_SITE_DESCRIPTION,
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    title: `${SITE_NAME} | Book Trusted Repair and Maintenance Services`,
    description: DEFAULT_SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    type: "website",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Book Trusted Repair and Maintenance Services`,
    description: DEFAULT_SITE_DESCRIPTION,
  },
};

function HeroFallback() {
  return (
    <section
      aria-hidden="true"
      className="border-b border-navy-800 bg-navy-950"
    >
      <div className="container-page py-10 sm:py-14 lg:py-16 xl:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16">
          <div>
            <div className="h-6 w-52 animate-pulse rounded-full bg-navy-800" />
            <div className="mt-5 h-16 w-4/5 animate-pulse rounded-2xl bg-navy-800" />
            <div className="mt-4 h-16 w-3/5 animate-pulse rounded-2xl bg-navy-800" />
            <div className="mt-5 h-5 w-2/3 animate-pulse rounded bg-navy-800" />
            <div className="mt-6 h-[52px] w-full max-w-lg animate-pulse rounded-2xl bg-navy-800" />
            <div className="mt-5 flex gap-3">
              <div className="h-12 w-40 animate-pulse rounded-full bg-navy-800" />
              <div className="h-12 w-40 animate-pulse rounded-full bg-navy-800" />
            </div>
          </div>
          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <div className="h-72 w-full animate-pulse rounded-3xl bg-navy-800/70" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main>
      <Suspense fallback={<HeroFallback />}>
        <HeroSection />
      </Suspense>
      <Suspense fallback={<FeaturedServicesSkeleton />}>
        <FeaturedServices />
      </Suspense>
      <PopularCategories />
      <Suspense fallback={<PopularServicesSkeleton />}>
        <PopularServices />
      </Suspense>
      <HowItWorks />
      <WhyChooseFixMate />
      <AboutSection />
      <Suspense fallback={<TestimonialsSkeleton />}>
        <Testimonials />
      </Suspense>
      <FinalCTA />
    </main>
  );
}
