"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "@/lib/motion";

gsap.registerPlugin(ScrollTrigger);

export default function IntroSection() {
  const sectionRef = useRef<HTMLElement | null>(null);

  // Two bespoke moments, both tied to the story rather than generic reveals:
  //
  // 1. Condensation focus — the headline and copy sharpen from a soft blur as
  //    they cross the viewport, scrubbed to the scrollbar: mist wiped from a
  //    mirror, read at the reader's own pace.
  // 2. The route line — the story is Korea → Malé, and the stats row already
  //    reads "1 · Korea · Malé", so the gold hairline above it draws itself
  //    across and each stat surfaces as the line passes it. The line is the
  //    journey, not decoration.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.from(".intro-eyebrow", {
        opacity: 0,
        y: 14,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: { trigger: section, start: "top 80%", once: true },
      });

      gsap.utils.toArray<Element>(".intro-focus").forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0.1, y: 26, filter: "blur(9px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            ease: "none",
            scrollTrigger: { trigger: el, start: "top 94%", end: "top 58%", scrub: 0.6 },
          }
        );
      });

      const stats = section.querySelectorAll(".intro-stat");
      gsap.set(stats, { opacity: 0, y: 18 });
      gsap
        .timeline({
          scrollTrigger: { trigger: ".intro-stats", start: "top 82%", once: true },
        })
        .fromTo(
          ".intro-route",
          { scaleX: 0 },
          { scaleX: 1, duration: 1.5, ease: "power2.inOut" },
          0
        )
        // Stat delays approximate the line passing each column.
        .to(stats, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out", stagger: 0.3 }, 0.2);
    }, section);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="page-gutter bg-ink py-28 md:py-40">
      <div className="grid gap-12 md:grid-cols-12">
        <div className="intro-eyebrow md:col-span-4">
          <p className="text-xs tracking-[0.3em] text-gold uppercase">
            Our Story
          </p>
        </div>

        <div className="md:col-span-8">
          <h2 className="intro-focus font-display text-3xl leading-[1.2] text-ivory md:text-[2.75rem]">
            Atoreum MV launches Lebelage with a curated island edit.
          </h2>

          <p className="intro-focus mt-8 max-w-2xl text-base leading-relaxed text-ivory-dim md:text-lg">
            Every formula is selected for Atoreum MV&apos;s first launch — active
            Korean ingredients, elegant textures, and formulas made to perform
            under Maldives light and humidity.
          </p>

          <div className="intro-stats relative mt-12 grid grid-cols-2 gap-8 border-t border-line pt-8 sm:grid-cols-3">
            <div
              aria-hidden="true"
              className="intro-route absolute left-0 top-[-1px] h-px w-full origin-left bg-gold"
            />
            <div className="intro-stat">
              <p className="font-display text-5xl font-bold tracking-tight text-gold md:text-6xl">1</p>
              <p className="mt-3 text-xs tracking-[0.15em] text-ivory-dim uppercase">
                Official Lebelage launch
              </p>
            </div>
            <div className="intro-stat">
              <p className="font-display text-5xl font-bold tracking-tight text-gold md:text-6xl">Korea</p>
              <p className="mt-3 text-xs tracking-[0.15em] text-ivory-dim uppercase">
                Sourced Directly
              </p>
            </div>
            <div className="intro-stat">
              <p className="font-display text-5xl font-bold tracking-tight text-gold md:text-6xl">Malé</p>
              <p className="mt-3 text-xs tracking-[0.15em] text-ivory-dim uppercase">
                Based &amp; Delivered
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
