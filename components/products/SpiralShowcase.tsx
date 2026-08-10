"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Product } from "@/lib/products";
import { prefersReducedMotion, reveal } from "@/lib/motion";

gsap.registerPlugin(ScrollTrigger);

// Ground-truth values, not guessed: pulled live from pacomepertant.com's own
// running scene via `window.experience` (their Three.js Journey-style
// boilerplate exposes it) — read straight off a real ProjectPlane instance's
// verticalGap/angleGap/baseRadius/baseScaleX fields and camera fov/position,
// then cross-checked by recomputing a card's actual x/y/z/rotationY from the
// formula and confirming it matched their live numbers to 3 decimals.
//
// Two more things confirmed the same way (not screenshotted, read straight
// off the live instance):
//  - Their page never actually scrolls (document height == one viewport,
//    window.scrollY stays 0 the whole time) — wheel input feeds a
//    scrollOffset directly, the page itself is frozen. That's "stop the
//    screen": we pin the stage while it's being viewed instead of letting
//    the page scroll past it.
//  - Controls.minWheelSpeed=0.002 floors targetWheelDeltaY at
//    wheelDirection*minWheelSpeed once it decays below that — it never
//    reaches zero, so the drum keeps drifting even with no input. Replicated
//    below as a small continuous ambient increment.
//  - The material is THREE.DoubleSide and the fragment shader's back-face
//    branch is a plain box blur with no darken multiplier (the darken only
//    applies to the front-facing hover state) — so a card's back should
//    stay visible and merely soften, not go dark or disappear.
const CAMERA_FOV_DESKTOP = 35; // degrees — their Camera class, sizes.width >= 900
const CAMERA_FOV_MOBILE = 45; // degrees — sizes.width < 900
const CAMERA_DISTANCE_UNITS = 8; // their camera.position.z
const BASE_RADIUS_UNITS = 2;
const VERTICAL_GAP_UNITS = 0.5;
const ANGLE_GAP = 0.85; // radians per step around the cylinder
const Y_BIAS_UNITS = -0.8; // constant vertical offset baked into their U formula
const CARD_W_UNITS = 1.7; // their baseScaleX — a landscape card, not square
const CARD_H_UNITS = 1; // their baseScaleY
const CARD_ASPECT = CARD_W_UNITS / CARD_H_UNITS;
const MOBILE_QUERY = "(max-width: 899px)"; // matches their sizes.width<900 fov switch, not Tailwind's md
const DESKTOP_QUERY = "(min-width: 900px)";


// Their vertex shader gives each card a permanent 0.2-unit forward bulge
// along its width (newPosition.z = sin(uv.x*PI)*0.2), a per-pixel surface
// deformation. Tried approximating it in CSS by splitting each card into 9
// clip-path slices, each on its own translateZ — abandoned: independent DOM
// elements pushed to different depths don't share edge vertices the way a
// real mesh does, so under perspective + the card's own rotateY, adjacent
// slices visibly separated into dark gaps ("venetian blinds") instead of a
// smooth curve. Flat cards, unideal but correct, beat a broken curl.

// Unique products shown, doubled — exactly like their `[...projects,
// ...projects]` — so B (distance from the focus index) ranges roughly
// ±UNIQUE_COUNT, letting the cylinder wrap more than once across the visible
// set. A shorter, undoubled list gives half that range and the cascade
// visibly under-fills the frame. Doubled, this gives 10 total cards.
const UNIQUE_COUNT = 5;

// Index-steps per second the drum drifts on its own, even with no scroll
// input at all — the CSS analogue of their minWheelSpeed floor.
const AMBIENT_SPEED = 0.12;

function wrap(n: number, total: number) {
  return ((n % total) + total) % total;
}

