"use client";

import { useScrollReveal } from "@/hooks/useScrollReveal";

export default function IntroSection() {
  const ref = useScrollReveal<HTMLDivElement>();
  const statsRef = useScrollReveal<HTMLDivElement>({ variant: "depth", start: "top 85%" });

  return (
    <section ref={ref} className="page-gutter bg-ink py-28 md:py-40">
      <div className="grid gap-12 md:grid-cols-12">
        <div data-reveal className="md:col-span-4">
          <p className="text-xs tracking-[0.3em] text-gold uppercase">
            Our Story
          </p>
        </div>

        <div className="md:col-span-8">
          <h2
            data-reveal
            className="font-display text-3xl leading-[1.2] text-ivory md:text-[2.75rem]"
          >
            Atoreum MV launches Lebelage with a curated island edit.
          </h2>

          <p
            data-reveal
            className="mt-8 max-w-2xl text-base leading-relaxed text-ivory-dim md:text-lg"
          >
            Every formula is selected for Atoreum MV&apos;s first launch — active
            Korean ingredients, elegant textures, and formulas made to perform
            under Maldives light and humidity.
          </p>

          <div
            ref={statsRef}
            className="mt-12 grid grid-cols-2 gap-8 border-t border-line pt-8 sm:grid-cols-3"
            style={{ perspective: "800px" }}
          >
            <div data-reveal>
              <p className="font-display text-5xl font-bold tracking-tight text-gold md:text-6xl">1</p>
              <p className="mt-3 text-xs tracking-[0.15em] text-ivory-dim uppercase">
                Official Lebelage launch
              </p>
            </div>
            <div data-reveal>
              <p className="font-display text-5xl font-bold tracking-tight text-gold md:text-6xl">Seoul</p>
              <p className="mt-3 text-xs tracking-[0.15em] text-ivory-dim uppercase">
                Sourced Directly
              </p>
            </div>
            <div data-reveal>
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
