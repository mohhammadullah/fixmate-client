import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ServiceDetails from "@/components/services/ServiceDetails";
import { getPublicServiceDetail } from "@/lib/public-service-detail";
import { SITE_NAME, absoluteUrl, createPageMetadata } from "@/lib/seo";

/**
 * Public service-details page.
 *
 * Route: /services/[id] — the service itself is fetched from the public
 * GET /api/services/:id endpoint (no auth required). Booking is handled by
 * the client component, which uses the Better Auth session and a dynamic
 * JWT only when a customer actually submits a request.
 *
 * `instant = false` opts this route out of instant-navigation prerender
 * validation (Cache Components): the client subtree reads the session for
 * the booking panel, so the shell can't be fully prerendered.
 */
export const instant = false;

type Props = PageProps<"/services/[id]">;

function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { service, notFound: isNotFound } = await getPublicServiceDetail(id);

  if (!service) {
    if (isNotFound) notFound();
    return {
      ...createPageMetadata({
        title: "Service Details",
        description:
          "View repair service details, pricing, and booking information on FixMate.",
        path: `/services/${id}`,
        noIndex: true,
      }),
    };
  }

  const description =
    service.description.trim() ||
    service.overview.trim() ||
    `Book ${service.title} on FixMate in ${service.location}. View service details, pricing, and request a repair from a verified technician.`;

  return {
    ...createPageMetadata({
      title: service.title,
      description: description.slice(0, 160),
      path: `/services/${service._id}`,
    }),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: service.title,
      description: description.slice(0, 160),
      url: absoluteUrl(`/services/${service._id}`),
      images: service.image
        ? [
            {
              url: service.image,
              alt: service.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: service.title,
      description: description.slice(0, 160),
      images: service.image ? [service.image] : undefined,
    },
  };
}

export default async function ServiceDetailsPage({ params }: Props) {
  const { id } = await params;
  const { service, notFound: isNotFound } = await getPublicServiceDetail(id);
  if (isNotFound) notFound();

  const serviceJsonLd =
    service
      ? {
          "@context": "https://schema.org",
          "@type": "Service",
          name: service.title,
          description:
            service.description.trim() ||
            service.overview.trim() ||
            `${service.title} repair service on FixMate.`,
          serviceType: service.category,
          areaServed: service.location,
          provider: {
            "@type": "Organization",
            name: SITE_NAME,
            url: absoluteUrl("/"),
          },
          url: absoluteUrl(`/services/${service._id}`),
          ...(service.image ? { image: service.image } : {}),
          ...(service.rating.reviewCount > 0 && service.rating.averageRating !== null
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: service.rating.averageRating,
                  reviewCount: service.rating.reviewCount,
                },
              }
            : {}),
          offers: {
            "@type": "Offer",
            price: service.hourlyRate,
            description: "Hourly service rate shown on FixMate. Final booking amount may vary by repair.",
            url: absoluteUrl(`/services/${service._id}`),
            availability: "https://schema.org/InStock",
          },
        }
      : null;

  const breadcrumbJsonLd = service
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Services",
            item: absoluteUrl("/services"),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: service.title,
            item: absoluteUrl(`/services/${service._id}`),
          },
        ],
      }
    : null;

  return (
    <main>
      {serviceJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }}
        />
      ) : null}
      {breadcrumbJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
        />
      ) : null}
      <section className="relative overflow-hidden border-b border-border bg-navy-950 text-[#dbe4ef]">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(56,189,248,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.055) 1px, transparent 1px)",
            backgroundSize: "46px 46px",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-600/20 blur-3xl"
        />
        <div className="relative px-4 py-8 sm:px-8 sm:py-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-400 sm:text-[11px]">
            FixMate · Service Details
          </p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#f2f7fd] sm:text-3xl xl:text-4xl">
            Repair{" "}
            <span className="bg-gradient-to-r from-accent-400 via-accent-500 to-accent-600 bg-clip-text text-transparent">
              Service
            </span>
          </p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#a8bdd4]">
            Everything you need to know before requesting this repair — scope,
            pricing, capacity and what&apos;s included.
          </p>
        </div>
      </section>

      <section className="container-page py-8 lg:py-12">
        <ServiceDetails serviceId={id} initialService={service} />
      </section>
    </main>
  );
}