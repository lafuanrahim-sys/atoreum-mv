"use client";

import Link from "next/link";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const PILLARS = [
  {
    index: "01",
    title: "Official Lebelage launch",
    copy:
      "Atoreum MV's curated debut collection makes the Maldives the first market for Lebelage.",
  },
  {
    index: "02",
    title: "Island-ready science",
    copy:
      "Active Korean formulas are chosen for heat, humidity, and salt air — elegant textures that stay beautiful on the skin.",
  },
  {
    index: "03",
    title: "Maldives delivery",
    copy:
      "Delivered across the Maldives with local care and dispatch from Malé.",
  },
];

export default function CuratedSection() {
  const ref = useScrollReveal<HTMLDivElement>({ variant: "depth", start: "top 82%" });

  return (
    <section ref={ref} className="page-gutter bg-charcoal py-28 md:py-40">
      <div>
        <div className="max-w-2xl">
          <p data-reveal className="text-xs tracking-[0.3em] text-gold uppercase">
            Curated for the Maldives
          </p>
          <h2
            data-reveal
            className="mt-6 font-display text-3xl leading-[1.2] text-ivory md:text-[2.75rem]"
          >
            Skincare chosen for island life.
          </h2>
        </div>

        <div
          className="mt-20 grid gap-px overflow-hidden bg-line sm:grid-cols-3"
          style={{ perspective: "1000px" }}
        >
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
            className="group inline-flex items-center gap-4 border border-gold px-8 py-4 text-xs tracking-[0.25em] text-gold uppercase transition-colors hover:bg-gold-deep hover:text-ink"
          >
            Explore the launch
            <span className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
