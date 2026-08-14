import { describe, it, expect } from "vitest";
import { productSchema, breadcrumbSchema } from "@/lib/seo/schema";
import type { Product } from "@/lib/types";

/**
 * The schema.org rules that fail silently.
 *
 * A malformed record doesn't break the page — it just quietly stops producing
 * the rich result, and the only place that shows up is Search Console weeks
 * later. These are the three mistakes that actually get made: a price with a
 * currency symbol in it, a relative image URL, and an aggregateRating on a
 * product nobody has reviewed.
 */
const base: Product = {
  id: "amp-001",
  sku: "LBL-AMP-001",
  name: "Lebelage Dr. Cica Derma Ampoule",
  size: "30ml",
  brand: "Lebelage",
  category: "Ampoule",
  price: 290,
  priceMin: 200,
  priceMedian: null,
  priceMax: null,
  discountPercent: 0,
  priceEffective: 290,
  currency: "MVR",
  description: "Ampoule for acne & redness calming.",
  headlines: ["a", "b", "c"],
  images: ["/images/products/amp-001.png"],
  stockStatus: "in-stock",
  stockOnHand: 5,
  featured: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as Product;

describe("productSchema", () => {
  it("quotes the price as a bare number, never with a currency symbol", () => {
    const offers = productSchema(base, undefined).offers as Record<string, unknown>;
    expect(offers.price).toBe("290.00");
    expect(offers.priceCurrency).toBe("MVR");
  });

  it("quotes the discounted price, which is what the shopper is actually charged", () => {
    const discounted = { ...base, discountPercent: 20, priceEffective: 232 };
    const offers = productSchema(discounted, undefined).offers as Record<string, unknown>;
    expect(offers.price).toBe("232.00");
  });

  it("makes image URLs absolute — a relative one is dropped by crawlers", () => {
    const schema = productSchema(base, undefined);
    for (const img of schema.image as string[]) {
      expect(img).toMatch(/^https?:\/\//);
    }
  });

  it("omits aggregateRating entirely when nothing has been reviewed", () => {
    expect(productSchema(base, undefined)).not.toHaveProperty("aggregateRating");
    // The zero case is the one that matters: emitting reviewCount 0 is a
    // Search Console error, not a harmless empty value.
    expect(productSchema(base, { average: 0, count: 0 })).not.toHaveProperty("aggregateRating");
  });

  it("includes aggregateRating once there are real reviews", () => {
    const schema = productSchema(base, { average: 4.6666, count: 3 });
    expect(schema.aggregateRating).toMatchObject({
      ratingValue: "4.7",
      reviewCount: 3,
      bestRating: 5,
    });
  });

  it("reports out-of-stock, and treats low stock as still buyable", () => {
    const offersFor = (stockStatus: string) =>
      productSchema({ ...base, stockStatus } as Product, undefined).offers as Record<string, unknown>;
    expect(offersFor("out-of-stock").availability).toBe("https://schema.org/OutOfStock");
    expect(offersFor("low-stock").availability).toBe("https://schema.org/InStock");
    expect(offersFor("in-stock").availability).toBe("https://schema.org/InStock");
  });
});

describe("breadcrumbSchema", () => {
  it("numbers positions from 1 and makes every item absolute", () => {
    const crumbs = breadcrumbSchema([
      { name: "Collection", path: "/products" },
      { name: "Ampoule", path: "/products?category=Ampoule" },
    ]).itemListElement as Record<string, unknown>[];

    expect(crumbs.map((c) => c.position)).toEqual([1, 2]);
    expect(crumbs[0].item).toBe("https://atoreum.mv/products");
    expect(crumbs[1].item).toBe("https://atoreum.mv/products?category=Ampoule");
  });
});
