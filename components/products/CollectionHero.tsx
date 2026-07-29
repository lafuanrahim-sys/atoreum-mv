"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { parallax } from "@/lib/motion";

// This hero sits directly on the unedited photo -- no gradient/scrim is
// layered on top of it. Text color is a fixed warm palette (not the site's
// --ink/--gold theme tokens) sampled to read clearly against the photo's own
// light wall tone, and to stay consistent regardless of the visitor's
// light/dark site preference -- the photo's lighting shouldn't flip with it.
const WARM = {
  heading: "#241d17",
  body: "#6b5d50",
  accent: "#c9876c",
};

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l1.8 7.2L21 11l-7.2 1.8L12 20l-1.8-7.2L3 11l7.2-1.8L12 2Z" />
    </svg>
  );
}

export default function CollectionHero() {
  const ref = useScrollReveal<HTMLDivElement>({ start: "top 85%" });
  const sectionRef = useRef<HTMLElement | null>(null);
  const bgRef = useRef<HTMLDivElement | null>(null);

  // Subtle scroll parallax on the photo only — the layer bleeds 8% past the
  // section top/bottom so its drift never exposes an edge. Text stays put.
  useEffect(() => {
    const section = sectionRef.current;
    const bg = bgRef.current;
    if (!section || !bg) return;

    const ctx = gsap.context(() => {
      parallax(bg, { trigger: section, yPercent: 8 });
    }, section);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative -mt-24 flex h-[100svh] w-full items-start overflow-hidden md:-mt-28"
    >
      <div ref={bgRef} className="absolute inset-x-0 top-[-8%] bottom-[-8%]">
        <Image
          src="/images/hero/collection.png"
          alt="Lebelage Real Sensation Blemish Ampoule and Pore Cream staged on stone with cherry blossom"
          fill
          priority
          className="object-cover object-[62%_center]"
          sizes="100vw"
        />
        {/* Mobile-only scrim: the same 62%-center crop that reads fine as a
            wide desktop banner (mostly light wall behind the text corner)
            frames much tighter on a phone, landing the text squarely over
            the bottle itself — busy, high-contrast glass and gold that no
            fixed WARM text color can stay readable against. A soft warm
            veil (same palette family as WARM.heading/body, so it reads as
            an intentional part of the photo's own light rather than a
            slapped-on box) restores contrast without touching the
            deliberately scrim-free desktop treatment described above. */}
        <div
          aria-hidden
          className="absolute inset-0 md:hidden"
          style={{ background: "linear-gradient(180deg, rgba(245,237,228,0.88) 0%, rgba(245,237,228,0.72) 45%, rgba(245,237,228,0.28) 75%, rgba(245,237,228,0) 100%)" }}
        />
      </div>
      {/* Header is 80px tall, so pt-[180px] lands the text exactly 100px
          below it. Padding matches the header's px scale exactly (no
          max-w/mx-auto centering here) so the two stay left-aligned at
          every breakpoint, including ultra-wide screens. */}
      <div ref={ref} className="relative z-10 w-full px-6 pt-[180px] md:px-12 lg:px-16 xl:px-20 2xl:px-24">
        <div className="max-w-2xl">
          <p
            data-reveal
            className="flex items-center gap-2 text-sm tracking-[0.3em] uppercase"
            style={{ color: WARM.accent }}
          >
            <SparkleIcon className="h-4 w-4" />
            Lebelage launch collection
          </p>

          <h1
            data-reveal
            className="mt-6 font-display text-5xl leading-[1.1] md:text-6xl lg:text-[4.2rem]"
            style={{ color: WARM.heading }}
          >
            Korean skincare,
            <br />
            <em className="italic" style={{ color: WARM.accent }}>
              made for island life.
            </em>
          </h1>

          <p
            data-reveal
            className="mt-6 max-w-lg text-lg leading-relaxed md:text-xl"
            style={{ color: WARM.body }}
          >
            Selected for Atoreum MV&apos;s official Lebelage launch &mdash; formulas made to
            perform under salt air, sunlight, and island humidity.
          </p>
        </div>
      </div>
    </section>
  );
}
