"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { parallax } from "@/lib/motion";

// This hero sits directly on the unedited photo (desktop) or the plain
// bg-[#f5ede4] backdrop behind an uncropped, corner-anchored copy of it
// (mobile/tablet, see CollectionHero's own comment) -- no gradient/scrim
// either way. Text color is a fixed warm palette (not the site's --ink/--gold
// theme tokens) sampled to read clearly against the photo's own light wall
// tone, and to stay consistent regardless of the visitor's light/dark site
// preference -- the photo's lighting shouldn't flip with it.
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
      className="relative -mt-24 flex w-full flex-col overflow-hidden bg-[#f5ede4] md:h-[100svh] md:flex-row md:items-start md:-mt-28 md:bg-transparent"
    >
      {/* Header is 80px tall, so pt-[180px] lands the text exactly 100px
          below it. Padding matches the header's px scale exactly (no
          max-w/mx-auto centering here) so the two stay left-aligned at
          every breakpoint, including ultra-wide screens.

          This used to be the second child, layered via z-10 over an
          absolutely-positioned full-bleed photo behind it -- fine on
          desktop (see the photo's own comment), but on mobile/tablet that
          meant the photo and this text block were positioned completely
          independently, with nothing guaranteeing space between them. A
          scale-based attempt to shrink the photo's blank backdrop
          (bigger photo = starts higher up) overlapped this paragraph on
          a short-enough phone; the text is unchanged here, only its
          position in the DOM/flow moved -- now first, with the photo (see
          below) a normal-flow sibling *after* it instead of an
          independently-positioned overlay, so overlap is structurally
          impossible regardless of viewport height or text length. From md
          up this reverts to the exact original relative+z-10 treatment,
          which still works precisely because the photo goes back to being
          absolutely positioned behind it there. */}
      <div ref={ref} className="relative z-10 w-full px-6 pt-[180px] pb-10 md:px-12 md:pb-0 lg:px-16 xl:px-20 2xl:px-24">
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

      {/* bg-[#f5ede4]: the same warm light tone the old mobile scrim was
          built from (rgba(245,237,228,...)) — invisible on desktop where
          the photo covers the container edge-to-edge, but on mobile/tablet
          it's the backdrop showing through wherever the photo doesn't
          reach.

          Below md this is a normal flow block, sized to the photo's own
          native 3:2 ratio (aspect-[3/2]; the file is 1536x1024) rather
          than absolutely filling the section -- combined with
          object-contain below, a box shaped exactly like the photo means
          object-contain has zero leftover space to letterbox into: the
          full photo fills the box edge to edge, nothing cropped, nothing
          blank. object-cover was cropping ~70% of the width away on a
          container this tall and narrow (see git history); object-contain
          in a same-aspect-ratio box needed no cropping *or* a container
          override to begin with. From md up this reverts to the original
          absolute, full-bleed, aspect-auto background with the original
          object-cover crop -- untouched. */}
      <div
        ref={bgRef}
        className="relative aspect-[3/2] w-full bg-[#f5ede4] md:absolute md:inset-x-0 md:top-[-8%] md:bottom-[-8%] md:aspect-auto"
      >
        <Image
          src="/images/hero/collection.png"
          alt="Lebelage Real Sensation Blemish Ampoule and Pore Cream staged on stone with cherry blossom"
          fill
          priority
          className="object-contain object-right-bottom md:object-cover md:object-[62%_center]"
          sizes="100vw"
        />
      </div>
    </section>
  );
}
