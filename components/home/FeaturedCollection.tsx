"use client";

import Link from "next/link";
import type { Product } from "@/lib/products";
import ProductCard from "@/components/products/ProductCard";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export default function FeaturedCollection({ products }: { products: Product[] }) {
  const ref = useScrollReveal<HTMLDivElement>({ start: "top 85%" });

  return (
    <section ref={ref} className="bg-ink px-6 py-28 md:px-12 md:py-40">
      <div className="mx-auto max-w-[1440px]">
        <div className="max-w-2xl">
          <p className="text-xs tracking-[0.3em] text-gold uppercase">
            Featured Edit
          </p>
          <h2 className="mt-6 font-display text-3xl leading-[1.2] text-ivory md:text-[2.75rem]">
            Launch edit
          </h2>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-ivory-dim md:text-lg">
            A taut selection of Lebelage formulas chosen for Maldives humidity,
            salt air, and radiant island skin.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        <div className="mt-16 flex justify-center">
          <Link
            href="/products"
            className="group inline-flex items-center gap-4 border border-gold px-8 py-4 text-xs tracking-[0.25em] text-gold uppercase transition-colors hover:bg-gold-deep hover:text-ink"
          >
            View the full edit
            <span className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
