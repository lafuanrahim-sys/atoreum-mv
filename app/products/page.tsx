import type { Metadata } from "next";
import { Suspense } from "react";
import ProductGrid from "@/components/products/ProductGrid";
import CollectionHero from "@/components/products/CollectionHero";
import CoverflowArc from "@/components/home/CoverflowArc";
import { getAllProducts } from "@/lib/data/products.server";

export const metadata: Metadata = {
  title: "Atoreum MV Curated Skincare — Maldives launch",
  description:
    "Discover Atoreum MV's curated Lebelage launch collection for the Maldives.",
};

export default function ProductsPage() {
  const products = getAllProducts();

  return (
    <div className="bg-ink">
      <CollectionHero />
      <CoverflowArc />

      <div className="pt-20 pb-28 md:pt-24">
        <div className="page-gutter">
          <Suspense fallback={<div />}>
            <ProductGrid products={products} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
