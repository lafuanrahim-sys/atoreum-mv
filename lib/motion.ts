import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const motionDefaults = {
  ease: "power3.out",
  durations: {
    long: 1.2,
    medium: 0.95,
    short: 0.6,
  },
};

export function prefersReducedMotion() {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function reveal(els: Element[] | NodeListOf<Element>, options: {
  y?: number;
  duration?: number;
  stagger?: number;
  delay?: number;
  start?: string;
  trigger?: Element | string;
  ease?: string;
} = {}) {
  const { y = 32, duration = motionDefaults.durations.long, stagger = 0.12, delay = 0, start = "top 80%", trigger = undefined, ease = motionDefaults.ease } = options;

  if (!els || (Array.isArray(els) && els.length === 0) || (NodeList.prototype.isPrototypeOf(els) && (els as NodeListOf<Element>).length === 0)) return;

  const target = els as unknown as Element | Element[] | NodeListOf<Element>;

  if (prefersReducedMotion()) {
    gsap.set(target, { opacity: 1, y: 0, clearProps: "all" });
    return;
  }

  gsap.set(target, { opacity: 0, y });

  const triggerElement = (trigger as Element) || (Array.isArray(els) ? (els as Element[])[0]?.parentElement : (els as NodeListOf<Element>)[0]?.parentElement);

  gsap.to(target, {
    opacity: 1,
    y: 0,
    duration,
    delay,
    stagger,
    ease,
    scrollTrigger: {
      trigger: triggerElement,
      start,
      once: true,
    },
  });
}

/**
 * Depth variant of `reveal()` — a tilted glass pane settling into place
 * (rotateX + scale + opacity) instead of a flat rise. Deliberately kept
 * separate and used sparingly, reserved for the handful of moments meant
 * to echo the hero's 3D staging rather than replacing the default reveal.
 */
export function depthReveal(els: Element[] | NodeListOf<Element>, options: {
  duration?: number;
  stagger?: number;
  delay?: number;
  start?: string;
  trigger?: Element | string;
  ease?: string;
  rotateX?: number;
} = {}) {
  const { duration = motionDefaults.durations.long, stagger = 0.12, delay = 0, start = "top 80%", trigger = undefined, ease = motionDefaults.ease, rotateX = 10 } = options;

  if (!els || (Array.isArray(els) && els.length === 0) || (NodeList.prototype.isPrototypeOf(els) && (els as NodeListOf<Element>).length === 0)) return;

  const target = els as unknown as Element | Element[] | NodeListOf<Element>;

  if (prefersReducedMotion()) {
    gsap.set(target, { opacity: 1, rotateX: 0, scale: 1, clearProps: "all" });
    return;
  }

  gsap.set(target, { opacity: 0, rotateX, scale: 0.94, transformPerspective: 800, transformOrigin: "top center" });

  const triggerElement = (trigger as Element) || (Array.isArray(els) ? (els as Element[])[0]?.parentElement : (els as NodeListOf<Element>)[0]?.parentElement);

  gsap.to(target, {
    opacity: 1,
    rotateX: 0,
    scale: 1,
    duration,
    delay,
    stagger,
    ease,
    scrollTrigger: {
      trigger: triggerElement,
      start,
      once: true,
    },
  });
}

/**
 * Scrub-tied background parallax for full-bleed hero media. Applied to the
 * decorative image layer only (never text/controls), with a deliberately
 * small travel so foreground and background never desync distractingly.
 * The layer must bleed past its section (e.g. top/bottom -8%) so the drift
 * never exposes an edge.
 */
export function parallax(el: Element, options: {
  trigger: Element;
  yPercent?: number;
} ) {
  const { trigger, yPercent = 8 } = options;
  if (prefersReducedMotion()) return;

  gsap.to(el, {
    yPercent,
    ease: "none",
    scrollTrigger: {
      trigger,
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });
}

/**
 * Masked word-by-word headline reveal: animates the [data-word] spans that
 * <WordMask> (components/ui/WordMask.tsx) renders — each word rises from
 * behind its own overflow-hidden mask with a slight settle, staggered
 * across the line. Deliberately does NOT split text at runtime: rewriting a
 * React-rendered heading's innerHTML leaves React reconciling against
 * removed nodes (removeChild crashes). Reserved for short display
 * headlines — never body copy.
 */
export function splitWordReveal(el: Element, options: {
  trigger?: Element;
  start?: string;
  stagger?: number;
} = {}) {
  const { trigger = el, start = "top 82%", stagger = 0.07 } = options;
  const words = el.querySelectorAll<HTMLElement>("[data-word]");
  if (words.length === 0 || prefersReducedMotion()) return;

  gsap.set(words, { yPercent: 110, rotate: 3, transformOrigin: "0% 100%" });

  // A ScrollTrigger created when its start line is already behind the
  // scroll position (above-the-fold titles, client-side navigations) may
  // not fire until the next scroll tick — headlines above the fold play
  // straight away instead.
  const inViewAlready = el.getBoundingClientRect().top < window.innerHeight * 0.9;

  gsap.to(words, {
    yPercent: 0,
    rotate: 0,
    duration: 0.9,
    stagger,
    ease: "expo.out",
    delay: inViewAlready ? 0.15 : 0,
    ...(inViewAlready ? {} : { scrollTrigger: { trigger, start, once: true } }),
  });
}

export function clamp(min: number, max: number, v: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Scrolls to an element (or absolute y position). The site drives scroll
 * through Lenis (see components/ui/SmoothScroll.tsx), which re-applies its
 * own tracked position every RAF tick — a plain element.scrollIntoView()
 * gets overwritten within a frame and silently does nothing. Goes through
 * Lenis when it's mounted; falls back to native scrolling otherwise (e.g.
 * during the brief window before SmoothScroll's effect has run).
 */
export function scrollToElement(target: Element | number, options: { offset?: number } = {}) {
  const { offset = 0 } = options;
  const lenis = typeof window !== "undefined" ? window.__lenis : undefined;

  if (lenis) {
    lenis.scrollTo(target, { offset, immediate: prefersReducedMotion() });
    return;
  }

  if (typeof target === "number") {
    window.scrollTo({ top: target + offset, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  } else {
    target.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }
}
