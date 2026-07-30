"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion, reveal } from "@/lib/motion";

gsap.registerPlugin(ScrollTrigger);

type CoverflowCard = {
  /** Doubles as the exact `category` value the Collection page's filter expects. */
  label: string;
  /** Real product/category photo path — swap freely, sizing stays identical. Null renders the same "Photo coming soon" placeholder ProductCard uses, for any category without photography yet. */
  image: string | null;
};

// One card per catalog category (lib/types.ts CATEGORIES) so this doubles as
// a visual category picker, not just five hand-picked favorites. Every
// image here is a copy (not a reference into a product's own photo folder)
// consolidated under /public/images/categories -- keeps this component's
// asset set self-contained and independent of individual products' photos
// getting renamed/moved/removed.
const CARDS: CoverflowCard[] = [
  { label: "Ampoule", image: "/images/categories/ampoule.png" },
  { label: "Cream", image: "/images/categories/cream.png" },
  { label: "Foam", image: "/images/categories/foam.png" },
  { label: "Sun Care", image: "/images/categories/sun-care.png" },
  { label: "Toner", image: "/images/categories/toner.png" },
  { label: "Mask Pack", image: "/images/categories/mask-pack.png" },
  { label: "Foam Pack 2in1", image: "/images/categories/foam-pack-2in1.png" },
  { label: "Toner Pad", image: "/images/categories/toner-pad.png" },
  { label: "Lotion", image: "/images/categories/lotion.png" },
  { label: "Make-up", image: "/images/categories/make-up.png" },
  { label: "Eye Cream", image: "/images/categories/eye-cream.png" },
  { label: "Soothing Gel", image: "/images/categories/soothing-gel.png" },
  { label: "Emulsion", image: "/images/categories/emulsion.png" },
  { label: "Essence", image: "/images/categories/essence.png" },
  { label: "Serum", image: "/images/categories/serum.png" },
];

// Coverflow-style depth stack: every card's rotateY/translateZ/translateX/
// scale/opacity/blur/shadow is recomputed from its own distance (in cards)
// to the current drag-driven "focus" position on every pointer move —
// not placed once and left static — so the focused card visibly grows and
// turns to face the viewer while its neighbors shrink, fade, blur, and
// pick up a soft shadow as they recede.
const ANGLE_STEP = 46; // deg of rotateY per step away from focus
const MAX_ANGLE = 72; // clamp so far cards approach edge-on but never flip
const SPACING_RATIO = 0.8; // translateX per step, relative to card size — breathing room between cards
const DEPTH_RATIO = 0.95; // translateZ pushed back per step, relative to card size
// With 5 cards the raw distance-from-focus reaches ±4 at the very start/end
// of the drag sweep — letting x/z grow unbounded at that range flings the
// outermost cards far off-screen. Position is clamped to this many steps;
// scale/opacity/rotate/shadow/blur keep using the real, unclamped distance,
// so cards beyond the clamp keep shrinking/fading/blurring into an (already
// nearly invisible) pile instead of continuing to travel outward.
const POSITION_CLAMP = 1.5;
const FORWARD_POP = 0.14; // how far the focused card steps toward the viewer, relative to card size
const SCALE_MIN = 0.46;
const SCALE_FALLOFF = 0.32; // scale lost per step away from focus
const OPACITY_MIN = 0.22;
const OPACITY_FALLOFF = 0.4;
const SHADOW_MAX_ALPHA = 0.09; // out-of-focus cards' resting shadow strength
const SHADOW_RATE = 0.24; // shadow reaches max alpha by this many steps away from focus
const BLUR_START = 0.75; // steps away before blur starts kicking in
const BLUR_MAX_PX = 4;
const BLUR_RATE = 3.2;
const PERSPECTIVE_RATIO = 2.8; // perspective distance / card size — smaller = stronger near/far size contrast
const DESKTOP_QUERY = "(min-width: 768px)"; // matches Tailwind's `md:` breakpoint used below

