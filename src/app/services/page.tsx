import type { Metadata } from "next";
import { Suspense } from "react";
import ServicesListing from "@/components/services/ServicesListing";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Repair Services",
  description:
    "Browse verified repair and maintenance services for smartphones, laptops, AC units, refrigerators, TVs, washing machines, and electrical issues on FixMate.",
  path: "/services",
});

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function ServicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main>
      <section
        aria-labelledby="services-heading"
        className="relative overflow-x-clip"
      >
        {/* Ambient section glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-400/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-24 h-64 w-64 rounded-full bg-navy-800/40 blur-3xl"
        />

        <div className="container-page relative py-14 lg:py-20">
          {/* Page header — static, prerendered */}
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-strong dark:border-border dark:bg-surface-muted dark:text-accent">
              Our Services
            </span>
            <h1
              id="services-heading"
              className="mt-4 text-3xl font-extrabold tracking-tight text-heading sm:text-4xl lg:text-5xl"
            >
              Find the Right Repair Service
            </h1>
            <p className="mt-4 text-base leading-7 text-muted sm:text-lg">
              Explore repair solutions for your devices and home appliances.
            </p>
          </div>

          {/* Interactive filters + API-backed results — streamed (reads searchParams) */}
          <Suspense fallback={<ServicesExplorerSkeleton />}>
            <ServicesContent searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

async function ServicesContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  // Initialize directly from the URL so homepage search links (and shared
  // filtered URLs) land on the correct result set.
  return (
    <ServicesListing
      initialSearch={firstParam(params.search)}
      initialCategory={firstParam(params.category)}
      initialLocation={firstParam(params.location)}
      initialMinPrice={firstParam(params.minPrice)}
      initialMaxPrice={firstParam(params.maxPrice)}
      initialSort={firstParam(params.sort) || "newest"}
    />
  );
}

function ServicesExplorerSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto mt-8 max-w-5xl rounded-2xl border border-border bg-surface p-4 shadow-lg sm:mt-10 sm:p-6"
    >
      <div className="grid animate-pulse gap-4 md:grid-cols-2 lg:grid-cols-12">
        <div className="h-12 rounded-xl bg-surface-muted md:col-span-2 lg:col-span-4" />
        <div className="h-12 rounded-xl bg-surface-muted lg:col-span-3" />
        <div className="h-12 rounded-xl bg-surface-muted lg:col-span-2" />
        <div className="h-12 rounded-xl bg-surface-muted lg:col-span-3" />
      </div>
      <div className="mx-auto mt-12 h-40 max-w-6xl animate-pulse rounded-2xl border border-dashed border-border-strong bg-surface/60" />
    </div>
  );
}
