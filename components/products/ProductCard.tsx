"use client";

import type { Product } from "@/lib/products";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import StockBadge from "@/components/products/StockBadge";

function formatPrice(price: number, currency: Product["currency"]) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const outOfStock = product.stockStatus === "out-of-stock";
  const thumbnail = product.images[0] ?? null;

  return (
    <article data-reveal className="group flex flex-col">
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-ink-2 rounded-sm shadow-sm transition-transform duration-500 motion-safe:group-hover:scale-[1.01]">
          {thumbnail ? (
            <div className="absolute inset-0">
              <Image src={thumbnail} alt={product.name} fill className="object-cover" />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-moss/30 via-ink-2 to-ink">
              <span className="font-display text-6xl text-ivory-dim/20">
                {product.brand.charAt(0)}
              </span>
            </div>
          )}

          <div className="absolute top-4 left-4 text-[10px] tracking-[0.2em] text-ivory-dim uppercase">
            {product.category}
          </div>

          {product.stockStatus !== "in-stock" && (
            <div className="absolute top-4 right-4">
              <StockBadge status={product.stockStatus} />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent transition-opacity duration-500 group-hover:opacity-60" />
        </div>
      </Link>

      <div className="mt-5 flex flex-1 flex-col">
        <p className="text-[11px] tracking-[0.2em] text-sand uppercase">
          {product.brand}
        </p>
        <Link href={`/products/${product.id}`}>
          <h3 className="mt-2 font-display text-lg text-ivory transition-colors hover:text-gold">
            {product.name}
          </h3>
        </Link>
        <p className="mt-2 text-sm leading-relaxed text-ivory-dim">
          {product.description}
        </p>

        <div className="mt-auto flex items-center justify-between pt-6">
          <span className="text-sm text-ivory">
            {formatPrice(product.price, product.currency)}
          </span>
          <button
            type="button"
            disabled={outOfStock}
            onClick={() =>
              addItem({
                productId: product.id,
                name: product.name,
                price: product.price,
                currency: product.currency,
                image: thumbnail,
              })
            }
            title={outOfStock ? "Out of stock" : "Add to cart"}
            className="border border-line px-4 py-2 text-[10px] tracking-[0.2em] text-ivory-dim uppercase transition-colors motion-safe:group-hover:border-gold motion-safe:group-hover:text-gold disabled:cursor-not-allowed disabled:opacity-50 disabled:group-hover:border-line disabled:group-hover:text-ivory-dim"
          >
            {outOfStock ? "Out of Stock" : "Add to Cart"}
          </button>
        </div>
      </div>
    </article>
  );
}
