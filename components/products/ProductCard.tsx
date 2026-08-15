"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/products";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import StockBadge from "@/components/products/StockBadge";
import FavoriteButton from "@/components/products/FavoriteButton";
import StarRating from "@/components/ui/StarRating";

// "New" until 30 days after the product was added — long enough to matter,
// short enough that the badge keeps meaning something.
const NEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export default function ProductCard({
  product,
  rating,
}: {
  product: Product;
  /** Approved-review summary, if any — omit or pass null when there are no reviews yet. */
  rating?: { average: number; count: number } | null;
}) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outOfStock = product.stockStatus === "out-of-stock";
  const onOffer = product.discountPercent > 0 || product.discountAmount > 0;
  const thumbnail = product.images[0] ?? null;
  const isNew = Date.now() - new Date(product.createdAt).getTime() < NEW_WINDOW_MS;

  useEffect(() => {
    return () => {
      if (addedTimer.current) clearTimeout(addedTimer.current);
    };
  }, []);

  return (
    <article
      data-reveal
      // Frosted glass tile -- same material language as the header/cart
      // panels (translucent themed tint, blur, diagonal sheen, inset top
      // highlight, soft outer shadow), sized so the photo frame and text
      // both sit inset from the glass edges instead of bleeding to the
      // grid track's own edges. No hard border -- the sheen/shadow alone
      // reads as a glass edge without a drawn outline around every tile.
      className="group flex flex-col overflow-hidden rounded-2xl bg-ink-2/40 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0)_55%)] p-3 shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset,0_18px_36px_-24px_rgba(0,0,0,0.45)] backdrop-blur-xl backdrop-saturate-150 sm:p-4"
    >
      <div
        data-card-frame
        className="relative aspect-[4/5] touch-manipulation overflow-hidden rounded-xl bg-photo-well shadow-sm transition-transform duration-200 active:scale-[0.97] md:duration-500 md:active:scale-100 md:motion-safe:group-hover:scale-[1.01]"
      >
        <Link href={`/products/${product.id}`} className="absolute inset-0 block" aria-label={product.name}>
          {thumbnail ? (
            <div data-card-media className="absolute inset-0">
              {product.imageHasBackground && (
                // This photo is a full-bleed lifestyle shot (its own scene,
                // no transparency) — detected from the image's mean alpha and
                // stored on the row, since a client component can't open the
                // file (see scripts/detect-image-backgrounds.ts). Square in a
                // taller 4:5 card, which
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
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-moss/30 via-ink-2 to-ink"
            >
              <svg viewBox="0 0 40 40" aria-hidden="true" className="h-9 w-9 text-ivory-dim/30">
                <rect x="6" y="10" width="28" height="22" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="14" cy="17" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M6 27l8-7 6 5 6-6 8 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
              <span className="text-[10px] uppercase tracking-[0.2em] text-ivory-dim/50">Photo coming soon</span>
            </div>
          )}
        </Link>

        <div className="absolute top-2 left-2 rounded-md border border-photo-well-line bg-photo-well/70 px-1.5 py-0.5 text-[8px] font-medium tracking-[0.1em] text-photo-well-fg uppercase backdrop-blur-sm sm:top-4 sm:left-4 sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.18em]">
          {product.category}
        </div>

        {product.stockStatus !== "in-stock" ? (
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
            <StockBadge status={product.stockStatus} onWell />
          </div>
        ) : (
          (isNew || product.featured) && (
            <div className="absolute top-2 right-2 rounded-md border border-gold/60 bg-ink/80 px-1.5 py-0.5 text-[8px] font-medium tracking-[0.1em] text-gold uppercase backdrop-blur-sm sm:top-4 sm:right-4 sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.18em]">
              {isNew ? "New" : "Bestseller"}
            </div>
          )
        )}

        <FavoriteButton productId={product.id} className="absolute bottom-3 right-3" />
      </div>

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

        {rating && rating.count > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <StarRating rating={rating.average} size={12} />
            <span className="text-[11px] text-ivory-dim">({rating.count})</span>
          </div>
        )}

        <p className="mt-2 text-sm leading-relaxed text-ivory-dim">
          {product.description}
        </p>

        {/* Stacked on mobile (not the two-per-row width's fault alone — a
            text-3xl price and a text button were always going to be tight
            at 2-up card widths) — a full-width button below the price
            gives it room to say "Add to Cart" on one line and a bigger tap
            target, instead of wrapping to two lines in a squeezed row.
            sm+ reverts to the original single-row layout unchanged. */}
        <div className="mt-auto flex flex-col items-stretch gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
          {/* On offer, the struck-through listing price leads and the price
              actually charged follows it at full size — the saving is only
              legible next to what it replaced. priceEffective comes from the
              database's generated column, so this can never disagree with
              what checkout charges. */}
          {/* Charged price first and largest, with the price it replaced
              struck through beside it. Old-price-first is the more common
              order, but a card in a 4-up grid is ~250px wide and that layout
              wrapped to three lines here; leading with the big number keeps
              it to one and still reads as a saving, because the saving is
              only legible next to what it replaced either way.
              priceEffective is the database's generated column, so this can
              never disagree with what checkout charges. */}
          <span className="flex flex-wrap items-baseline justify-center gap-x-2 sm:justify-start">
            <span className="flex items-baseline gap-1.5">
              <span className="text-[10px] tracking-[0.15em] text-ivory-dim uppercase">
                {product.currency}
              </span>
              <span className="font-display text-3xl font-semibold not-italic text-gold tabular-nums">
                {product.priceEffective.toLocaleString("en-US")}
              </span>
            </span>
            {onOffer && (
              <>
                <s className="text-sm text-ivory-dim/70 tabular-nums">
                  {product.price.toLocaleString("en-US")}
                </s>
                <span className="rounded-sm bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] text-gold uppercase">
                  {product.discountAmount > 0
                    ? `-${product.currency} ${product.discountAmount.toLocaleString("en-US")}`
                    : `-${Math.round(product.discountPercent)}%`}
                </span>
              </>
            )}
          </span>
          <button
            type="button"
            disabled={outOfStock}
            onClick={() => {
              addItem({
                productId: product.id,
                name: product.name,
                price: product.priceEffective,
                currency: product.currency,
                image: thumbnail,
              });
              setJustAdded(true);
              if (addedTimer.current) clearTimeout(addedTimer.current);
              addedTimer.current = setTimeout(() => setJustAdded(false), 2000);
            }}
            title={outOfStock ? "Out of stock" : "Add to cart"}
            className={`rounded-md border px-4 py-2 text-[10px] tracking-[0.2em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:group-hover:border-line disabled:group-hover:text-ivory-dim sm:w-auto ${
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
