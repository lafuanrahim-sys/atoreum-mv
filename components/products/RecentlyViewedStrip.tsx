"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/products";
import { useSession } from "@/lib/auth/SessionContext";

const STORAGE_KEY = "atoreum_recently_viewed";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

/**
 * Reads the id list TrackRecentlyViewed wrote from the product detail page
 * and resolves it against the already-fetched catalog — client-only by
 * nature (localStorage), so this always starts empty on the server and
 * fills in after mount; the resulting pop-in is expected for a
 * per-visitor personalization strip like this.
 *
 * Signed-out visitors get it reset rather than shown: the history is tied
 * to the account (see TrackRecentlyViewed), so once the session resolves
 * to logged-out — including someone who just signed out on this same
 * device — any leftover entries are stale/not theirs and get cleared.
 */
export default function RecentlyViewedStrip({ products }: { products: Product[] }) {
  const [items, setItems] = useState<Product[]>([]);
  const { loggedIn } = useSession();

  useEffect(() => {
    if (loggedIn === null) return; // session still resolving — wait rather than flash/clear early
    if (!loggedIn) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Private-browsing / storage-disabled — nothing to reset.
      }
      setItems([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const byId = new Map(products.map((p) => [p.id, p]));
      setItems(ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p)));
    } catch {
      // Private-browsing / storage-disabled — just skip the strip.
    }
  }, [products, loggedIn]);

  if (items.length === 0) return null;

  return (
    <div className="border-b border-line pb-10">
      <h2 className="text-xs uppercase tracking-[0.2em] text-ivory">Recently Viewed</h2>
      <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
        {items.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="group flex w-32 shrink-0 flex-col gap-2"
          >
            <div className="relative aspect-square overflow-hidden rounded-sm bg-photo-well">
              {product.images[0] ? (
                <div className="absolute inset-3">
                  <Image src={product.images[0]} alt="" fill sizes="128px" className="object-contain" />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display text-2xl text-ivory-dim/20">{product.brand.charAt(0)}</span>
                </div>
              )}
            </div>
            <div>
              <p className="truncate text-xs text-ivory transition-colors group-hover:text-gold">{product.name}</p>
              <p className="text-[11px] text-ivory-dim tabular-nums">{formatPrice(product.price, product.currency)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
