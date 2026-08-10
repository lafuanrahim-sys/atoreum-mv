import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductById, getRelatedProducts } from "@/lib/data/products.server";
import ProductGallery from "@/components/products/ProductGallery";
import ProductHeadlines from "@/components/products/ProductHeadlines";
import AddToCartButton from "@/components/products/AddToCartButton";
import StockBadge from "@/components/products/StockBadge";
import ProductCard from "@/components/products/ProductCard";
import FavoriteButton from "@/components/products/FavoriteButton";
import ProductReviews from "@/components/products/ProductReviews";
import TrackRecentlyViewed from "@/components/products/TrackRecentlyViewed";
import { listApprovedReviews, getRatingSummaries } from "@/lib/data/reviews.server";
import { hasCompletedPurchase } from "@/lib/data/orders.server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return { title: "Product not found | Atoreum MV" };
  return {
    title: `${product.name} | Atoreum MV`,
    description: product.description,
  };
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ review?: string }>;
}) {
  const { id } = await params;
  const { review: reviewFlag } = await searchParams;
  const product = await getProductById(id);
  if (!product) notFound();

  const [related, reviews, ratings, user] = await Promise.all([
    getRelatedProducts(product.category, product.id, 3),
    listApprovedReviews(product.id),
    getRatingSummaries(),
    getCurrentUser(),
  ]);
  const canReview = !!user && (await hasCompletedPurchase(user.email, product.id));

  return (
    <div className="bg-ink pt-10 pb-28 md:pt-14">
      <TrackRecentlyViewed productId={product.id} />
      <div className="page-gutter">
        <nav aria-label="Breadcrumb" className="text-xs uppercase tracking-[0.15em] text-ivory-dim">
          <Link href="/products" className="transition-colors hover:text-gold">
            Collection
          </Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <Link href={`/products?category=${encodeURIComponent(product.category)}`} className="transition-colors hover:text-gold">
            {product.category}
          </Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <span aria-current="page" className="text-ivory">
            {product.name}
          </span>
        </nav>

        <div className="mt-8 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <ProductGallery images={product.images} name={product.name} />

          <div className="flex flex-col">
            <p className="text-[11px] tracking-[0.2em] text-sand uppercase">{product.brand}</p>
            <h1 className="mt-3 font-sans text-2xl font-semibold leading-[1.2] tracking-tight text-ivory md:text-3xl">
              {product.name}
              {product.size && (
                <span className="ml-2 align-middle text-sm font-normal lowercase tracking-normal text-ivory-dim">
                  {product.size}
                </span>
              )}
            </h1>
            <ProductHeadlines headlines={product.headlines} />

            <div className="mt-4 flex items-center gap-4">
              {product.discountPercent > 0 ? (
                <span className="flex items-baseline gap-2.5">
                  <s className="text-sm text-ivory-dim/70 tabular-nums">{formatPrice(product.price, product.currency)}</s>
                  <span className="text-lg text-ivory tabular-nums">{formatPrice(product.priceEffective, product.currency)}</span>
                  <span className="rounded-sm bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] text-gold uppercase">
                    -{Math.round(product.discountPercent)}%
                  </span>
                </span>
              ) : (
                <span className="text-lg text-ivory tabular-nums">{formatPrice(product.price, product.currency)}</span>
              )}
              <StockBadge status={product.stockStatus} />
              <FavoriteButton productId={product.id} />
            </div>

            <p className="mt-6 text-base leading-relaxed text-ivory-dim">
              {product.description}
            </p>

            <div className="mt-8">
              <AddToCartButton product={product} />
            </div>

            <div className="mt-10 border-t border-line pt-8">
              <h2 className="text-xs uppercase tracking-[0.2em] text-ivory">How to Use</h2>
              <p className="mt-4 text-sm leading-relaxed text-ivory-dim">{product.howToUse}</p>
            </div>

            <div className="mt-8 border-t border-line pt-8">
              <h2 className="text-xs uppercase tracking-[0.2em] text-ivory">Ingredients</h2>
              <p className="mt-4 text-sm leading-relaxed text-ivory-dim">{product.ingredients}</p>
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-line pt-8 text-xs">
              <div>
                <dt className="uppercase tracking-[0.15em] text-ivory-dim">SKU</dt>
                <dd className="mt-1 text-ivory">{product.sku}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-[0.15em] text-ivory-dim">Category</dt>
                <dd className="mt-1 text-ivory">{product.category}</dd>
              </div>
            </dl>
          </div>
        </div>

        <ProductReviews
          productId={product.id}
          reviews={reviews}
          isLoggedIn={!!user}
          canReview={canReview}
          flag={reviewFlag}
        />

        {related.length > 0 && (
          <div className="mt-10 border-t border-line pt-8 md:mt-28 md:pt-16">
            <h2 className="font-display text-2xl text-ivory">You may also like</h2>
            <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} rating={ratings[item.id]} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
