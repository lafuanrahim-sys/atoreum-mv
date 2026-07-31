"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "@/lib/motion";
import { playLandingThud, stopTravelSound, updateTravelSound } from "@/lib/keySound";

gsap.registerPlugin(ScrollTrigger);

/** Great-circle distance Korea (Seoul) → Malé, the trip every formula makes. */
const DISTANCE_KM = 6562;

/**
 * Pinned scroll chapter: the viewport holds while the reader "flies" the
 * sourcing route — a gold line draws from KOREA to MALÉ, a dot travels it,
 * the kilometre counter climbs to the real great-circle distance, and
 * visual emphasis hands over from origin to destination. The brand story
 * (sourced in Korea, delivered from Malé) becomes something you travel
 * through rather than read about.
 *
 * Reduced motion (and the no-JS fallback): no pin, the completed state is
 * simply shown — line drawn, counter at full distance.
 */
export default function JourneyChapter() {
  const sectionRef = useRef<HTMLElement | null>(null);

  // useLayoutEffect (not useEffect) is load-bearing here: pinning re-parents
  // the section into ScrollTrigger's pin-spacer div, and the un-pin must run
  // synchronously during unmount — before React detaches the section — or
  // React throws removeChild errors on navigation.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const counter = section.querySelector<HTMLElement>(".journey-km");
      // Mutate the existing text node's data rather than replacing it —
      // React keeps its reference to this node, so swapping it out would
      // break reconciliation. The node holds only the number; the " km"
      // suffix is its own sibling text node and stays untouched.
      const counterText = counter?.firstChild;
      const track = section.querySelector<HTMLElement>(".journey-track");
      const distance = { km: 0 };
      // Sound state. Two lag sources are deliberately bypassed so ticks are
      // exactly simultaneous with the fingers: (1) sound is driven from the
      // trigger's RAW progress (self.progress), not the scrub-smoothed
      // tween the visuals use, and (2) it's gated on real wheel/touch input
      // within the last 120ms, so Lenis momentum stays silent.
      let hasArrived = false;
      let lastInputAt = 0;
      const markInput = () => {
        lastInputAt = Date.now();
      };
      window.addEventListener("wheel", markInput, { passive: true });
      window.addEventListener("touchmove", markInput, { passive: true });

      gsap.set(".journey-line", { scaleX: 0 });
      gsap.set(".journey-dot", { x: 0 });
      gsap.set(".journey-male", { opacity: 0.25 });
      if (counterText) counterText.nodeValue = "0";

      // The journey completes at this fraction of the pin; the remainder is
      // a quiet runway. The chime plays while the section holds its final
      // frame and the visitor's own continuing scroll carries them out —
      // no scroll-locking, so no gesture is ever swallowed.
      const ARRIVAL_AT = 0.78;

      gsap
        .timeline({
          defaults: { ease: "none", duration: ARRIVAL_AT },
          scrollTrigger: {
            trigger: section,
            start: "top top",
            // Kept intentionally short — the pin should read as a moment,
            // not a toll gate on the way down the page.
            end: "+=85%",
            scrub: 0.8,
            pin: true,
            onUpdate: (self) => {
              // Sound runs off RAW progress, rescaled so it completes at
              // the arrival point, not the pin's end.
              const pv = Math.min(1, self.progress / ARRIVAL_AT);
              if (pv >= 0.999) {
                if (!hasArrived) {
                  hasArrived = true;
                  stopTravelSound();
                  playLandingThud();
                }
              } else {
                if (pv < 0.9) hasArrived = false;
                if (Date.now() - lastInputAt < 120) {
                  updateTravelSound(pv, 1);
                }
              }
            },
          },
        })
        .to(".journey-line", { scaleX: 1 }, 0)
        .to(".journey-dot", { x: () => (track ? track.offsetWidth : 0) }, 0)
        .to(
          distance,
          {
            km: DISTANCE_KM,
            onUpdate: () => {
              // Visual counter only — sound runs off the trigger's raw
              // progress above, so it isn't delayed by this scrub easing.
              if (counterText) {
                counterText.nodeValue = Math.round(distance.km).toLocaleString("en-US");
              }
            },
          },
          0
        )
        .to(".journey-korea", { opacity: 0.25 }, 0)
        .to(".journey-male", { opacity: 1 }, 0)
        // Quiet runway: the completed scene rides the rest of the pin.
        .to({}, { duration: 1 - ARRIVAL_AT }, ARRIVAL_AT);

      // Function-based x needs re-measuring when the viewport changes.
      ScrollTrigger.addEventListener("refreshInit", () => {
        gsap.set(".journey-dot", { x: 0 });
      });

      return () => {
        window.removeEventListener("wheel", markInput);
        window.removeEventListener("touchmove", markInput);
      };
    }, section);
    return () => {
      stopTravelSound();
      ctx.revert();
    };
  }, []);

  return (
    // justify-start + a fixed top offset (not justify-center) -- centering
    // this content in a full h-100svh pin left a huge dead gap above it
    // that visually merged with IntroSection's own bottom padding right
    // above into one oversized gap; a fixed offset is also predictable
    // regardless of how tall the content block ends up being.
    //
    // Height is content-sized (py-20/28, not h-100svh) -- GSAP's pin
    // reserves the trigger's own rendered height as extra scroll distance
    // *after* the scrub finishes (the section un-pins and hands off by
    // scrolling through its own height once more before the next section
    // appears). At h-100svh with content anchored to the top, that hand-off
    // was almost entirely empty space -- the real content only ever filled
    // its top ~60%. Sizing the section to its actual content removes that
    // dead scroll-through instead of just hiding it visually. bg-ink
    // matches the page background either way, so during the active pin
    // (position:fixed, shorter than the viewport) there's no visible seam.
    <section
      ref={sectionRef}
      className="page-gutter relative flex w-full flex-col justify-start overflow-hidden bg-ink py-20 md:py-28"
    >
      <p className="text-xs tracking-[0.3em] text-gold uppercase">The Journey</p>

      <div className="mt-10 flex items-end justify-between">
        <div className="journey-korea">
          <span className="block font-display text-[13vw] leading-none text-ivory sm:text-[10vw]">
            Korea
          </span>
          <span className="mt-3 block text-[10px] tracking-[0.25em] text-ivory-dim uppercase sm:text-xs">
            Sourced directly
          </span>
        </div>
        <div className="journey-male text-right">
          <span className="block font-display text-[13vw] leading-none text-ivory sm:text-[10vw]">
            Malé
          </span>
          <span className="mt-3 block text-[10px] tracking-[0.25em] text-ivory-dim uppercase sm:text-xs">
            Delivered home
          </span>
        </div>
      </div>

      <div className="journey-track relative mt-12 h-px w-full bg-line">
        <div className="journey-line absolute inset-0 origin-left bg-gold" />
        <div
          className="journey-dot absolute top-1/2 -ml-1 h-2 w-2 -translate-y-1/2 rounded-full bg-gold"
          aria-hidden="true"
        />
      </div>

      <p
        className="journey-km mt-12 font-display text-4xl text-gold tabular-nums md:text-6xl"
        aria-label={`${DISTANCE_KM.toLocaleString("en-US")} kilometres from Korea to Malé`}
      >
        {DISTANCE_KM.toLocaleString("en-US")} km
      </p>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ivory-dim">
        Every formula in the collection makes this trip — packed in Korea,
        landed in Malé, delivered across the atolls.
      </p>
    </section>
  );
}
