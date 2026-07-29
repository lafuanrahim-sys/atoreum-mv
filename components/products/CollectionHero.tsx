"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { parallax } from "@/lib/motion";

// This hero sits directly on the unedited photo -- no gradient/scrim is
// layered on top of it, at any breakpoint. Text color is a fixed warm
// palette (not the site's --ink/--gold theme tokens) sampled to read clearly
// against the photo's own light wall tone, and to stay consistent regardless
// of the visitor's light/dark site preference -- the photo's lighting
// shouldn't flip with it.
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
      {/* Two swapped-in photos, not one crop of the same photo: the old
          approach tried to make a landscape desktop banner (collection.png,
          1536x1024, 3:2) also work as a full-bleed mobile background, which
          needed increasingly convoluted object-fit/aspect-ratio/DOM-flow
          workarounds (see git history) to avoid either cropping the bottle
          out of frame or leaving a blank gap above it. mobile.png is a
          separate photo shot/composed for this specifically -- empty space
          at the top for the text to sit on, both bottles lower-right,
          864x1821 (~0.47 aspect) which is already close enough to a phone
          viewport's own ratio that object-cover needs almost no cropping.
          object-top (not center): on a proportionally wider/shorter phone,
          object-cover has to crop some height to fill the container, and
          centered crop trims evenly off both ends -- eating into the
          empty top margin the text needs *and* pushing the product shot
          up into it at the same time. Anchoring to the top keeps that
          margin fully intact and lets the crop take the difference off
          the bottom instead, which is just extra water/reflection below
          the stone, not anything that needs to stay in frame. Simple
          full-bleed absolute + object-cover, same pattern as desktop,
          works directly -- no scrim, no letterboxing container. */}
      <div ref={bgRef} className="absolute inset-x-0 top-[-8%] bottom-[-8%]">
        <Image
          src="/images/hero/mobile.png"
          alt="Lebelage Real Sensation Blemish Ampoule and Pore Cream staged on stone with cherry blossom"
          fill
          priority
          className="object-cover object-top lg:hidden"
          sizes="100vw"
        />
        <Image
          src="/images/hero/collection.png"
          alt="Lebelage Real Sensation Blemish Ampoule and Pore Cream staged on stone with cherry blossom"
          fill
          priority
          className="hidden object-cover object-[62%_center] lg:block"
          sizes="100vw"
        />
      </div>
      {/* Header is 80px tall, so lg:pt-[180px] lands the text exactly 100px
          below it on desktop. Below lg, pt-[85px] instead -- mobile.png's
          product shot sits high enough up the frame (see its own comment)
          that at the original 180px this text block's natural height ran
          into the top of the bottles on a short-enough phone; shifting the
          block up buys clearance without shrinking the text itself. Tied to
          the same lg breakpoint as the mobile.png/collection.png swap above
          (not md) since that's also where the header itself switches from
          hamburger to full nav -- at md, tablet-width viewports got the
          desktop photo and offset without the desktop-width text column to
          match, running the heading straight into the product shot.
          Padding matches the header's px scale exactly at md+ (no
          max-w/mx-auto centering here) so the two stay left-aligned at
          every breakpoint, including ultra-wide screens. */}
      <div ref={ref} className="relative z-10 w-full px-6 pt-[85px] md:px-12 lg:pt-[180px] lg:px-16 xl:px-20 2xl:px-24">
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
