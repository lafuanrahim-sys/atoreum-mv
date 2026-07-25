"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/products";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import StockBadge from "@/components/products/StockBadge";
import FavoriteButton from "@/components/products/FavoriteButton";

function formatPrice(price: number, currency: Product["currency"]) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

// The handful of supplier photos that are full-bleed lifestyle shots (a
// styled scene behind the bottle) rather than a cutout on a plain/transparent
// backdrop. Only these leave a visible flat photo-well bar above/below in the
// 4:5 card — everything else already reads fine with plain object-contain,
// so only this set gets the blurred-backdrop fill treatment.
const BACKGROUNDED_PRODUCT_IDS = new Set([
  "amp-004",
  "amp-005",
  "amp-006",
  "amp-008",
  "amp-009",
  "crm-002",
  "crm-010",
  "crm-011",
  "emu-001",
  "ton-002",
  "fom-004", // black studio backdrop, not transparent
]);

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outOfStock = product.stockStatus === "out-of-stock";
  const thumbnail = product.images[0] ?? null;

  useEffect(() => {
    return () => {
      if (addedTimer.current) clearTimeout(addedTimer.current);
    };
  }, []);

  return (
    <article data-reveal className="group flex flex-col">
      <Link href={`/products/${product.id}`} className="block">
        <div
          data-card-frame
          className="relative aspect-[4/5] overflow-hidden bg-photo-well rounded-sm shadow-sm transition-transform duration-500 motion-safe:group-hover:scale-[1.01]"
        >
          {thumbnail ? (
            <div data-card-media className="absolute inset-0">
              {BACKGROUNDED_PRODUCT_IDS.has(product.id) && (
                // This photo is a full-bleed lifestyle shot (its own scene,
                // no transparency) — square in a taller 4:5 card, which
                // otherwise leaves a flat photo-well bar above/below. Filling
                // that gap with a blurred, scaled-up copy of the same photo
                // reads as an intentional frame instead of dead space.
                <>
                  <Image
                    src={thumbnail}
                    alt=""
                    aria-hidden="true"
                    fill
                    sizes="500px"
                    className="scale-110 object-cover opacity-90 blur-md saturate-150"
                  />
                  <div className="absolute inset-0 bg-photo-well/10" />
                </>
              )}
              {/* inset-6 (not inset-0 + padding) — padding on a position:absolute
                  element doesn't constrain a `fill` child's containing block,
                  it'd be silently ignored and the image would paint edge-to-edge. */}
              <div className="absolute inset-6">
                <Image
                  src={thumbnail}
                  alt={product.name}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-contain drop-shadow-[0_14px_20px_rgba(18,25,21,0.22)]"
                />
              </div>
            </div>
          ) : (
            <div
              data-card-media
              className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-moss/30 via-ink-2 to-ink"
            >
              <span className="font-display text-6xl text-ivory-dim/20">
                {product.brand.charAt(0)}
              </span>
            </div>
          )}

          <div className="absolute top-4 left-4 border border-photo-well-line bg-photo-well/70 px-2.5 py-1 text-[10px] font-medium tracking-[0.18em] text-photo-well-fg uppercase backdrop-blur-sm">
            {product.category}
          </div>

          {product.stockStatus !== "in-stock" && (
            <div className="absolute top-4 right-4">
              <StockBadge status={product.stockStatus} onWell />
            </div>
          )}

          <FavoriteButton productId={product.id} className="absolute bottom-3 right-3" />
        </div>
      </Link>

      <div data-card-text className="mt-5 flex flex-1 flex-col">
        <p className="text-[11px] tracking-[0.2em] text-sand uppercase">
          {product.brand}
        </p>
        <Link href={`/products/${product.id}`}>
          <h3 className="mt-2 font-sans text-base font-medium leading-snug tracking-tight text-ivory transition-colors hover:text-gold">
            {product.name}
            {product.size && (
              <span className="ml-1.5 align-middle text-xs font-normal lowercase tracking-normal text-ivory-dim">
                {product.size}
              </span>
            )}
          </h3>
        </Link>
        <p className="mt-2 text-sm leading-relaxed text-ivory-dim">
          {product.description}
        </p>

        <div className="mt-auto flex items-center justify-between pt-6">
          <span className="text-sm text-ivory tabular-nums">
            {formatPrice(product.price, product.currency)}
          </span>
          <button
            type="button"
            disabled={outOfStock}
            onClick={() => {
              addItem({
                productId: product.id,
                name: product.name,
                price: product.price,
                currency: product.currency,
                image: thumbnail,
              });
              setJustAdded(true);
              if (addedTimer.current) clearTimeout(addedTimer.current);
              addedTimer.current = setTimeout(() => setJustAdded(false), 2000);
            }}
            title={outOfStock ? "Out of stock" : "Add to cart"}
            className={`border px-4 py-2 text-[10px] tracking-[0.2em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:group-hover:border-line disabled:group-hover:text-ivory-dim ${
              justAdded
                ? "border-gold text-gold"
                : "border-line text-ivory-dim motion-safe:group-hover:border-gold motion-safe:group-hover:text-gold"
            }`}
          >
            {outOfStock ? "Out of Stock" : justAdded ? "Added ✓" : "Add to Cart"}
          </button>
        </div>
      </div>
    </article>
  );
}
