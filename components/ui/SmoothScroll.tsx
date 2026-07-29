"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();

  // Next's own "scroll to top on navigation" fights Lenis for the same
  // reason any native scrollTo does (see the comment below): Lenis's RAF
  // loop still has last page's scroll as its target and silently restores
  // it on the very next tick, so a Link click could land mid-page instead
  // of at the top. Re-target Lenis itself on every route change — keyed on
  // pathname only, not search params, so in-page filter/query updates
  // (e.g. ProductGrid) don't get yanked back to the top.
  useEffect(() => {
    window.__lenis?.scrollTo(0, { immediate: true });
  }, [pathname]);

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

    // Named + stored, not an inline arrow at both call sites -- gsap.ticker
    // .remove() only recognizes the exact function reference passed to
    // .add(), not a different function with identical code. The previous
    // version passed a fresh arrow function to .remove(), which silently
    // failed to find/remove anything: dead cleanup code that would leak a
    // duplicate RAF-driving callback (still calling .raf() on an already-
    // .destroy()'d lenis instance) on every remount. Harmless today since
    // this mounts once for the whole session, but wrong regardless.
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      window.__lenis = undefined;
      gsap.ticker.remove(tick);
    };
  }, []);

  return <>{children}</>;
}
