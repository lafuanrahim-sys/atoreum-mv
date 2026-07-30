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
const IMAGE_SIZE = 200; // px, square hit-box, desktop — matches the reference's fixed 200x200
const IMAGE_SIZE_TOUCH = 140; // px — 200 reads oversized on a phone-width section
const HOLD_SECONDS = 0.35; // how long an image stays at full scale before shrinking away
const MAX_ALIVE = 10; // cap so a fast flick across the section can't pile up forever

type TrailItem = { id: number; x: number; y: number; src: string; rotate: number };

function TrailImage({ item, size, onDone }: { item: TrailItem; size: number; onDone: (id: number) => void }) {
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
        left: item.x - size / 2,
        top: item.y - size / 2,
        width: size,
        height: size,
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
  // heading swaps for touch; also drives the smaller image size there
  // (200px reads oversized on a phone-width section) and nothing else --
  // no idle placeholder, the trail only appears once you actually drag.
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

    // getBoundingClientRect was previously called on every single pointermove
    // (a layout read on every native event, including the ones immediately
    // discarded by the MIN_DISTANCE check below). touch-action: none blocks
    // the page from scrolling out from under an active touch drag, but a
    // desktop mouse can still hover this section while the page scrolls via
    // wheel, which moves the container relative to the viewport without
    // firing pointermove -- so resize alone isn't enough to keep the cache
    // valid. Re-measuring on both resize and scroll (rAF-throttled, since
    // scroll can fire much faster than either is needed) keeps the cache
    // accurate while still removing the read from the pointermove hot path.
    let rect = container.getBoundingClientRect();
    let ticking = false;
    const remeasure = () => {
      rect = container!.getBoundingClientRect();
      ticking = false;
    };
    const scheduleRemeasure = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(remeasure);
    };
    window.addEventListener("resize", scheduleRemeasure);
    window.addEventListener("scroll", scheduleRemeasure, { passive: true });

    function handlePointerMove(event: PointerEvent) {
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

    container.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("resize", scheduleRemeasure);
      window.removeEventListener("scroll", scheduleRemeasure);
      container.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  return (
    <section className="relative flex h-70svh w-full flex-col items-center justify-center gap-10 overflow-hidden bg-ink">
      <div className="pointer-events-none relative z-10 text-center">
        <p className="text-xs tracking-[0.3em] text-gold uppercase">Explore</p>
        <h2 className="mt-4 font-display text-2xl text-ivory md:text-4xl">
          {isTouch ? "Drag your finger" : "Move your cursor"}
        </h2>
      </div>

      <div ref={containerRef} className="absolute inset-0" style={{ touchAction: "none" }}>
        {items.map((item) => (
          <TrailImage
            key={item.id}
            item={item}
            size={isTouch ? IMAGE_SIZE_TOUCH : IMAGE_SIZE}
            onDone={handleDone}
          />
        ))}
      </div>
    </section>
  );
}
