"use client";

import Link from "next/link";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const PILLARS = [
  {
    index: "01",
    title: "Curated in Seoul",
    copy:
      "We select formulas directly from Korea's beauty houses — nothing arrives in our collection by default, only by decision.",
  },
  {
    index: "02",
    title: "Built for the Maldives",
    copy:
      "Every product is chosen for how it holds up against sun, salt water, and humidity — not just how it photographs.",
  },
  {
    index: "03",
    title: "Delivered Across the Atolls",
    copy:
      "From Malé to resort islands, we're building the delivery and concierge layer this collection deserves.",
  },
];

export default function CuratedSection() {
  const ref = useScrollReveal<HTMLDivElement>();

  return (
    <section ref={ref} className="bg-charcoal px-6 py-28 md:px-12 md:py-40">
      <div className="mx-auto max-w-[1440px]">
        <div className="max-w-2xl">
          <p data-reveal className="text-xs tracking-[0.3em] text-gold uppercase">
            The Collection
          </p>
          <h2
            data-reveal
            className="mt-6 font-display text-3xl leading-[1.2] text-ivory md:text-[2.75rem]"
          >
            Korean cosmetics, curated for the Maldives.
          </h2>
        </div>

        <div className="mt-20 grid gap-px overflow-hidden bg-line sm:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.index}
              data-reveal
              className="bg-charcoal px-8 py-10 transition-colors hover:bg-ink-2"
            >
              <span className="font-display text-sm text-sand">
                {pillar.index}
              </span>
              <h3 className="mt-6 font-display text-xl text-ivory">
                {pillar.title}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-ivory-dim">
                {pillar.copy}
              </p>
            </div>
          ))}
        </div>

        <div data-reveal className="mt-20 flex justify-center">
          <Link
            href="/products"
            className="group inline-flex items-center gap-4 border border-gold px-8 py-4 text-xs tracking-[0.25em] text-gold uppercase transition-colors hover:bg-gold hover:text-ink"
          >
            Explore the Collection
            <span className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
