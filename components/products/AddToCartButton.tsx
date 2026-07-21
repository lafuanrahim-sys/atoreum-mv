"use client";

import { useState } from "react";
import type { Product } from "@/lib/products";
import { useCart } from "@/lib/cart/CartContext";

export default function AddToCartButton({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const outOfStock = product.stockStatus === "out-of-stock";

  const handleAdd = () => {
    addItem(
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        currency: product.currency,
        image: product.images[0] ?? null,
      },
      quantity
    );
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex items-center border border-line">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={outOfStock}
          aria-label="Decrease quantity"
          className="px-4 py-3 text-ivory-dim hover:text-gold disabled:opacity-40"
        >
          −
        </button>
        <span className="min-w-[3ch] text-center text-sm text-ivory">{quantity}</span>
        <button
          type="button"
          onClick={() => setQuantity((q) => q + 1)}
          disabled={outOfStock}
          aria-label="Increase quantity"
          className="px-4 py-3 text-ivory-dim hover:text-gold disabled:opacity-40"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        disabled={outOfStock}
        className="flex-1 bg-gold px-8 py-4 text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold/90 disabled:cursor-not-allowed disabled:bg-charcoal disabled:text-ivory-dim"
      >
        {outOfStock ? "Out of Stock" : justAdded ? "Added ✓" : "Add to Cart"}
      </button>
    </div>
  );
}
