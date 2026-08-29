"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { playCardFlick } from "@/lib/keySound";

/**
 * Fallback pool only.
 *
 * The real list is read from the curated folder and passed in as `photos`
 * (see lib/data/cursorTrailPhotos.server.ts). These five stay as a floor so
 * the section still works if that read ever comes back empty. Shape is
 * assumed 4:5 here, which is what they are.
 */
const FALLBACK_SOURCES = [
  "/images/24K Gold Perfect Ampoule 50g/f56de9ef853768d1a0460e44d5e98fa6.png",
  "/images/Black Snail Eye Cream EX 40ml/Black Snail Cream.png",
  "/images/Aloe Solution Mask Pack 25g x 10pcs/Aloe Solution Mask Pack.png",
  "/images/Heeyul Premium 24K Gold Essence 130ml/Heeyul Premium 24K Gold Essence 130ml.png",
  "/images/Vitamin C Pure Emulsion 120ml/Vitamin C Pure Emulsion.png",
].map((src) => ({ src: encodeURI(src), width: 1080, height: 1350 }));

const MIN_DISTANCE = 40; // px the pointer must travel before the next image spawns
const IMAGE_SIZE = 150; // px wide, desktop — 200 read oversized on the page
const IMAGE_SIZE_TOUCH = 110; // px — proportionally smaller again on a phone
/**
 * The frame takes each photograph's own proportions.
 *
 * It was square with object-contain to begin with, so every photograph sat
 * letterboxed inside it and the rounded corners were rounding bare strips
 * rather than the picture. Fixing that to 4:5 fixed the 80 photographs that
 * are 4:5 and cropped the other 94 -- the tallest is 0.27 wide-to-high and
 * lost about two thirds of itself. So the frame is sized per photograph now,
 * fitted inside the bounds below: the whole product is visible, the corners
 * still curve on the picture, and no photograph can grow past the size the
 * others occupy.
 */
const HEIGHT_ALLOWANCE = 1.25; // frames may be this much taller than they are wide
const CORNER_RADIUS = 14; // px

/** Fit w×h inside the bounds, keeping its own ratio. */
function fitFrame(width: number, height: number, maxWidth: number) {
  const maxHeight = maxWidth * HEIGHT_ALLOWANCE;
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
const HOLD_SECONDS = 0.35; // how long an image stays at full scale before shrinking away
const MAX_ALIVE = 10; // cap so a fast flick across the section can't pile up forever

type TrailPhoto = { src: string; width: number; height: number };
type TrailItem = { id: number; x: number; y: number; photo: TrailPhoto; rotate: number };

function TrailImage({ item, size, onDone }: { item: TrailItem; size: number; onDone: (id: number) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const frame = fitFrame(item.photo.width, item.photo.height, size);

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
        left: item.x - frame.width / 2,
        top: item.y - frame.height / 2,
        width: frame.width,
        height: frame.height,
        transform: `rotate(${item.rotate}deg)`,
        // Clipped on the wrapper, so the curve holds whatever the photo's
        // own proportions turn out to be.
        borderRadius: CORNER_RADIUS,
        overflow: "hidden",
      }}
    >
      {/* next/image, not a raw <img>. These are full-resolution product
          photographs -- the heaviest is 3.9MB -- and the trail spawns a new
          one every 40px of pointer travel. Served raw that is megabytes per
          flick; asked for at the size it is actually drawn, it is a few tens
          of kilobytes. */}
      <Image
        src={item.photo.src}
        alt=""
        width={frame.width}
        height={frame.height}
        sizes={`${frame.width}px`}
        quality={70}
        // cover, but the frame already matches the photograph's ratio, so
        // there is nothing left for it to crop.
        className="h-full w-full object-cover"
      />
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
export default function CursorImageTrail({ photos }: { photos?: TrailPhoto[] }) {
  // The curated folder, with each photograph's real dimensions, so the frame
  // can take its shape instead of cropping it into a fixed one.
  const pool = photos && photos.length > 0 ? photos : FALLBACK_SOURCES;
  /**
   * Held in a ref, not read from the closure: the pointer effect runs once on
   * mount (it registers listeners and caches a rect), so a pool captured there
   * would be the one that existed at mount forever.
   */
  const poolRef = useRef(pool);
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

  /**
   * Shuffled per visit, on the client.
   *
   * The order arrives from the server the same every time, so the trail dealt
   * the same photographs in the same sequence on every visit and every reload.
   * Fisher-Yates gives a fresh order each time while still walking the whole
   * set before repeating -- picking at random per spawn would have shown the
   * same photograph twice in a row often enough to notice.
   *
   * After mount rather than during render: this must not run on the server, or
   * the two would disagree about what to draw.
   */
  useEffect(() => {
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    poolRef.current = shuffled;
    poolIndexRef.current = 0;
  }, [pool]);

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

      const currentPool = poolRef.current;
      const photo = currentPool[poolIndexRef.current % currentPool.length];
      poolIndexRef.current += 1;
      const id = idRef.current++;
      const rotate = (Math.random() - 0.5) * 24;

      // Each spawned photo is a card dealt off the deck — panned to where
      // the cursor is, dealt at the pace the hand is moving.
      playCardFlick((x / rect.width) * 2 - 1, speed);

      setItems((prev) => {
        const next = [...prev, { id, x, y, photo, rotate }];
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
