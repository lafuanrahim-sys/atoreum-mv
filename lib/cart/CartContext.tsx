"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Currency } from "@/lib/types";

export type CartLine = {
  productId: string;
  name: string;
  price: number;
  currency: Currency;
  image: string | null;
  quantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  currency: Currency | null;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartLine, "quantity">, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "atoreum-cart";

function readPersistedCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  // Lazy initializer (not an effect) so there's no setState-after-mount
  // render flicker — matches the same pattern already used elsewhere in
  // this codebase (e.g. ThemeToggle) for reading browser-only state.
  const [lines, setLines] = useState<CartLine[]>(() => readPersistedCart());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Storage full/unavailable — cart still works for this session.
    }
  }, [lines]);

  const addItem: CartContextValue["addItem"] = (item, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === item.productId);
      if (existing) {
        return prev.map((l) =>
          l.productId === item.productId ? { ...l, quantity: l.quantity + quantity } : l
        );
      }
      return [...prev, { ...item, quantity }];
    });
    setIsOpen(true);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.productId !== productId)
        : prev.map((l) => (l.productId === productId ? { ...l, quantity } : l))
    );
  };

  const removeItem = (productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  };

  const clearCart = () => setLines([]);

  const { itemCount, subtotal, currency } = useMemo(() => {
    return {
      itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
      subtotal: lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
      currency: lines[0]?.currency ?? null,
    };
  }, [lines]);

  return (
    <CartContext.Provider
      value={{
        lines,
        itemCount,
        subtotal,
        currency,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
