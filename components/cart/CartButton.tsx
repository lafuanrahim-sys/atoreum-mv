"use client";

import { useCart } from "@/lib/cart/CartContext";

export default function CartButton() {
  const { itemCount, openCart } = useCart();

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={`Open cart (${itemCount} item${itemCount === 1 ? "" : "s"})`}
      className="relative flex h-9 w-9 items-center justify-center text-ivory-dim transition-colors hover:text-gold"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
        <path d="M4 5h2l1.2 10.2A2 2 0 0 0 9.2 17h8.1a2 2 0 0 0 2-1.7L20.5 8H6.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9.5" cy="20.5" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="17.5" cy="20.5" r="1.3" fill="currentColor" stroke="none" />
      </svg>
      {itemCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-medium text-ink">
          {itemCount}
        </span>
      )}
    </button>
  );
}
