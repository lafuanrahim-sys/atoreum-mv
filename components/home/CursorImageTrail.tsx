"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";

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
 * A trail of product photos that pop in near the cursor and shrink away as
 * it moves across the section — mouse-only (skipped for touch/coarse
 * pointers and prefers-reduced-motion), matching the interaction
 * conventions already used in LetterGrid.
 */
export default function CursorImageTrail() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const poolIndexRef = useRef(0);
  const idRef = useRef(0);
  const [items, setItems] = useState<TrailItem[]>([]);

  const handleDone = useCallback((id: number) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isTouch || reduceMotion) return;

    function handlePointerMove(event: PointerEvent) {
      const rect = container!.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const last = lastPointRef.current;
      if (last && Math.hypot(x - last.x, y - last.y) < MIN_DISTANCE) return;
      lastPointRef.current = { x, y };

      const src = TRAIL_IMAGES[poolIndexRef.current % TRAIL_IMAGES.length];
      poolIndexRef.current += 1;
      const id = idRef.current++;
      const rotate = (Math.random() - 0.5) * 24;

      setItems((prev) => {
        const next = [...prev, { id, x, y, src, rotate }];
        return next.length > MAX_ALIVE ? next.slice(next.length - MAX_ALIVE) : next;
      });
    }

    container.addEventListener("pointermove", handlePointerMove);
    return () => container.removeEventListener("pointermove", handlePointerMove);
  }, []);

  return (
    <section className="relative flex h-[70svh] w-full items-center justify-center overflow-hidden bg-ink">
      <div className="pointer-events-none relative z-10 text-center">
        <p className="text-xs tracking-[0.3em] text-gold uppercase">Explore</p>
        <h2 className="mt-4 font-display text-2xl text-ivory md:text-4xl">Move your cursor</h2>
      </div>

      <div ref={containerRef} className="absolute inset-0">
        {items.map((item) => (
          <TrailImage key={item.id} item={item} onDone={handleDone} />
        ))}
      </div>
    </section>
  );
}