export default function SpiralShowcase({ products }: { products: Product[] }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const unitsToPxRef = useRef(180);
  const lastOffsetRef = useRef(0);
  const scrubOffsetRef = useRef(0);
  const ambientOffsetRef = useRef(0);

  // Featured pieces spiral past first, real stock fills out the rest — same
  // curation instinct as CoverflowArc's handpicked five, just wider.
  const withImages = products.filter((p) => p.images[0]);
  const featured = withImages.filter((p) => p.featured);
  const rest = withImages.filter((p) => !p.featured);
  const unique = [...featured, ...rest].slice(0, UNIQUE_COUNT);
  const cards = [...unique, ...unique];

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const track = trackRef.current;
    if (!section || !stage || !track || cards.length === 0) return;

    const ctx = gsap.context(() => {
      const header = section.querySelector(".spiral-header");
      if (header) {
        reveal([header], { y: 24, duration: 0.9, start: "top 72%", trigger: section });
      }

      const mm = gsap.matchMedia();

      mm.add({ isDesktop: DESKTOP_QUERY, isMobile: MOBILE_QUERY }, (context) => {
        const { isMobile } = context.conditions as { isDesktop: boolean; isMobile: boolean };
        // Mobile renders the plain snap-scroll row instead (stage is
        // `hidden` there) — skip all 3D/pin setup so it isn't measuring and
        // pinning a display:none element.
        if (isMobile) return;

        const total = cards.length;
        const centerIndex = Math.floor(total / 2);

        // Center on the *focus point*, not the cluster's average spread.
        // "The biggest/frontmost card" is whichever one is nearest V=90°
        // (z=sin(V)*radius is maximized there — that's the whole reason a
        // card there reads as "the middle card"). Critically, that point is
        // FIXED in space: cos(90°)=0 and the b at which V=b*ANGLE_GAP=90°
        // is a constant, independent of scrollOffset — only *which physical
        // card* happens to be nearest it changes as the drum turns, not the
        // point itself. So instead of centering the whole cluster's
        // (scroll-dependent, nonlinearly-shifting) bounding envelope — which
        // keeps the *average* card centered but says nothing about where
        // the one big focus card lands — shift the whole track by a fixed
        // amount that puts this exact point at (0,0). No per-frame
        // recomputation needed: it's a constant.
        const idealFrontB = Math.PI / 2 / ANGLE_GAP;
        const focusResidualUnits = {
          x: 0, // cos(90°) = 0 — already centered, exactly
          y: idealFrontB * VERTICAL_GAP_UNITS + Y_BIAS_UNITS,
        };

        const setScale = (u2p: number) => {
          unitsToPxRef.current = u2p;
          stage.style.perspective = `${CAMERA_DISTANCE_UNITS * u2p}px`;
          track.style.setProperty("--spiral-card-w", `${CARD_W_UNITS * u2p}px`);
          track.style.setProperty("--spiral-card-h", `${CARD_H_UNITS * u2p}px`);
        };

        const applyState = (scrollOffset: number) => {
          lastOffsetRef.current = scrollOffset;
          const u2p = unitsToPxRef.current;

          cardRefs.current.forEach((card, i) => {
            if (!card) return;
            const n = wrap(i - scrollOffset, total);
            const b = n - centerIndex;
            const v = b * ANGLE_GAP;
            const cos = Math.cos(v);
            const sin = Math.sin(v);

            // Their exact formula: position.set(cos(V)*radius, B*verticalGap
            // + yBias, sin(V)*radius), rotation.y = -V + PI/2. Y flips sign
            // going from three.js (Y-up) to CSS (Y-down); X and Z map
            // directly since the camera looks straight down -Z with no roll.
            // focusResidualUnits shifts the whole track so the fixed
            // "V=90°" point — where the biggest, sharpest, frontmost card
            // always sits, whichever physical card that happens to be right
            // now — lands at the stage's exact center; the reference needs
            // no equivalent since its canvas is unbounded.
            const x = (cos * BASE_RADIUS_UNITS + focusResidualUnits.x) * u2p;
            const y = -(b * VERTICAL_GAP_UNITS + Y_BIAS_UNITS - focusResidualUnits.y) * u2p;
            const z = sin * BASE_RADIUS_UNITS * u2p;
            const rotateY = (-v + Math.PI / 2) * (180 / Math.PI);

            // DoubleSide material, back-face branch is a plain blur with no
            // darken (confirmed live, see the top-of-file note) — the back
            // of a card stays visible and legible-ish, it just softens.
            //
            // Front-facing correlates with sin(V) > 0 — verified against
            // their live scene via the same normal-dot-view test their own
            // checkHoveredProject() uses, not derived by hand (an earlier
            // by-hand derivation used cos(V), which was wrong and could
            // blur cards that were actually closest to the camera). Since
            // z = sin(V)*radius, this is exactly "z > 0" — the same value
            // already driving zIndex, so the frontmost cards (highest
            // zIndex) are now guaranteed to never be the blurred ones.
            const backFacing = z < 0;

            gsap.set(card, {
              x,
              y,
              z,
              rotateY,
              zIndex: Math.round(z),
              filter: backFacing ? "blur(3px)" : "none",
              pointerEvents: backFacing ? "none" : "auto",
            });
          });
        };

        // Same conversion their Camera class implies: a plane at z=0 fills
        // the frustum's half-height = tan(fov/2) * cameraDistance world
        // units, which maps to stageHeightPx/2 on screen — their exact
        // physical scale (same FOV, same camera distance, same world
        // units). Used as-is, with no additional "fit the cluster" capping:
        // their own canvas *is* the viewport, so at this same physical
        // scale their spiral also extends past the visible frame in every
        // direction — stage's overflow-hidden crops it exactly the way
        // their canvas bounds would. Matching their reference screenshot
        // (cards visibly cut off at the top/right edges) is what motivated
        // dropping the earlier "never let anything overflow" fit-cap, which
        // was shrinking the whole cluster far below their actual scale just
        // to keep one worst-case corner inside the frame.
        const measureAndFit = (currentOffset: number) => {
          const rect = stage.getBoundingClientRect();
          const fovDeg = isMobile ? CAMERA_FOV_MOBILE : CAMERA_FOV_DESKTOP;
          const fovRad = (fovDeg * Math.PI) / 180;
          const halfHeightUnits = Math.tan(fovRad / 2) * CAMERA_DISTANCE_UNITS;
          const physicalU2p = rect.height / 2 / halfHeightUnits || unitsToPxRef.current;
          setScale(physicalU2p);
          applyState(currentOffset);
        };

        measureAndFit(0);
        const onResize = () => measureAndFit(lastOffsetRef.current);
        window.addEventListener("resize", onResize);

        if (prefersReducedMotion()) {
          // Static settled arrangement only — no pin, no ambient drift.
          applyState(centerIndex * 0.4);
          return () => window.removeEventListener("resize", onResize);
        }

        const applyCombined = () => applyState(scrubOffsetRef.current + ambientOffsetRef.current);

        // "Stop the screen when the elements come": pin the stage — not the
        // whole section, so the heading above it isn't pinned along with it
        // and doesn't collide with cards — while scrolling drives the drum.
        const scrubState = { value: 0 };
        const tween = gsap.to(scrubState, {
          value: total,
          ease: "none",
          scrollTrigger: {
            trigger: stage,
            start: "top top",
            end: "+=400%",
            scrub: true,
            pin: true,
            pinSpacing: true,
          },
          onUpdate: () => {
            scrubOffsetRef.current = scrubState.value;
            applyCombined();
          },
        });

        // Ambient drift, matching their minWheelSpeed floor — the drum
        // never fully stops, it just slows to a crawl. Paused off-screen.
        let lastTickTime: number | null = null;
        const tick = (time: number) => {
          if (lastTickTime === null) {
            lastTickTime = time;
            return;
          }
          const dt = Math.min(time - lastTickTime, 0.05);
          lastTickTime = time;
          ambientOffsetRef.current += AMBIENT_SPEED * dt;
          applyCombined();
        };

        const observer =
          typeof IntersectionObserver === "undefined"
            ? null
            : new IntersectionObserver(
                ([entry]) => {
                  if (entry.isIntersecting) {
                    lastTickTime = null;
                    gsap.ticker.add(tick);
                  } else {
                    gsap.ticker.remove(tick);
                  }
                },
                { threshold: 0.01 }
              );
        observer?.observe(stage);

        return () => {
          window.removeEventListener("resize", onResize);
          observer?.disconnect();
          gsap.ticker.remove(tick);
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });
    }, section);

    return () => ctx.revert();
  }, [cards]);

  if (cards.length === 0) return null;

  return (
    <section
      ref={sectionRef as React.RefObject<HTMLElement>}
      className="spiral-section relative w-full bg-ink"
    >
      <div className="spiral-header hidden pt-24 pb-8 text-center md:block">
        <p className="text-xs tracking-[0.3em] text-gold uppercase">Scroll</p>
        <h2 className="mt-4 font-display text-2xl text-ivory md:text-4xl">
          The spiral edit
        </h2>
      </div>

      {/* Desktop/tablet: pinned scroll-driven carousel — the screen holds
          while this is in view, and scrolling (plus a slow ambient drift)
          spins the drum. */}
      <div
        ref={stageRef}
        className="relative hidden h-screen w-full items-center justify-center overflow-hidden md:flex"
      >
        <div
          ref={trackRef}
          className="relative"
          style={{ width: "var(--spiral-card-w)", height: "var(--spiral-card-h)", transformStyle: "preserve-3d" }}
        >
          {cards.map((product, i) => (
            <div
              key={`${product.id}-${i}`}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="group absolute inset-0"
            >
              <Link
                href={`/products/${product.id}`}
                className="absolute inset-0 block overflow-hidden rounded-sm bg-photo-well shadow-[0_20px_45px_rgba(0,0,0,0.35)]"
              >
                <img
                  src={product.images[0]}
                  alt={product.name}
                  draggable={false}
                  className="absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] object-contain transition-transform duration-500 ease-out motion-safe:group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 bg-ink/0 transition-colors duration-500 ease-out motion-safe:group-hover:bg-ink/55" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-start justify-end gap-1 p-5">
                  <span className="font-display text-base uppercase tracking-[0.06em] text-ivory">
                    {product.name}
                  </span>
                  {product.priceEffective > 0 && (
                    <span className="text-xs tracking-[0.15em] text-gold tabular-nums">
                      {product.currency} {product.priceEffective.toLocaleString("en-US")}
                    </span>
                  )}
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: no pin, no 3D — a plain swipeable, snap-scrolling row. */}
      <div className="spiral-mobile-row flex w-full gap-2 overflow-x-auto px-[calc(50%-160px)] py-10 md:hidden">
        {unique.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="relative w-[280px] flex-none overflow-hidden rounded-sm bg-photo-well"
            style={{ aspectRatio: CARD_ASPECT }}
          >
            <img
              src={product.images[0]}
              alt={product.name}
              className="absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] object-contain"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-start justify-end gap-1 p-5">
              <span className="font-display text-base uppercase tracking-[0.06em] text-ivory">
                {product.name}
              </span>
              {product.priceEffective > 0 && (
                <span className="text-xs tracking-[0.15em] text-gold tabular-nums">
                  {product.currency} {product.priceEffective.toLocaleString("en-US")}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      <style>{`
        .spiral-mobile-row {
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
        }
        .spiral-mobile-row::-webkit-scrollbar { display: none; }
        .spiral-mobile-row > a { scroll-snap-align: center; }
      `}</style>
    </section>
  );
}
