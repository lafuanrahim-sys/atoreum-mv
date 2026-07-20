"use client";

import { useMemo, useState } from "react";
import { products, type Product } from "@/lib/products";
import ProductCard from "./ProductCard";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

const CATEGORIES: Array<Product["category"] | "All"> = [
  "All",
  "Skincare",
  "Suncare",
  "Makeup",
  "Haircare",
  "Fragrance",
];

export default function ProductGrid() {
  const [active, setActive] = useState<(typeof CATEGORIES)[number]>("All");
  const ref = useScrollReveal<HTMLDivElement>({ start: "top 85%" });

  const filtered = useMemo(
    () =>
      active === "All"
        ? products
        : products.filter((p) => p.category === active),
    [active]
  );

  return (
    <div>
      <div className="flex flex-wrap gap-3 border-b border-line pb-8">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => setActive(category)}
            className={cn(
              "px-5 py-2 text-xs tracking-[0.2em] uppercase transition-colors",
              active === category
                ? "bg-gold text-ink"
                : "text-ivory-dim hover:text-gold"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      <div
        key={active}
        ref={ref}
        className="mt-12 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3"
      >
        {filtered.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-12 text-sm text-ivory-dim">
          No products in this category yet.
        </p>
      )}
    </div>
  );
}
