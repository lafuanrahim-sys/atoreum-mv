import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductById, getRelatedProducts } from "@/lib/data/products.server";
import ProductGallery from "@/components/products/ProductGallery";
import AddToCartButton from "@/components/products/AddToCartButton";
import StockBadge from "@/components/products/StockBadge";
import ProductCard from "@/components/products/ProductCard";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = getProductById(id);
  if (!product) return { title: "Product not found — Atoreum MV" };
  return {
    title: `${product.name} — Atoreum MV`,
    description: product.description,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getProductById(id);
  if (!product) notFound();

  const related = getRelatedProducts(product.category, product.id, 3);

  return (
    <div className="bg-ink pt-32 pb-28 md:pt-40">
      <div className="mx-auto max-w-[1440px] px-6 md:px-12">
        <nav className="text-xs uppercase tracking-[0.15em] text-ivory-dim">
          <Link href="/products" className="hover:text-gold">
            Collection
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/products?category=${encodeURIComponent(product.category)}`} className="hover:text-gold">
            {product.category}
          </Link>
        </nav>

        <div className="mt-8 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <ProductGallery images={product.images} name={product.name} />

          <div className="flex flex-col">
            <p className="text-[11px] tracking-[0.2em] text-sand uppercase">{product.brand}</p>
            <h1 className="mt-3 font-display text-3xl leading-[1.15] text-ivory md:text-4xl">
              {product.name}
            </h1>

            <div className="mt-4 flex items-center gap-4">
              <span className="text-lg text-ivory">{formatPrice(product.price, product.currency)}</span>
              <StockBadge status={product.stockStatus} />
            </div>

            <p className="mt-6 text-base leading-relaxed text-ivory-dim">
              {product.description}
            </p>

            <div className="mt-8">
              <AddToCartButton product={product} />
            </div>

            <div className="mt-10 border-t border-line pt-8">
              <h2 className="text-xs uppercase tracking-[0.2em] text-ivory">Details</h2>
              <p className="mt-4 text-sm leading-relaxed text-ivory-dim">{product.details}</p>
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

        {related.length > 0 && (
          <div className="mt-28 border-t border-line pt-16">
            <h2 className="font-display text-2xl text-ivory">You may also like</h2>
            <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
