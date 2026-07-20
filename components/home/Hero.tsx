"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function Hero() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.set("[data-hero-line]", { yPercent: 110 })
        .set("[data-hero-fade]", { opacity: 0, y: 16 })
        .to("[data-hero-overlay]", { opacity: 1, duration: 1.4 }, 0)
        .to(
          "[data-hero-line]",
          { yPercent: 0, duration: 1.3, stagger: 0.12 },
          0.4
        )
        .to(
          "[data-hero-fade]",
          { opacity: 1, y: 0, duration: 1, stagger: 0.15 },
          "-=0.6"
        );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative flex h-[100svh] w-full items-end overflow-hidden bg-ink"
    >
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/videos/hero-atoreum.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />

      {/* gradient overlay: keeps headline legible over the film without
          flattening it — darker at the base where the copy sits */}
      <div
        data-hero-overlay
        className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/30 opacity-0"
      />

      <div className="relative z-10 w-full px-6 pb-16 md:px-12 md:pb-24">
        <div className="mx-auto max-w-[1440px]">
          <p
            data-hero-fade
            className="mb-6 text-xs tracking-[0.3em] text-gold uppercase"
          >
            Seoul to Malé
          </p>

          <h1 className="font-display text-[13vw] leading-[0.95] text-ivory md:text-[6.5vw]">
            <span className="block overflow-hidden">
              <span data-hero-line className="block">
                Atoreum
              </span>
            </span>
            <span className="block overflow-hidden">
              <span data-hero-line className="block text-gold-soft italic">
                MV
              </span>
            </span>
          </h1>

          <p
            data-hero-fade
            className="mt-8 max-w-md text-base leading-relaxed text-ivory-dim md:text-lg"
          >
            Korean beauty, curated for the Maldives — sourced in Seoul,
            formulated for the sun, salt, and humidity of island life.
          </p>
        </div>
      </div>

      <div
        data-hero-fade
        className="absolute right-6 bottom-8 z-10 hidden items-center gap-3 text-[10px] tracking-[0.3em] text-ivory-dim/70 uppercase md:right-12 md:flex"
      >
        <span className="h-8 w-px bg-line" />
        Scroll
      </div>
    </section>
  );
}
