"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion, reveal, splitWordReveal } from "@/lib/motion";
import WordMask from "@/components/ui/WordMask";

gsap.registerPlugin(ScrollTrigger);

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
  const sectionRef = useRef<HTMLElement | null>(null);

  // The three pillars wipe open left-to-right in sequence — the same
  // west-to-east axis as the Korea → Malé route line in the section above,
  // so the whole page shares one direction of travel. Heading and CTA use
  // the site's quiet standard reveal.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      reveal(section.querySelectorAll("[data-reveal]"), {
        y: 24,
        duration: 0.9,
        stagger: 0.12,
        start: "top 80%",
        trigger: section,
      });

      const title = section.querySelector(".curated-title");
      if (title) splitWordReveal(title, { start: "top 82%" });

      const pillars = section.querySelectorAll(".curated-pillar");
      gsap.set(pillars, { clipPath: "inset(0% 100% 0% 0%)" });
      gsap.to(pillars, {
        clipPath: "inset(0% 0% 0% 0%)",
        duration: 1,
        ease: "power3.out",
        stagger: 0.22,
        scrollTrigger: { trigger: ".curated-grid", start: "top 78%", once: true },
      });
    }, section);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="page-gutter bg-charcoal py-28 md:py-40">
      <div>
        <div className="max-w-2xl">
          <p data-reveal className="text-xs tracking-[0.3em] text-gold uppercase">
            Curated for the Maldives
          </p>
          <h2 className="curated-title mt-6 font-display text-3xl leading-[1.2] text-ivory md:text-[2.75rem]">
            <WordMask text="Skincare chosen for island life." />
          </h2>
        </div>

        <div className="curated-grid mt-20 grid gap-px overflow-hidden bg-line sm:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.index}
              className="curated-pillar bg-charcoal px-8 py-10 transition-colors hover:bg-ink-2"
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
