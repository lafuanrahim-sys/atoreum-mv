"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

/**
 * Site-wide smooth scroll. Lenis drives the actual scroll physics;
 * GSAP's ticker drives the RAF loop so ScrollTrigger stays in sync
 * with Lenis instead of fighting it (the #1 cause of janky, laggy
 * scroll-linked animation).
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    // Lenis owns the RAF-driven scroll position, so any *other* code that
    // moves scroll natively (e.g. element.scrollIntoView()) gets silently
    // overwritten on the very next tick. Exposing the instance lets call
    // sites go through lib/motion.ts's scrollToElement() instead.
    window.__lenis = lenis;

    lenis.on("scroll", ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      window.__lenis = undefined;
      gsap.ticker.remove((time) => lenis.raf(time * 1000));
    };
  }, []);

  return <>{children}</>;
}
