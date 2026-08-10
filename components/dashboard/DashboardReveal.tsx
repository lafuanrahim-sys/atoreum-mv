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
    // fromTo, not from. gsap.from() takes the element's CURRENT values as the
    // end state, and React runs effects twice in development -- the second
    // pass started from whatever opacity the first pass had reached and
    // treated that as "finished", leaving the headline figures permanently
    // faint. An explicit end state is idempotent however many times it runs.
    const tween = gsap.fromTo(
      items,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, ease: "power1.out", clearProps: "opacity,transform" }
    );
    return () => {
      tween.kill();
      gsap.set(items, { opacity: 1, y: 0, clearProps: "opacity,transform" });
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
