"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

type CoverflowCard = {
  label: string;
  /** Real product/category photo path — swap freely, sizing stays identical. */
  image: string;
};

// Real product photography — all five now sourced from /public/images.
const CARDS: CoverflowCard[] = [
  { label: "Ampoule", image: encodeURI("/images/24K Gold Perfect Ampoule 50g/f56de9ef853768d1a0460e44d5e98fa6.png") },
  { label: "Cream", image: encodeURI("/images/Black Snail Eye Cream EX 40ml/Black Snail Cream.png") },
  { label: "Essence", image: encodeURI("/images/Heeyul Premium 24K Gold Essence 130ml/Heeyul Premium 24K Gold Essence 130ml.png") },
  { label: "Mask Pack", image: encodeURI("/images/Aloe Solution Mask Pack 25g x 10pcs/Aloe Solution Mask Pack.png") },
  { label: "Emulsion", image: encodeURI("/images/Vitamin C Pure Emulsion 120ml/Vitamin C Pure Emulsion.png") },
];

// Coverflow-style depth stack: every card's rotateY/translateZ/translateX/
// scale/opacity/blur/shadow is recomputed from its own distance (in cards)
// to the current drag-driven "focus" position on every pointer move —
// not placed once and left static — so the focused card visibly grows and
// turns to face the viewer while its neighbors shrink, fade, blur, and
// pick up a soft shadow as they recede.
const ANGLE_STEP = 46; // deg of rotateY per step away from focus
const MAX_ANGLE = 72; // clamp so far cards approach edge-on but never flip
const SPACING_RATIO = 0.86; // translateX per step, relative to card size — breathing room between cards
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
const SHADOW_MAX_ALPHA = 0.22; // out-of-focus cards' resting shadow strength
const SHADOW_RATE = 0.24; // shadow reaches max alpha by this many steps away from focus
const BLUR_START = 0.75; // steps away before blur starts kicking in
const BLUR_MAX_PX = 4;
const BLUR_RATE = 3.2;
const PERSPECTIVE_RATIO = 2.8; // perspective distance / card size — smaller = stronger near/far size contrast
const DESKTOP_QUERY = "(min-width: 768px)"; // matches Tailwind's `md:` breakpoint used below

export default function CoverflowArc() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardSizeRef = useRef(520);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const stage = stageRef.current;
      const stack = stackRef.current;
      if (!stage || !stack) return;

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

        const applyState = (progress: number) => {
          const centerProgress = progress * (total - 1);
          const size = cardSizeRef.current;

          cardRefs.current.forEach((card, i) => {
            if (!card) return;
            const delta = i - centerProgress;
            const absDelta = Math.abs(delta);
            const positionDelta = gsap.utils.clamp(-POSITION_CLAMP, POSITION_CLAMP, delta);
            const positionAbsDelta = Math.abs(positionDelta);

            const rotateY = gsap.utils.clamp(-MAX_ANGLE, MAX_ANGLE, delta * ANGLE_STEP);
            const z = (FORWARD_POP - positionAbsDelta * DEPTH_RATIO) * size;
            const x = positionDelta * size * SPACING_RATIO;
            const scale = gsap.utils.clamp(SCALE_MIN, 1, 1 - absDelta * SCALE_FALLOFF);
            const opacity = gsap.utils.clamp(OPACITY_MIN, 1, 1 - absDelta * OPACITY_FALLOFF);
            const shadowAlpha = gsap.utils.clamp(0, SHADOW_MAX_ALPHA, absDelta * SHADOW_RATE);
            const blurPx = gsap.utils.clamp(0, BLUR_MAX_PX, (absDelta - BLUR_START) * BLUR_RATE);

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

        let isDragging = false;
        let dragStartX = 0;
        let dragStartProgress = 0;

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

        return () => {
          window.removeEventListener("resize", measure);
          momentumTween?.kill();
          stage.removeEventListener("pointerdown", onPointerDown);
          stage.removeEventListener("pointermove", onPointerMove);
          stage.removeEventListener("pointerup", endDrag);
          stage.removeEventListener("pointercancel", endDrag);
        };
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef as React.RefObject<HTMLElement>}
      className="coverflow-section relative flex h-[100svh] w-full flex-col items-center justify-center overflow-hidden bg-ink px-6 pt-24 pb-16 md:pt-28"
    >
      <div className="relative z-10 mb-14 text-center md:mb-20">
        <p className="text-xs tracking-[0.3em] text-gold uppercase">The Edit</p>
        <h2 className="mt-4 font-display text-2xl text-ivory md:text-4xl">
          Five formulas, one arc
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
              <img
                src={card.image}
                alt={card.label}
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
              <div className="pointer-events-none absolute inset-0 flex items-end justify-start" style={{ padding: "33px" }}>
                <span className="font-display text-xl uppercase tracking-[0.08em] text-ivory md:text-3xl">
                  {card.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: no 3D — a plain swipeable, snap-scrolling row. */}
      <div className="coverflow-mobile-row flex w-full gap-2 overflow-x-auto px-[calc(50%-var(--card-size)/2)] md:hidden">
        {CARDS.map((card) => (
          <div
            key={card.label}
            className="relative flex-none overflow-hidden bg-ink-2"
            style={{ width: "var(--card-size)", height: "var(--card-size)" }}
          >
            <img
              src={card.image}
              alt={card.label}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
            <div className="pointer-events-none absolute inset-0 flex items-end justify-start" style={{ padding: "33px" }}>
              <span className="font-display text-xl uppercase tracking-[0.08em] text-ivory">
                {card.label}
              </span>
            </div>
          </div>
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
        .coverflow-mobile-row > div { scroll-snap-align: center; }
      `}</style>
    </section>
  );
}
