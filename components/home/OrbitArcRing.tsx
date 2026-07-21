"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const ROTATION_MS = 120000; // one full 360° revolution every 120s

type CategoryItem = {
  label: string;
  href: string;
  /** Real product photo path — omit to fall back to the placeholder tile. */
  image?: string;
};

// Exact order/names as specified. Each links to its nearest real category
// filter (see lib/products.ts) so every item is a working link even before
// real per-category photography exists.
const CATEGORIES: CategoryItem[] = [
  { label: "Ampoule", href: "/products?category=Skincare" },
  { label: "Cream", href: "/products?category=Skincare" },
  { label: "Foam", href: "/products?category=Skincare" },
  { label: "Sun Care", href: "/products?category=Suncare" },
  { label: "Toner", href: "/products?category=Skincare" },
  { label: "Mask Pack", href: "/products?category=Skincare" },
  { label: "Foam Pack 2in1", href: "/products?category=Skincare" },
  { label: "Toner Pad", href: "/products?category=Skincare" },
  { label: "Lotion", href: "/products?category=Skincare" },
  { label: "Make-up", href: "/products?category=Makeup" },
  { label: "Eye Cream", href: "/products?category=Skincare" },
  { label: "Soothing Gel", href: "/products?category=Skincare" },
  { label: "Emulsion", href: "/products?category=Skincare" },
  { label: "Essence", href: "/products?category=Skincare" },
  { label: "Etc.", href: "/products" },
];

function CategoryTile({
  label,
  image,
  index,
}: {
  label: string;
  image?: string;
  index: number;
}) {
  if (image) {
    return (
      <Image
        src={image}
        alt={label}
        fill
        sizes="(min-width: 768px) 8rem, 5rem"
        className="rounded-2xl object-cover"
      />
    );
  }

  const variant = index % 2 === 0 ? "from-ink-2 to-charcoal" : "from-charcoal to-ink-2";
  return (
    <div
      className={`flex h-full w-full items-center justify-center rounded-2xl border border-line bg-gradient-to-br px-2 text-center ${variant}`}
    >
      <span className="text-[9px] font-medium uppercase leading-tight tracking-[0.1em] text-ivory-dim sm:text-[10px]">
        {label}
      </span>
    </div>
  );
}

export default function OrbitArcRing() {
  const ringRef = useRef<HTMLDivElement | null>(null);
  const innerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handle = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);

  // Single computed-angle-per-frame loop: the ring and every card's inner
  // counter-rotation read the exact same `angle`, so they can never drift
  // apart the way two independent CSS keyframe animations eventually would.
  useEffect(() => {
    if (reduceMotion) return;
    let rafId: number;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const angle = ((elapsed / ROTATION_MS) * 360) % 360;

      if (ringRef.current) {
        ringRef.current.style.transform = `rotate(${angle}deg)`;
      }
      for (const el of innerRefs.current) {
        if (el) el.style.transform = `translate(-50%, -50%) rotate(${-angle}deg)`;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [reduceMotion]);

  const total = CATEGORIES.length;

  return (
    <div
      className="orbit-arc pointer-events-none absolute left-1/2 top-1/2 h-0 w-0 [--item-size:calc(var(--ring-radius)*0.4)] [--ring-radius:clamp(9rem,20vmin,18rem)]"
    >
      {/* Every card uses the exact same --ring-radius — only its angle
          differs — so all 15 sit at an identical distance from the logo's
          center point. Center-anchor is zero-sized so left-1/2/top-1/2
          alone center it on both axes. */}
      <div ref={ringRef} className="absolute left-0 top-0">
        {CATEGORIES.map((category, index) => {
          const angle = (index / total) * 360;

          return (
            <div
              key={category.label}
              className="ring-item pointer-events-auto absolute left-0 top-0"
              style={{
                // Outer wrapper: position only. Places the card at `angle`
                // around the shared radius, then rotates back by -angle so
                // this element's own local frame is unrotated — all of the
                // rotation from placing it lives here and nowhere else.
                transform: `rotate(${angle}deg) translateX(var(--ring-radius)) rotate(${-angle}deg)`,
              }}
            >
              <div
                ref={(el) => {
                  innerRefs.current[index] = el;
                }}
                className="ring-item-inner"
                style={{ transform: "translate(-50%, -50%)" }}
              >
                <div
                  className={`ring-item-card transition-[filter,opacity] duration-300 ease-out ${
                    hoveredIndex !== null && hoveredIndex !== index
                      ? "blur-[6px] opacity-50"
                      : "blur-0 opacity-100"
                  }`}
                  style={{ width: "var(--item-size)", height: "var(--item-size)" }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <Link
                    href={category.href}
                    aria-label={category.label}
                    title={category.label}
                    className="relative block h-full w-full overflow-hidden rounded-2xl shadow-sm"
                  >
                    <CategoryTile label={category.label} image={category.image} index={index} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CSS :has() fallback for the hover-blur, matching the JS-driven
          state above. */}
      <style>{`
        .orbit-arc:has(.ring-item:hover) .ring-item:not(:hover) .ring-item-card {
          filter: blur(6px);
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}