// Mobile row: same "focus" idea as the desktop stack (the centered card
// reads as active, neighbors recede) but driven by the row's own native
// horizontal scroll position instead of a custom drag handler — swiping
// stays exactly the platform gesture it already is, this just reacts to it.
// Falloff is per "step" (one card-width + gap away), not a raw pixel
// distance, so it scales correctly with --card-size at any viewport width.
const MOBILE_GAP_PX = 8;
const MOBILE_SCALE_MIN = 0.84;
const MOBILE_SCALE_FALLOFF = 0.16;
const MOBILE_OPACITY_MIN = 0.5;
const MOBILE_OPACITY_FALLOFF = 0.42;
const MOBILE_LIFT_MAX = 6; // px, off-center cards sit slightly lower

// Shared between the desktop stack and mobile row so the photo/placeholder/
// label treatment can't drift between the two.
function CardMedia({ card }: { card: CoverflowCard }) {
  return (
    <>
      {card.image ? (
        <img
          src={card.image}
          alt={card.label}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        // Same "no photo yet" treatment as ProductCard -- covers any future
        // category added without photography yet, so that card still exists
        // (every category should be pickable here) without pretending a
        // photo exists. All 15 current categories have real photos now.
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-moss/30 via-ink-2 to-ink">
          <svg viewBox="0 0 40 40" aria-hidden="true" className="h-9 w-9 text-ivory-dim/30">
            <rect x="6" y="10" width="28" height="22" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="14" cy="17" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M6 27l8-7 6 5 6-6 8 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
          <span className="text-[10px] uppercase tracking-[0.2em] text-ivory-dim/50">Photo coming soon</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-start" style={{ padding: "33px" }}>
        <span className="font-display text-xl uppercase tracking-[0.08em] text-ivory md:text-3xl">
          {card.label}
        </span>
      </div>
    </>
  );
}

export default function CoverflowArc() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardSizeRef = useRef(520);
  const mobileRowRef = useRef<HTMLDivElement | null>(null);
  const mobileCardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const stage = stageRef.current;
      const stack = stackRef.current;
      if (!stage || !stack) return;

      // Quiet entrance for the copy and the mobile row; the desktop stage gets
      // the fan-out below instead. reveal() handles reduced-motion itself.
      const entranceTargets = [
        section.querySelector(".coverflow-header"),
        section.querySelector(".coverflow-mobile-row"),
      ].filter((el): el is Element => el !== null);
      reveal(entranceTargets, {
        y: 24,
        duration: 0.9,
        stagger: 0.15,
        start: "top 72%",
        trigger: section,
      });

      const mm = gsap.matchMedia();

      mm.add(DESKTOP_QUERY, () => {
        const total = CARDS.length;

        // `stack` itself is never transformed (only the cards inside it
        // are), so its rendered width is a stable, scale-independent read
        // of the base card size — measuring a currently-shrunk card
        // instead would feed its own scaled-down size back into the math.
        const measure = () => {
          cardSizeRef.current = stack.getBoundingClientRect().width || cardSizeRef.current;
          stage.style.perspective = `${cardSizeRef.current * PERSPECTIVE_RATIO}px`;
        };
        measure();
        window.addEventListener("resize", measure);

        // Entrance choreography: the cards start as one stacked deck and
        // fan out into the arc when the section scrolls into view — the
        // motion literally performs the section's headline ("Every formula,
        // one arc"). `spread` interpolates every distance-derived quantity
        // from "stacked at focus" (0) to the normal coverflow layout (1), so
        // a drag mid-fan simply works with wherever the fan currently is.
        const spread = { value: prefersReducedMotion() ? 1 : 0 };

        const applyState = (progress: number) => {
          const centerProgress = progress * (total - 1);
          const size = cardSizeRef.current;
          const p = spread.value;

          cardRefs.current.forEach((card, i) => {
            if (!card) return;
            const delta = i - centerProgress;
            const absDelta = Math.abs(delta);
            const positionDelta = gsap.utils.clamp(-POSITION_CLAMP, POSITION_CLAMP, delta);
            const positionAbsDelta = Math.abs(positionDelta);

            const rotateY = gsap.utils.clamp(-MAX_ANGLE, MAX_ANGLE, delta * ANGLE_STEP) * p;
            const z = (FORWARD_POP - positionAbsDelta * DEPTH_RATIO * p) * size;
            const x = positionDelta * size * SPACING_RATIO * p;
            const scale = gsap.utils.clamp(SCALE_MIN, 1, 1 - absDelta * SCALE_FALLOFF * p);
            const opacity = gsap.utils.clamp(OPACITY_MIN, 1, 1 - absDelta * OPACITY_FALLOFF * p);
            const shadowAlpha = gsap.utils.clamp(0, SHADOW_MAX_ALPHA, absDelta * SHADOW_RATE) * p;
            const blurPx = gsap.utils.clamp(0, BLUR_MAX_PX, (absDelta - BLUR_START) * BLUR_RATE) * p;

            gsap.set(card, {
              x,
              z,
              rotateY,
              scale,
              opacity,
              zIndex: Math.round((total - absDelta) * 10),
              boxShadow: `0 20px 45px rgba(0,0,0,${shadowAlpha.toFixed(3)})`,
              filter: blurPx > 0.05 ? `blur(${blurPx.toFixed(2)}px)` : "none",
            });
          });
        };

        // Cards are static until dragged — no scroll-driven progression.
        // Grabbing the stage and moving the pointer left/right is the only
        // way progress changes now. Starts centered on the middle card.
        let progress = 0.5;
        applyState(progress);

        if (!prefersReducedMotion()) {
          gsap.to(spread, {
            value: 1,
            duration: 1.6,
            ease: "power3.inOut",
            scrollTrigger: { trigger: section, start: "top 62%", once: true },
            onUpdate: () => applyState(progress),
          });
        }

        let isDragging = false;
        let dragStartX = 0;
        let dragStartProgress = 0;
        // Cards are now links (clicking one navigates to that category) --
        // this distinguishes an actual drag from a click that happens not
        // to move the pointer, so browsing the stack doesn't accidentally
        // fire a navigation on release. CLICK_SUPPRESS_PX is small enough
        // that a genuine tap still registers as a click.
        let draggedPastThreshold = false;
        const CLICK_SUPPRESS_PX = 6;

        // Velocity is tracked in progress-units/ms from the last two
        // pointermove samples (not the whole drag average) so a throw
        // reflects how fast the pointer was moving right at release, not
        // the speed of the drag as a whole.
        let velocity = 0;
        let lastMoveTime = 0;
        let lastMoveProgress = 0;
        let momentumTween: gsap.core.Tween | null = null;

        const THROW_PROJECTION_MS = 220; // how far ahead the release velocity projects
        const MAX_THROW_VELOCITY = 0.006; // progress/ms clamp so a jittery flick can't fling across all 5 cards

        const onPointerDown = (event: PointerEvent) => {
          momentumTween?.kill();
          isDragging = true;
          draggedPastThreshold = false;
          dragStartX = event.clientX;
          dragStartProgress = progress;
          velocity = 0;
          lastMoveTime = performance.now();
          lastMoveProgress = progress;
          stage.setPointerCapture(event.pointerId);
        };

        const onPointerMove = (event: PointerEvent) => {
          if (!isDragging) return;
          const deltaX = event.clientX - dragStartX;
          if (Math.abs(deltaX) > CLICK_SUPPRESS_PX) draggedPastThreshold = true;
          const stepPx = cardSizeRef.current * SPACING_RATIO;
          const deltaProgress = -(deltaX / stepPx) / (total - 1);
          progress = gsap.utils.clamp(0, 1, dragStartProgress + deltaProgress);
          applyState(progress);

          const now = performance.now();
          const dt = now - lastMoveTime;
          if (dt > 0) {
            velocity = (progress - lastMoveProgress) / dt;
            lastMoveTime = now;
            lastMoveProgress = progress;
          }
        };

        // Capture phase, so this runs before the click ever reaches the
        // <Link>'s own handler -- a real drag suppresses the navigation
        // that would otherwise fire on pointerup's matching click event.
        const onClickCapture = (event: MouseEvent) => {
          if (draggedPastThreshold) {
            event.preventDefault();
            event.stopPropagation();
          }
        };

        const endDrag = (event: PointerEvent) => {
          if (!isDragging) return;
          isDragging = false;
          stage.releasePointerCapture(event.pointerId);

          const throwVelocity = gsap.utils.clamp(-MAX_THROW_VELOCITY, MAX_THROW_VELOCITY, velocity);
          const target = gsap.utils.clamp(0, 1, progress + throwVelocity * THROW_PROJECTION_MS);
          const state = { progress };
          momentumTween = gsap.to(state, {
            progress: target,
            duration: 0.8,
            ease: "power3.out",
            onUpdate: () => {
              progress = state.progress;
              applyState(progress);
            },
          });
        };

        stage.addEventListener("pointerdown", onPointerDown);
        stage.addEventListener("pointermove", onPointerMove);
        stage.addEventListener("pointerup", endDrag);
        stage.addEventListener("pointercancel", endDrag);
        stage.addEventListener("click", onClickCapture, true);

        return () => {
          window.removeEventListener("resize", measure);
          momentumTween?.kill();
          stage.removeEventListener("pointerdown", onPointerDown);
          stage.removeEventListener("pointermove", onPointerMove);
          stage.removeEventListener("pointerup", endDrag);
          stage.removeEventListener("pointercancel", endDrag);
          stage.removeEventListener("click", onClickCapture, true);
        };
      });

      mm.add("(max-width: 767px)", () => {
        const row = mobileRowRef.current;
        if (!row) return;
        const reduceMotion = prefersReducedMotion();

        const applyMobileState = () => {
          const rowRect = row.getBoundingClientRect();
          const rowCenter = rowRect.left + rowRect.width / 2;

          // Read phase first (every card's position) before any writes —
          // interleaving getBoundingClientRect with gsap.set per card would
          // force a synchronous layout recalc between each one.
          const measurements = mobileCardRefs.current.map((card) => {
            if (!card) return null;
            const rect = card.getBoundingClientRect();
            return { card, dist: rect.left + rect.width / 2 - rowCenter, width: rect.width };
          });

          let nearestIndex = 0;
          let nearestDist = Infinity;
          measurements.forEach((m, i) => {
            if (m && Math.abs(m.dist) < nearestDist) {
              nearestDist = Math.abs(m.dist);
              nearestIndex = i;
            }
          });

          if (!reduceMotion) {
            measurements.forEach((m) => {
              if (!m) return;
              const steps = Math.abs(m.dist) / (m.width + MOBILE_GAP_PX);
              gsap.set(m.card, {
                scale: gsap.utils.clamp(MOBILE_SCALE_MIN, 1, 1 - steps * MOBILE_SCALE_FALLOFF),
                opacity: gsap.utils.clamp(MOBILE_OPACITY_MIN, 1, 1 - steps * MOBILE_OPACITY_FALLOFF),
                y: gsap.utils.clamp(0, MOBILE_LIFT_MAX, steps * MOBILE_LIFT_MAX),
              });
            });
          }

          setActiveIndex((prev) => (prev === nearestIndex ? prev : nearestIndex));
        };

        applyMobileState();

        let ticking = false;
        const onScroll = () => {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            applyMobileState();
            ticking = false;
          });
        };

        row.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", applyMobileState);
        return () => {
          row.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", applyMobileState);
        };
      });
    }, section);

    return () => ctx.revert();
  }, []);

  const scrollToMobileCard = (index: number) => {
    mobileCardRefs.current[index]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <section
      ref={sectionRef as React.RefObject<HTMLElement>}
      className="coverflow-section coverflow-h-100svh relative flex w-full flex-col items-center justify-center overflow-hidden bg-ink px-6 pt-24 pb-16 md:pt-28"
    >
      <div className="coverflow-header relative z-10 mb-14 text-center md:mb-20">
        <p className="text-xs tracking-[0.3em] text-gold uppercase">The Edit</p>
        <h2 className="mt-4 font-display text-2xl text-ivory md:text-4xl">
          Every formula, one arc
        </h2>
      </div>

      {/* Desktop/tablet: coverflow depth stack, driven by drag only. */}
      <div
        ref={stageRef}
        className="relative hidden w-full touch-none select-none items-center justify-center md:flex"
      >
        <div
          ref={stackRef}
          className="relative"
          style={{
            width: "var(--card-size)",
            height: "var(--card-size)",
          }}
        >
          {CARDS.map((card, i) => (
            <div
              key={card.label}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="absolute inset-0 overflow-hidden bg-ink-2"
              style={{ backfaceVisibility: "hidden" }}
            >
              <Link
                href={`/products?category=${encodeURIComponent(card.label)}`}
                className="absolute inset-0 block"
                aria-label={`Shop ${card.label}`}
                draggable={false}
              >
                <CardMedia card={card} />
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: no 3D — a native swipeable, snap-scrolling row, but the
          centered card grows/sharpens and its neighbors recede as you swipe
          (see the matchMedia block above), so it's not just a static strip
          sliding by. */}
      <div
        ref={mobileRowRef}
        className="coverflow-mobile-row flex w-full gap-2 overflow-x-auto px-[calc(50%-var(--card-size)/2)] md:hidden"
      >
        {CARDS.map((card, i) => (
          <Link
            key={card.label}
            ref={(el) => {
              mobileCardRefs.current[i] = el;
            }}
            href={`/products?category=${encodeURIComponent(card.label)}`}
            className="relative block flex-none overflow-hidden bg-ink-2"
            style={{ width: "var(--card-size)", height: "var(--card-size)" }}
          >
            <CardMedia card={card} />
          </Link>
        ))}
      </div>

      {/* Segmented progress track, mobile only — 15 categories is too many
          for individual dots to read cleanly on a phone-width screen, so
          this doubles as both a position indicator and a jump-to-category
          control (tap any segment). */}
      <div
        className="mt-6 flex w-full gap-1 px-[calc(50%-var(--card-size)/2)] md:hidden"
        role="group"
        aria-label="Jump to category"
      >
        {CARDS.map((card, i) => (
          // h-6 button around a slim h-1 bar -- a full 44px touch target
          // would make 15 of these read as a chunky block instead of a
          // progress line, but the visual sliver alone is far too short to
          // tap reliably; this keeps the tap area reasonable without
          // bloating what's meant to be a thin indicator.
          <button
            key={card.label}
            type="button"
            onClick={() => scrollToMobileCard(i)}
            aria-label={`Jump to ${card.label}`}
            aria-current={i === activeIndex ? "true" : undefined}
            className="flex h-6 flex-1 items-center"
          >
            <span
              className={`h-1 w-full rounded-full transition-colors duration-300 ${
                i === activeIndex ? "bg-gold" : "bg-ivory/15"
              }`}
            />
          </button>
        ))}
      </div>

      <style>{`
        /* Fluid, not fixed breakpoints — the stack's total horizontal span is
           a constant multiple of --card-size, so tying it to vw keeps every
           card inside the viewport (none clipped left/right) at any width,
           instead of a fixed px size that only fit one screen size. */
        .coverflow-section { --card-size: clamp(220px, 60vw, 320px); }
        @media (min-width: 768px) { .coverflow-section { --card-size: clamp(220px, 34vw, 620px); } }

        .coverflow-mobile-row {
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
        }
        .coverflow-mobile-row::-webkit-scrollbar { display: none; }
        .coverflow-mobile-row > a { scroll-snap-align: center; }
      `}</style>
    </section>
  );
}
