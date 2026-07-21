"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reveal, depthReveal } from "@/lib/motion";

gsap.registerPlugin(ScrollTrigger);

type RevealOptions = {
  /** CSS selector, scoped to the container, for the elements to stagger in. */
  targets?: string;
  y?: number;
  duration?: number;
  stagger?: number;
  /** Where in the viewport the trigger fires. */
  start?: string;
  delay?: number;
  /** "fade" (default) rises in flat; "depth" tilts in as a settling glass pane. */
  variant?: "fade" | "depth";
};

/**
 * Attaches a single fade + rise reveal, triggered once the section
 * crosses into view. Deliberately one animation vocabulary reused
 * everywhere — consistency is what makes motion feel premium instead
 * of decorative.
 */
export function useScrollReveal<T extends HTMLElement>({
  targets = "[data-reveal]",
  y = 32,
  duration = 1.1,
  stagger = 0.12,
  start = "top 80%",
  delay = 0,
  variant = "fade",
}: RevealOptions = {}) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const els = container.querySelectorAll(targets);
        if (!els.length) return;

        const ctx = gsap.context(() => {
          // delegate to centralized motion utilities for consistent timing & reduced-motion handling
          if (variant === "depth") {
            depthReveal(els, { duration, stagger, delay, start, trigger: container });
          } else {
            reveal(els, { y, duration, stagger, delay, start, trigger: container });
          }
        }, container);

        return () => ctx.revert();
      }, [targets, y, duration, stagger, start, delay, variant]);

  return containerRef;
}
