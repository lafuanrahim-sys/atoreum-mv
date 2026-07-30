"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { playCardFlick } from "@/lib/keySound";

// Same product photos already wired into the coverflow section — reused
// here rather than picking new assets.
const TRAIL_IMAGES = [
  "/images/24K Gold Perfect Ampoule 50g/f56de9ef853768d1a0460e44d5e98fa6.png",
  "/images/Black Snail Eye Cream EX 40ml/Black Snail Cream.png",
  "/images/Aloe Solution Mask Pack 25g x 10pcs/Aloe Solution Mask Pack.png",
  "/images/Heeyul Premium 24K Gold Essence 130ml/Heeyul Premium 24K Gold Essence 130ml.png",
  "/images/Vitamin C Pure Emulsion 120ml/Vitamin C Pure Emulsion.png",
].map((src) => encodeURI(src));

const MIN_DISTANCE = 40; // px the pointer must travel before the next image spawns
const IMAGE_SIZE = 200; // px, square hit-box — matches the reference's fixed 200x200
const HOLD_SECONDS = 0.35; // how long an image stays at full scale before shrinking away
const MAX_ALIVE = 10; // cap so a fast flick across the section can't pile up forever

type TrailItem = { id: number; x: number; y: number; src: string; rotate: number };

function TrailImage({ item, onDone }: { item: TrailItem; onDone: (id: number) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Scale is the only thing that animates — at scale(0) the image is
    // already invisible, so there's no separate opacity/position fade,
    // matching the reference site's own recipe: a snappy pop in, then a
    // slower, accelerating shrink back to nothing.
    gsap.fromTo(el, { scale: 0 }, { scale: 1, duration: 0.45, ease: "power4.out" });
    const exit = gsap.to(el, {
      scale: 0,
      duration: 0.75,
      delay: HOLD_SECONDS,
      ease: "power3.in",
      onComplete: () => onDone(item.id),
    });

    return () => {
      exit.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute will-change-transform"
      style={{
        left: item.x - IMAGE_SIZE / 2,
        top: item.y - IMAGE_SIZE / 2,
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
        transform: `rotate(${item.rotate}deg)`,
      }}
    >
      <img src={item.src} alt="" className="h-full w-full rounded-lg object-contain" />
    </div>
  );
}

/**
 * A trail of product photos that pop in near the pointer and shrink away as
 * it moves across the section — driven by Pointer Events, which unify mouse
 * hover and a dragging finger under the same pointermove stream, so the
 * same listener drives both. touch-action: none on the listening container
 * stops the browser from treating the drag as a page-scroll gesture instead
 * (which would otherwise suppress/interrupt the pointermove stream on
 * touch). Only prefers-reduced-motion opts out.
 */
export default function CursorImageTrail() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const poolIndexRef = useRef(0);
  const idRef = useRef(0);
  const [items, setItems] = useState<TrailItem[]>([]);
  // "Move your cursor" doesn't describe a touchscreen gesture, so the
  // heading swaps to "A closer look" there; the static fanned hand below is
  // an idle hint shown only until the first touch, then replaced by the
  // same live trail the pointermove listener drives on desktop.
  const [isTouch, setIsTouch] = useState(false);

  const handleDone = useCallback((id: number) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  useEffect(() => {
    setIsTouch(window.matchMedia("(hover: none), (pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    function handlePointerMove(event: PointerEvent) {
      const rect = container!.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const now = performance.now();
      const last = lastPointRef.current;
      const dist = last ? Math.hypot(x - last.x, y - last.y) : Infinity;
      if (last && dist < MIN_DISTANCE) return;

      // Cursor velocity in px/ms, normalized to 0..1 — a lazy drift sits
      // around ~0.2 px/ms, a hard sweep 2.5+.
      const speed = last ? Math.min(1, dist / Math.max(1, now - last.t) / 2.5) : 0.5;
      lastPointRef.current = { x, y, t: now };

      const src = TRAIL_IMAGES[poolIndexRef.current % TRAIL_IMAGES.length];
      poolIndexRef.current += 1;
      const id = idRef.current++;
      const rotate = (Math.random() - 0.5) * 24;

      // Each spawned photo is a card dealt off the deck — panned to where
      // the cursor is, dealt at the pace the hand is moving.
      playCardFlick((x / rect.width) * 2 - 1, speed);

      setItems((prev) => {
        const next = [...prev, { id, x, y, src, rotate }];
        return next.length > MAX_ALIVE ? next.slice(next.length - MAX_ALIVE) : next;
      });
    }

    container.addEventListener("pointermove", handlePointerMove);
    return () => container.removeEventListener("pointermove", handlePointerMove);
  }, []);

  return (
    <section className="relative flex h-[70svh] w-full flex-col items-center justify-center gap-10 overflow-hidden bg-ink">
      <div className="pointer-events-none relative z-10 text-center">
        <p className="text-xs tracking-[0.3em] text-gold uppercase">Explore</p>
        <h2 className="mt-4 font-display text-2xl text-ivory md:text-4xl">
          {isTouch ? "Drag your finger" : "Move your cursor"}
        </h2>
      </div>

      {isTouch && items.length === 0 && (
        // Idle hint shown only until the first touch -- same photos, fanned
        // out like a dealt hand instead of spawned along a path that
        // doesn't exist yet. Replaced by the live trail below as soon as
        // items start arriving, same as desktop's own first-hover moment.
        <div className="pointer-events-none flex items-center justify-center">
          {TRAIL_IMAGES.map((src, i) => (
            <div
              key={src}
              className="-ml-6 h-20 w-20 shrink-0 rounded-lg bg-ink-2 shadow-lg first:ml-0 sm:h-24 sm:w-24"
              style={{
                transform: `rotate(${(i - (TRAIL_IMAGES.length - 1) / 2) * 8}deg)`,
                zIndex: i,
              }}
            >
              <img src={src} alt="" className="h-full w-full rounded-lg object-contain" />
            </div>
          ))}
        </div>
      )}

      <div ref={containerRef} className="absolute inset-0" style={{ touchAction: "none" }}>
        {items.map((item) => (
          <TrailImage key={item.id} item={item} onDone={handleDone} />
        ))}
      </div>
    </section>
  );
}
