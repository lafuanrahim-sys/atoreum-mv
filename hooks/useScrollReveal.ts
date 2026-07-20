"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

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
}: RevealOptions = {}) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const els = container.querySelectorAll(targets);
    if (!els.length) return;

    const ctx = gsap.context(() => {
      gsap.set(els, { opacity: 0, y });

      gsap.to(els, {
        opacity: 1,
        y: 0,
        duration,
        delay,
        stagger,
        ease: "power3.out",
        scrollTrigger: {
          trigger: container,
          start,
          once: true,
        },
      });
    }, container);

    return () => ctx.revert();
  }, [targets, y, duration, stagger, start, delay]);

  return containerRef;
}
