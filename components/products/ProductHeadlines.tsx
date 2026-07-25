"use client";

import { useEffect, useState } from "react";

const ROTATE_MS = 3800;

/**
 * Three alternate marketing headlines for a product, crossfading in turn —
 * a benefit-led, an ingredient-led, and an aspirational angle rotating
 * under the product name. Static on the first headline under
 * prefers-reduced-motion or if fewer than 2 are non-empty.
 */
export default function ProductHeadlines({ headlines }: { headlines: [string, string, string] }) {
  const active = headlines.filter((h) => h.trim().length > 0);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (active.length < 2) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % active.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [active.length]);

  if (active.length === 0) return null;

  return (
    <p
      key={index}
      aria-live="polite"
      className="product-headline mt-3 max-w-md text-base italic text-sand"
    >
      {active[index]}
    </p>
  );
}
