"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion, reveal, splitWordReveal } from "@/lib/motion";
import WordMask from "@/components/ui/WordMask";

gsap.registerPlugin(ScrollTrigger);

export default function ExploreProducts() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      reveal(section.querySelectorAll("[data-reveal]"), {
        y: 24,
        duration: 0.9,
        stagger: 0.12,
        start: "top 82%",
        trigger: section,
      });

      const title = section.querySelector(".explore-title");
      if (title) splitWordReveal(title, { start: "top 84%" });

      // Magnetic CTA — the single magnetic element on the page. The button
      // leans toward the cursor within its neighbourhood (pull clamped so it
      // never escapes its hit area) and springs back on leave. Mouse-only.
      const cta = ctaRef.current;
      if (cta && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        const xTo = gsap.quickTo(cta, "x", { duration: 0.5, ease: "elastic.out(1,0.45)" });
        const yTo = gsap.quickTo(cta, "y", { duration: 0.5, ease: "elastic.out(1,0.45)" });

        const onMove = (event: MouseEvent) => {
          const rect = cta.getBoundingClientRect();
          xTo((event.clientX - rect.left - rect.width / 2) * 0.35);
          yTo((event.clientY - rect.top - rect.height / 2) * 0.35);
        };
        const onLeave = () => {
          xTo(0);
          yTo(0);
        };

        const zone = cta.parentElement ?? cta;
        zone.addEventListener("mousemove", onMove);
        zone.addEventListener("mouseleave", onLeave);
        return () => {
          zone.removeEventListener("mousemove", onMove);
          zone.removeEventListener("mouseleave", onLeave);
        };
      }
    }, section);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="page-gutter bg-ink py-28 md:py-40">
      <div>
        <div className="mx-auto max-w-3xl text-center">
          <p data-reveal className="text-xs tracking-[0.3em] text-gold uppercase">
            Explore Products
          </p>
          <h2 className="explore-title mt-6 font-display text-3xl leading-[1.2] text-ivory md:text-[2.75rem]">
            <WordMask text="Discover the curated launch collection." />
          </h2>
          <p data-reveal className="mt-6 text-base leading-relaxed text-ivory-dim md:text-lg">
            Shop Atoreum MV&apos;s first Lebelage edit, premium Korean skincare made
            for the Maldives and designed to feel effortless every day.
          </p>
        </div>

        <div data-reveal className="mt-16 flex justify-center py-6">
          <div ref={ctaRef} className="will-change-transform">
            <Link
              href="/products"
              className="group inline-flex items-center gap-4 rounded-none border border-gold px-8 py-4 text-xs tracking-[0.25em] text-gold uppercase transition-colors hover:bg-gold-deep hover:text-ink"
            >
              Explore the collection
              <span className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
