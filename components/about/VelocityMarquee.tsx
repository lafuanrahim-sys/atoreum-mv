"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "@/lib/motion";

gsap.registerPlugin(ScrollTrigger);

const PHRASE = "Korea sourced · Malé delivered · Island ready · Lebelage official ·";

/**
 * A strip of oversized outlined display type that drifts sideways on its
 * own and reacts to how the page is scrolled: scroll velocity feeds both
 * its speed and a slight italic skew, and scrolling upward reverses its
 * direction. The strip is duplicated so the loop is seamless.
 *
 * Decorative only (aria-hidden); static under reduced motion.
 */
export default function VelocityMarquee() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const row = section.querySelector<HTMLElement>(".marquee-row");
      if (!row) return;

      // Base drift: a seamless -50% loop over the duplicated content.
      const loop = gsap.to(row, {
        xPercent: -50,
        duration: 28,
        ease: "none",
        repeat: -1,
      });

      // Scroll velocity modulates speed/direction and a slight skew.
      // quickTo keeps per-event tween churn off the main thread's back.
      const skewTo = gsap.quickTo(row, "skewX", { duration: 0.5, ease: "power2.out" });
      let speedTween: gsap.core.Tween | null = null;

      ScrollTrigger.create({
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          const velocity = self.getVelocity();
          const direction = velocity < 0 ? -1 : 1;
          const speed = gsap.utils.clamp(0.4, 4, Math.abs(velocity) / 350);
          speedTween?.kill();
          speedTween = gsap.to(loop, {
            timeScale: direction * speed,
            duration: 0.4,
            ease: "power2.out",
            overwrite: true,
          });
          skewTo(gsap.utils.clamp(-8, 8, velocity / 400));
        },
      });

      // Settle back to the resting drift when scrolling stops.
      let settle: ReturnType<typeof setTimeout>;
      const onScrollEnd = () => {
        clearTimeout(settle);
        settle = setTimeout(() => {
          gsap.to(loop, { timeScale: 1, duration: 0.8, ease: "power2.out" });
          skewTo(0);
        }, 150);
      };
      window.addEventListener("scroll", onScrollEnd, { passive: true });

      return () => {
        window.removeEventListener("scroll", onScrollEnd);
        clearTimeout(settle);
      };
    }, section);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-hidden="true"
      className="relative w-full select-none overflow-hidden border-y border-line bg-ink py-6 md:py-8"
    >
      <div className="marquee-row flex w-max whitespace-nowrap will-change-transform">
        {[0, 1].map((copy) => (
          <span
            key={copy}
            className="marquee-text pr-8 font-display text-5xl uppercase leading-none tracking-[0.08em] md:text-7xl"
          >
            {PHRASE}&nbsp;
          </span>
        ))}
      </div>

      <style>{`
        .marquee-text {
          color: transparent;
          -webkit-text-stroke: 1px var(--gold);
          opacity: 0.55;
        }
      `}</style>
    </section>
  );
}
