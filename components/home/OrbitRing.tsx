"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const ROTATION_MS = 120000; // one full 360° revolution every 120s

type Category = {
  label: string;
  href: string;
  scale: number;
  icon: "droplet" | "sun" | "lip" | "comb" | "flacon" | "gift";
};

// Real product categories (see lib/products.ts) plus sensible sub-category
// placeholders, each linking to its nearest real category filter so every
// item is a working link even though the catalog only has 3 seed products.
const CATEGORIES: Category[] = [
  { label: "Skincare", href: "/products?category=Skincare", scale: 1, icon: "droplet" },
  { label: "Suncare", href: "/products?category=Suncare", scale: 0.88, icon: "sun" },
  { label: "Makeup", href: "/products?category=Makeup", scale: 1.1, icon: "lip" },
  { label: "Haircare", href: "/products?category=Haircare", scale: 0.95, icon: "comb" },
  { label: "Fragrance", href: "/products?category=Fragrance", scale: 1.05, icon: "flacon" },
  { label: "Serums", href: "/products?category=Skincare", scale: 0.9, icon: "droplet" },
  { label: "Sun Sticks", href: "/products?category=Suncare", scale: 1.08, icon: "sun" },
  { label: "Lip Color", href: "/products?category=Makeup", scale: 1, icon: "lip" },
  { label: "Hair Oil", href: "/products?category=Haircare", scale: 0.93, icon: "comb" },
  { label: "Eau de Parfum", href: "/products?category=Fragrance", scale: 1.12, icon: "flacon" },
  { label: "Cleansers", href: "/products?category=Skincare", scale: 0.97, icon: "droplet" },
  { label: "Gift Sets", href: "/products", scale: 1.03, icon: "gift" },
];

function CategoryIcon({ type }: { type: Category["icon"] }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case "droplet":
      return (
        <svg {...common} className="h-1/2 w-1/2">
          <path d="M12 3.5c3 3.7 5.5 6.8 5.5 9.9a5.5 5.5 0 0 1-11 0c0-3.1 2.5-6.2 5.5-9.9Z" />
        </svg>
      );
    case "sun":
      return (
        <svg {...common} className="h-1/2 w-1/2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" />
        </svg>
      );
    case "lip":
      return (
        <svg {...common} className="h-1/2 w-1/2">
          <path d="M4 9c1.8-2 3.6-3 5-3 1.2 0 2 .8 3 .8s1.8-.8 3-.8c1.4 0 3.2 1 5 3-1 4-3.6 8.5-8 8.5S5 13 4 9Z" />
          <path d="M4 9c2.2 1 4 1.4 8 1.4S17.8 10 20 9" />
        </svg>
      );
    case "comb":
      return (
        <svg {...common} className="h-1/2 w-1/2">
          <path d="M5 4h14v3H5z" />
          <path d="M6.5 7v13M9.5 7v13M12.5 7v13M15.5 7v13M18.5 7v13" />
        </svg>
      );
    case "flacon":
      return (
        <svg {...common} className="h-1/2 w-1/2">
          <path d="M10 3h4M11 3v3.2c0 .5-.2 1-.6 1.3C9 8.7 8 10.4 8 12.5V19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-6.5c0-2.1-1-3.8-2.4-4.9-.4-.4-.6-.8-.6-1.3V3" />
          <path d="M8.5 13h7" />
        </svg>
      );
    case "gift":
      return (
        <svg {...common} className="h-1/2 w-1/2">
          <rect x="4" y="9" width="16" height="11" rx="1" />
          <path d="M4 9h16M12 9v11" />
          <path d="M12 9C9.5 9 8 7.8 8 6.2 8 4.9 9 4 10.2 4c1.6 0 1.8 2.5 1.8 5Z" />
          <path d="M12 9c2.5 0 4-1.2 4-2.8C16 4.9 15 4 13.8 4c-1.6 0-1.8 2.5-1.8 5Z" />
        </svg>
      );
  }
}

export default function OrbitRing() {
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

  // Single computed-angle-per-frame loop: the ring and every item's inner
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
      className="orbit-ring pointer-events-none absolute left-1/2 top-1/2 h-0 w-0 [--orbit-radius:7rem] sm:[--orbit-radius:9.5rem] md:[--orbit-radius:12.5rem] lg:[--orbit-radius:15.5rem] xl:[--orbit-radius:18rem]"
    >
      <div ref={ringRef} className="absolute left-0 top-0">
        {CATEGORIES.map((category, index) => {
          const baseAngle = (360 / total) * index;
          // Skip every other item on mobile so the ring doesn't feel crowded;
          // spacing stays even since halving 12 evenly-spaced items still
          // leaves an evenly-spaced set of 6.
          const reduceOnMobile = index % 2 === 1;

          return (
            <div
              key={category.label}
              className={`ring-item pointer-events-auto absolute left-0 top-0 ${
                reduceOnMobile ? "hidden sm:block" : ""
              }`}
              style={{
                transform: `rotate(${baseAngle}deg) translateX(var(--orbit-radius)) rotate(${-baseAngle}deg)`,
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
                  style={{ transform: `scale(${category.scale})` }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <Link
                    href={category.href}
                    aria-label={category.label}
                    title={category.label}
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-ink-2 text-ivory-dim shadow-sm transition-colors duration-300 hover:border-gold hover:text-gold sm:h-16 sm:w-16 md:h-20 md:w-20"
                  >
                    <CategoryIcon type={category.icon} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CSS :has() fallback for the hover-blur, matching the JS-driven state
          above — belt-and-suspenders per spec; browsers without :has()
          support still get the effect purely from the React state path. */}
      <style>{`
        .orbit-ring:has(.ring-item:hover) .ring-item:not(:hover) .ring-item-card {
          filter: blur(6px);
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}
