"use client";

import Link from "next/link";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export default function ExploreProducts() {
  const ref = useScrollReveal<HTMLDivElement>({ start: "top 85%" });

  return (
    <section ref={ref} className="page-gutter bg-ink py-28 md:py-40">
      <div>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs tracking-[0.3em] text-gold uppercase">
            Explore Products
          </p>
          <h2 className="mt-6 font-display text-3xl leading-[1.2] text-ivory md:text-[2.75rem]">
            Discover the curated launch collection.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-ivory-dim md:text-lg">
            Shop Atoreum MV&apos;s first Lebelage edit — premium Korean skincare made
            for the Maldives and designed to feel effortless every day.
          </p>
        </div>

        <div className="mt-16 flex justify-center">
          <Link
            href="/products"
            className="group inline-flex items-center gap-4 rounded-none border border-gold px-8 py-4 text-xs tracking-[0.25em] text-gold uppercase transition-colors hover:bg-gold-deep hover:text-ink"
          >
            Explore the collection
            <span className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
