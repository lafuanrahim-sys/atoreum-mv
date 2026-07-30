"use client";

import { useEffect } from "react";

/**
 * `position: fixed` elements (Header, CartDrawer) anchor to the *layout*
 * viewport, which never moves -- but pinch-zooming/panning on mobile moves
 * the *visual* viewport around inside it, and browsers don't re-anchor
 * fixed elements to follow. The header can end up visually stranded
 * somewhere that no longer matches what's actually on screen (a
 * long-documented WebKit quirk, worse combined with a scroll-hijacking
 * library like the Lenis setup in SmoothScroll.tsx). Mirrors
 * visualViewport's offset onto two CSS custom properties on <html> so any
 * fixed element can opt in with `transform: translate(var(--vv-offset-x,
 * 0px), var(--vv-offset-y, 0px))` and stay pinned to what the user is
 * actually looking at instead of the layout viewport's fixed origin.
 *
 * No-op (properties stay at their 0px fallback) in browsers without the
 * visualViewport API -- nothing to compensate for there.
 */
export default function VisualViewportSync() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const sync = () => {
      root.style.setProperty("--vv-offset-x", `${vv.offsetLeft}px`);
      root.style.setProperty("--vv-offset-y", `${vv.offsetTop}px`);
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  return null;
}
