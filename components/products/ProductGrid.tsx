"use client";

import { useMemo, useState } from "react";
import type { Product, SortOption } from "@/lib/products";
import { CATEGORIES } from "@/lib/products";
import ProductCard from "./ProductCard";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useSearchParams } from "next/navigation";

const SORT_LABELS: Record<SortOption, string> = {
  featured: "Featured",
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
};

function sortProducts(products: Product[], sort: SortOption): Product[] {
  const copy = [...products];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price);
    case "newest":
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "featured":
    default:
      return copy.sort((a, b) => Number(b.featured) - Number(a.featured));
  }
}

export default function ProductGrid({ products }: { products: Product[] }) {
  const categories = ["All", ...CATEGORIES] as const;
  const searchParams = useSearchParams();
  const [active, setActive] = useState(() => searchParams?.get("category") ?? "All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("featured");
  const ref = useScrollReveal<HTMLDivElement>({ start: "top 85%" });

  const filtered = useMemo(() => {
    const byCategory =
      active === "All" ? products : products.filter((p) => p.category === active);
    const bySearch = query.trim()
      ? byCategory.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
      : byCategory;
    return sortProducts(bySearch, sort);
  }, [products, active, query, sort]);

  return (
    <div>
      <div className="flex flex-col gap-6 border-b border-line pb-8 lg:flex-row lg:items-end lg:justify-between">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ivory-dim">Category</span>
          <select
            value={active}
            onChange={(e) => setActive(e.target.value)}
            className="border border-line bg-transparent px-4 py-2 text-xs uppercase tracking-[0.15em] text-ivory-dim focus:border-gold focus:outline-none"
          >
            {categories.map((category) => (
              <option key={category} value={category} className="bg-ink-2 text-ivory">
                {category}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="border border-line bg-transparent px-4 py-2 text-sm text-ivory placeholder:text-ivory-dim focus:border-gold focus:outline-none"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="border border-line bg-transparent px-4 py-2 text-xs uppercase tracking-[0.15em] text-ivory-dim focus:border-gold focus:outline-none"
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
              <option key={option} value={option} className="bg-ink-2 text-ivory">
                {SORT_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        key={`${active}-${sort}-${query}`}
        ref={ref}
        className="mt-12 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3"
      >
        {filtered.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-12 text-sm text-ivory-dim">
          No products match your search.
        </p>
      )}
    </div>
  );
}
