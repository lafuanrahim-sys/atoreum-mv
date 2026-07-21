import type { Metadata } from "next";
import { Suspense } from "react";
import ProductGrid from "@/components/products/ProductGrid";
import { getAllProducts } from "@/lib/data/products.server";

export const metadata: Metadata = {
  title: "Atoreum MV Curated Skincare — Maldives launch",
  description:
    "Discover Atoreum MV's curated Lebelage launch collection for the Maldives.",
};

export default function ProductsPage() {
  const products = getAllProducts();

  return (
    <div className="bg-ink pt-32 pb-28 md:pt-40">
      <div className="mx-auto max-w-[1440px] px-6 md:px-12">
        <div className="max-w-2xl">
          <p className="text-xs tracking-[0.3em] text-gold uppercase">
            The Collection
          </p>
          <h1 className="mt-6 font-display text-4xl leading-[1.15] text-ivory md:text-5xl">
            Curated skincare for the Maldives.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-ivory-dim md:text-lg">
            Selected for Atoreum MV&apos;s official Lebelage launch — premium Korean
            formulas made to perform under salt air, sunlight, and island humidity.
          </p>
        </div>

        <div className="mt-16">
          <Suspense fallback={<div />}>
            <ProductGrid products={products} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
