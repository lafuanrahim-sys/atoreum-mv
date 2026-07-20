"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function Hero() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.set("[data-hero-line]", { yPercent: 110 })
        .set("[data-hero-fade]", { opacity: 0, y: 18 })
        .to("[data-hero-overlay]", { opacity: 1, duration: 1.1 }, 0)
        .to(
          "[data-hero-line]",
          { yPercent: 0, duration: 1.05, stagger: 0.14 },
          0.2
        )
        .to(
          "[data-hero-fade]",
          { opacity: 1, y: 0, duration: 1, stagger: 0.11 },
          "-=0.72"
        );

      gsap.to("[data-hero-scroll]", {
        y: 10,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut",
        duration: 1.2,
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative flex h-[100svh] w-full items-end overflow-hidden bg-ink"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(201,161,90,0.12),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(244,239,228,0.08),_transparent_30%)]" />
      <div
        data-hero-overlay
        className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/95 opacity-0"
      />

      <div className="relative z-10 w-full px-6 pb-16 md:px-12 md:pb-24">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p
                data-hero-fade
                className="text-xs tracking-[0.3em] text-gold uppercase"
              >
                Seoul to Malé
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span className="h-px w-16 bg-gold" />
                <span className="text-[10px] tracking-[0.35em] uppercase text-ivory-dim">
                  Quiet. Considered. Minimal.
                </span>
              </div>
            </div>

            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-none border border-gold px-8 py-4 text-xs tracking-[0.25em] text-gold uppercase transition-colors hover:bg-gold hover:text-ink"
              data-hero-fade
            >
              Shop the edit
            </Link>
          </div>

          <div className="grid gap-4 md:max-w-3xl">
            <div className="flex items-center gap-6">
              <div className="h-24 w-24 rounded-full border border-line bg-ink-2 p-3 md:h-28 md:w-28">
                <img
                  src="/atoreum-logo.svg"
                  alt="Atoreum logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <h1 className="font-display text-[12vw] leading-[0.92] text-ivory md:text-[6.5rem]">
                <span className="block overflow-hidden">
                  <span data-hero-line className="block">Atoreum</span>
                </span>
                <span className="block overflow-hidden">
                  <span data-hero-line className="block text-gold-soft italic">MV</span>
                </span>
              </h1>
            </div>
            <p
              data-hero-fade
              className="max-w-2xl text-base leading-relaxed text-ivory-dim md:text-lg"
            >
              A distilled entry point to Korean beauty for resort life — quiet
              styling, premium formulas, and a minimal finish.
            </p>
          </div>
        </div>
      </div>

      <div className="absolute left-6 top-1/2 hidden h-[140px] w-px bg-line md:block" />
      <div className="absolute right-6 bottom-8 z-10 hidden items-center gap-4 md:flex">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-line">
          <span
            data-hero-scroll
            className="h-2.5 w-2.5 rounded-full bg-gold"
          />
        </div>
        <div className="flex flex-col items-start text-[10px] uppercase tracking-[0.3em] text-ivory-dim/80">
          <span>Scroll</span>
          <span className="text-[8px]">to discover</span>
        </div>
      </div>
    </section>
  );
}
