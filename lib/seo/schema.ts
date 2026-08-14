import type { Product } from "@/lib/types";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, STORE, absoluteUrl } from "@/lib/site";

/**
 * schema.org records, kept in one place because the rules are unforgiving and
 * easy to get subtly wrong:
 *
 *  - Prices are plain numbers. "MVR 290" in a price field invalidates the
 *    whole offer, and an invalid offer means no rich result at all.
 *  - aggregateRating must be omitted entirely when there are no reviews.
 *    Emitting one with reviewCount 0 is a Search Console error, not a
 *    harmless empty value.
 *  - Every URL must be absolute. A relative image is simply dropped.
 */

type Rating = { average: number; count: number } | undefined;

/** In-stock and low-stock are both purchasable; only zero is not. */
function availability(product: Product): string {
  return product.stockStatus === "out-of-stock"
    ? "https://schema.org/OutOfStock"
    : "https://schema.org/InStock";
}

export function productSchema(product: Product, rating: Rating): Record<string, unknown> {
  const url = absoluteUrl(`/products/${product.id}`);
  const images = product.images.map((src) => absoluteUrl(src));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    ...(images.length > 0 ? { image: images } : {}),
    brand: { "@type": "Brand", name: product.brand },
    category: product.category,
    ...(product.size ? { size: product.size } : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: product.currency,
      // priceEffective, not price: the discounted figure is what a shopper is
      // charged, and a search result quoting a price they can't get is worse
      // than quoting none.
      price: product.priceEffective.toFixed(2),
      availability: availability(product),
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: SITE_NAME },
    },
    ...(rating && rating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.average.toFixed(1),
            reviewCount: rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

/** Mirrors the visible breadcrumb on the product page — Google requires the
 * structured trail to match what the visitor is shown. */
export function breadcrumbSchema(trail: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * The shop as a business with a location.
 *
 * This is what gives the site a chance at "korean skincare maldives" rather
 * than only at its own name — an OnlineStore with an areaServed tells Google
 * who the site is for, which a page of product cards does not.
 */
export function storeSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": `${SITE_URL}/#store`,
    name: SITE_NAME,
    legalName: STORE.legalName,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    email: STORE.email,
    logo: absoluteUrl("/atoreum-logo.svg"),
    image: absoluteUrl("/opengraph-image"),
    address: {
      "@type": "PostalAddress",
      addressLocality: STORE.city,
      postalCode: STORE.postalCode,
      addressCountry: STORE.country,
    },
    areaServed: { "@type": "Country", name: STORE.countryName },
    currenciesAccepted: STORE.currency,
    paymentAccepted: "Cash on delivery, Bank transfer",
    // 20:00-21:30 daily, the delivery window shown at checkout. Expressed in
    // schema.org's 24h form.
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: "20:00",
        closes: "21:30",
      },
    ],
  };
}

/** Lets Google offer a search box for the site directly in the results. */
export function websiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    publisher: { "@id": `${SITE_URL}/#store` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/products?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}
