"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart/CartContext";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

export default function CartDrawer() {
  const { lines, subtotal, currency, isOpen, closeCart, updateQuantity, removeItem } = useCart();

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-ink/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeCart}
        aria-hidden="true"
      />

      <aside
        className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-md flex-col border-l border-ivory/10 bg-ink-2/75 shadow-2xl backdrop-blur-xl backdrop-saturate-150 transition-transform duration-300"
        // Composed with the visual-viewport offset (see
        // lib/layout/VisualViewportSync.tsx) so the drawer stays pinned to
        // what's actually visible instead of the layout viewport's fixed
        // origin when pinch-zoomed/panned -- the slide-in/out translateX
        // moved from a Tailwind class to here so both transforms can
        // combine in one declaration (only one `transform` wins otherwise).
        style={{
          transform: `translate(var(--vv-offset-x, 0px), var(--vv-offset-y, 0px)) translateX(${isOpen ? "0" : "100%"})`,
        }}
        role="dialog"
        aria-label="Shopping cart"
        aria-hidden={!isOpen}
        // inert removes the closed drawer's buttons/links from tab order and
        // the accessibility tree — aria-hidden alone left them keyboard-
        // reachable behind the viewport edge.
        inert={!isOpen}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="font-display text-lg text-ivory">Your Cart</h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="text-ivory-dim transition-colors hover:text-gold"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {lines.length === 0 ? (
            <p className="text-sm text-ivory-dim">Your cart is empty.</p>
          ) : (
            <ul className="flex flex-col gap-6">
              {lines.map((line) => (
                <li key={line.productId} className="flex gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-sm bg-photo-well">
                    {line.image ? (
                      <div className="absolute inset-1.5">
                        <Image src={line.image} alt={line.name} fill className="object-contain" />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <p className="font-display text-sm text-ivory">{line.name}</p>
                    <p className="mt-1 text-xs text-ivory-dim tabular-nums">
                      {formatPrice(line.price, line.currency)}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center border border-line">
                        <button
                          type="button"
                          onClick={() => updateQuantity(line.productId, line.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="px-2 py-1 text-ivory-dim hover:text-gold"
                        >
                          −
                        </button>
                        <span className="min-w-[2ch] text-center text-xs text-ivory">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(line.productId, line.quantity + 1)}
                          aria-label="Increase quantity"
                          className="px-2 py-1 text-ivory-dim hover:text-gold"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(line.productId)}
                        className="text-[10px] uppercase tracking-[0.15em] text-ivory-dim hover:text-gold"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lines.length > 0 && (
          <div className="border-t border-line px-6 py-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ivory-dim uppercase tracking-[0.15em] text-xs">Subtotal</span>
              <span className="text-ivory tabular-nums">{formatPrice(subtotal, currency ?? "MVR")}</span>
            </div>
            <Link
              href="/checkout"
              onClick={closeCart}
              className="mt-6 flex w-full items-center justify-center bg-gold-deep px-6 py-4 text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-deep/90"
            >
              Checkout
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
