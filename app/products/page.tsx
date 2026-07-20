import type { Metadata } from "next";
import ProductGrid from "@/components/products/ProductGrid";

export const metadata: Metadata = {
  title: "Collection — Atoreum MV",
  description:
    "Browse Atoreum MV's collection of Korean skincare, makeup, haircare, and fragrance — curated for the Maldives.",
};

export default function ProductsPage() {
  return (
    <div className="bg-ink pt-32 pb-28 md:pt-40">
      <div className="mx-auto max-w-[1440px] px-6 md:px-12">
        <div className="max-w-2xl">
          <p className="text-xs tracking-[0.3em] text-gold uppercase">
            The Collection
          </p>
          <h1 className="mt-6 font-display text-4xl leading-[1.15] text-ivory md:text-5xl">
            Korean beauty, curated for the Maldives.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-ivory-dim md:text-lg">
            Every formula here is chosen for the same reason: it has to
            perform in heat, humidity, and salt air. Checkout and ordering
            are on the way — for now, browse the collection.
          </p>
        </div>

        <div className="mt-16">
          <ProductGrid />
        </div>
      </div>
    </div>
  );
}
