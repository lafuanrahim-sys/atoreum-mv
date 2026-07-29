"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Staggers this element's direct children in on mount -- a "Subtle" tier
 * stagger (opacity + small y, no overshoot easing) matched to dense,
 * informational UI rather than a marketing page; back.out-style bounce
 * reads as sloppy on data. Client-only wrapper around otherwise-static
 * Server Component markup, so a data-heavy dashboard page doesn't need to
 * become a client component just to animate its own entrance.
 */
export default function DashboardReveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const items = el.children;
    if (items.length === 0) return;
    gsap.from(items, { opacity: 0, y: 10, duration: 0.35, stagger: 0.06, ease: "power1.out" });
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
