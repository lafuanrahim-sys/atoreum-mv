import type { Metadata } from "next";
import { Suspense } from "react";
import ProductGrid from "@/components/products/ProductGrid";
import CollectionHero from "@/components/products/CollectionHero";
import CoverflowArc from "@/components/home/CoverflowArc";
import RecentlyViewedStrip from "@/components/products/RecentlyViewedStrip";
import { getAllProducts } from "@/lib/data/products.server";
import { getRatingSummaries } from "@/lib/data/reviews.server";

export const metadata: Metadata = {
  title: "Shop Korean Skincare",
  description:
    "Browse the full Lebelage range in the Maldives: cleansing foams, toners, serums, ampoules, creams, sheet masks and sun care. Delivered in Malé.",
  alternates: { canonical: "/products" },
};

export default async function ProductsPage() {
  const [products, ratings] = await Promise.all([getAllProducts(), getRatingSummaries()]);

  return (
    <div className="bg-ink">
      <CollectionHero />
      <CoverflowArc />
      {/* SpiralShowcase (components/products/SpiralShowcase.tsx) parked here,
          not deleted — re-add the import and `<SpiralShowcase products={products} />`
          above to bring the 3D scroll spiral back. */}

      <div className="pt-20 pb-28 md:pt-24">
        <div className="page-gutter">
          <RecentlyViewedStrip products={products} />
          <Suspense fallback={<div />}>
            <ProductGrid products={products} ratings={ratings} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
