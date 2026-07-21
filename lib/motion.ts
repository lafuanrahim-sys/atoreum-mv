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

export function clamp(min: number, max: number, v: number) {
  return Math.max(min, Math.min(max, v));
}
