"use client";

import { useScrollReveal } from "@/hooks/useScrollReveal";

export default function IntroSection() {
  const ref = useScrollReveal<HTMLDivElement>();

  return (
    <section ref={ref} className="bg-ink px-6 py-28 md:px-12 md:py-40">
      <div className="mx-auto grid max-w-[1440px] gap-12 md:grid-cols-12">
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
            Atoreum MV was founded on a simple observation — the Maldives
            has extraordinary resorts, but no bridge to Korea&rsquo;s
            beauty houses.
          </h2>

          <p
            data-reveal
            className="mt-8 max-w-2xl text-base leading-relaxed text-ivory-dim md:text-lg"
          >
            We work directly with Seoul&rsquo;s most respected skincare and
            cosmetics brands to bring their formulas — many rarely seen
            outside Korea — to the islands. Every product in our
            collection is chosen for one reason above all: it has to
            perform in heat, humidity, and salt air, not just in a
            climate-controlled counter.
          </p>

          <div
            data-reveal
            className="mt-12 grid grid-cols-2 gap-8 border-t border-line pt-8 sm:grid-cols-3"
          >
            <div>
              <p className="font-display text-3xl text-gold">40+</p>
              <p className="mt-2 text-xs tracking-[0.15em] text-ivory-dim uppercase">
                Korean Houses
              </p>
            </div>
            <div>
              <p className="font-display text-3xl text-gold">Seoul</p>
              <p className="mt-2 text-xs tracking-[0.15em] text-ivory-dim uppercase">
                Sourced Directly
              </p>
            </div>
            <div>
              <p className="font-display text-3xl text-gold">Malé</p>
              <p className="mt-2 text-xs tracking-[0.15em] text-ivory-dim uppercase">
                Based &amp; Delivered
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
