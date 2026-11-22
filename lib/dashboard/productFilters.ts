import type { Product } from "@/lib/types";

/**
 * The dashboard product list's filters, shared by the page that renders the
 * table (app/dashboard/products/page.tsx) and the route that exports it
 * (app/dashboard/products/export/route.ts).
 *
 * Extracted so the two cannot drift: an export that silently applied
 * different rules from the table above it would be worse than no export at
 * all -- the admin would be reconciling against a spreadsheet that doesn't
 * match what they were just looking at, with nothing on screen to say so.
 */
export type ProductFilters = {
  q: string;
  category: string;
  stock: string;
  offer: string;
  featured: string;
  min: string;
  max: string;
};

export const EMPTY_FILTERS: ProductFilters = {
  q: "",
  category: "",
  stock: "",
  offer: "",
  featured: "",
  min: "",
  max: "",
};

/** Reads the filter set out of a URL's query string, defaulting each to "". */
export function readProductFilters(params: URLSearchParams): ProductFilters {
  return {
    q: params.get("q") ?? "",
    category: params.get("category") ?? "",
    stock: params.get("stock") ?? "",
    offer: params.get("offer") ?? "",
    featured: params.get("featured") ?? "",
    min: params.get("min") ?? "",
    max: params.get("max") ?? "",
  };
}

/** True when the product carries a live offer of either kind. */
export function isOnOffer(product: Product): boolean {
  return product.discountPercent > 0 || product.discountAmount > 0;
}

/**
 * Every filter is AND-ed, so "Cream + on offer + under MVR 400" is one
 * query. Price bounds are compared against priceEffective -- what the
 * customer actually pays -- not the pre-discount listing price.
 */
export function filterProducts(all: Product[], filters: ProductFilters): Product[] {
  const { q, category, stock, offer, featured, min, max } = filters;
  const priceFloor = Number(min);
  const priceCeil = Number(max);

  return all.filter((p) => {
    const needle = q.trim().toLowerCase();
    // Search covers SKU as well as name -- the SKU is what's on the carton,
    // and searching for it and getting nothing is a confusing dead end.
    const matchesQuery = needle
      ? p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle)
      : true;
    const matchesCategory = category ? p.category === category : true;
    const matchesStock = stock ? p.stockStatus === stock : true;
    const onOffer = isOnOffer(p);
    const matchesOffer = offer === "on" ? onOffer : offer === "off" ? !onOffer : true;
    const matchesFeatured = featured === "yes" ? p.featured : featured === "no" ? !p.featured : true;
    const matchesFloor = Number.isFinite(priceFloor) && min !== "" ? p.priceEffective >= priceFloor : true;
    const matchesCeil = Number.isFinite(priceCeil) && max !== "" ? p.priceEffective <= priceCeil : true;

    return (
      matchesQuery && matchesCategory && matchesStock && matchesOffer && matchesFeatured && matchesFloor && matchesCeil
    );
  });
}

/**
 * A short human description of the active filters, written into the
 * spreadsheet so an exported file taken out of context still says what
 * subset of the catalog it represents.
 */
export function describeFilters(filters: ProductFilters): string {
  const parts: string[] = [];
  if (filters.q) parts.push(`search "${filters.q}"`);
  if (filters.category) parts.push(`category ${filters.category}`);
  if (filters.stock) parts.push(`stock ${filters.stock.replace(/-/g, " ")}`);
  if (filters.offer === "on") parts.push("on offer");
  if (filters.offer === "off") parts.push("not discounted");
  if (filters.featured === "yes") parts.push("featured only");
  if (filters.featured === "no") parts.push("not featured");
  if (filters.min) parts.push(`price from ${filters.min}`);
  if (filters.max) parts.push(`price to ${filters.max}`);
  return parts.length > 0 ? parts.join(", ") : "none — full catalog";
}
