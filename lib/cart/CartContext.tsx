"use client";

import { createContext, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
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
const EMPTY_LINES: CartLine[] = [];

// The cart lives in a module-level external store (not useState) so it can
// be read via useSyncExternalStore — the same fix ThemeToggle already uses
// for the same underlying problem: a lazy useState initializer that reads
// localStorage runs on the client's *first* render too, so whenever a cart
// was already persisted, that first render diverges from the server's
// (always-empty) HTML — exactly the "Open cart (0 items)" vs "(1 item)"
// hydration mismatch this used to produce. getServerSnapshot below always
// returns empty, matching the server render; the real cart is only ever
// visible after hydration completes.
let cartLines: CartLine[] = EMPTY_LINES;
const listeners = new Set<() => void>();
let hydrated = false;

function readPersistedCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistCart(lines: CartLine[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Storage full/unavailable — cart still works for this session.
  }
}

function setCartLines(next: CartLine[]) {
  cartLines = next;
  persistCart(next);
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void) {
  // First subscriber (i.e. the first client render past hydration) pulls
  // in whatever was actually persisted, then immediately notifies so React
  // re-renders with the real cart — mutating `cartLines` alone doesn't
  // trigger a re-render; only calling the listener does.
  if (!hydrated) {
    hydrated = true;
    cartLines = readPersistedCart();
    callback();
  }
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): CartLine[] {
  return cartLines;
}

function getServerSnapshot(): CartLine[] {
  return EMPTY_LINES;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isOpen, setIsOpen] = useState(false);

  const addItem: CartContextValue["addItem"] = (item, quantity = 1) => {
    const existing = cartLines.find((l) => l.productId === item.productId);
    const next = existing
      ? cartLines.map((l) =>
          l.productId === item.productId ? { ...l, quantity: l.quantity + quantity } : l
        )
      : [...cartLines, { ...item, quantity }];
    setCartLines(next);
    setIsOpen(true);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const next =
      quantity <= 0
        ? cartLines.filter((l) => l.productId !== productId)
        : cartLines.map((l) => (l.productId === productId ? { ...l, quantity } : l));
    setCartLines(next);
  };

  const removeItem = (productId: string) => {
    setCartLines(cartLines.filter((l) => l.productId !== productId));
  };

  const clearCart = () => setCartLines([]);

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
