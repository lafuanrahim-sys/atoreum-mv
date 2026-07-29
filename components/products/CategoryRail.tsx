"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * The category filter, ordered the way a routine is actually built —
 * Cleanse → Prep → Treat → Moisturize → Eye → Mask → Protect → Finish —
 * rather than alphabetically. A boxed pill grid doesn't have room to say
 * that; a single typographic line read left-to-right does. Any category not
 * accounted for below still appears (appended at the end), so a new
 * CATEGORIES entry can never silently vanish from the filter.
 */
const ROUTINE_ORDER = [
  "Foam",
  "Foam Pack 2in1",
  "Toner",
  "Toner Pad",
  "Essence",
  "Serum",
  "Ampoule",
  "Emulsion",
  "Lotion",
  "Cream",
  "Soothing Gel",
  "Eye Cream",
  "Mask Pack",
  "Sun Care",
  "Make-up",
];

export function orderCategoriesByRoutine(categories: readonly string[]): string[] {
  const known = ROUTINE_ORDER.filter((c) => categories.includes(c));
  const rest = categories.filter((c) => !ROUTINE_ORDER.includes(c));
  return [...known, ...rest];
}

// "Rotary Shelf" — every label sits at one constant size; selection is read
// entirely from the 3D arc (rotateY/scale/opacity by distance from the rail's
// centre), not from resizing the word. Tuned gentle: MAX_ROTATE stays well
// short of edge-on so labels several steps out are still legible.
const ARC_MAX_ROTATE = 22; // deg
const ARC_SCALE_FALLOFF = 0.14;
const ARC_OPACITY_FALLOFF = 0.5;
const ARC_LIFT = 7; // px, items away from centre drop slightly

export default function CategoryRail({
  categories,
  active,
  onChange,
  counts,
}: {
  /** Already in display order, "All" first — see orderCategoriesByRoutine. */
  categories: string[];
  active: string;
  onChange: (value: string) => void;
  counts: Record<string, number>;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [dragging, setDragging] = useState(false);

  // Every tab's rotateY/scale/opacity/lift comes from its own offset to the
  // rail's current centre — recomputed on every scroll frame (drag, momentum,
  // or programmatic re-centre), never precomputed once, so it always tracks
  // wherever the rail actually is.
  const applyArc = useCallback(() => {
    const rail = railRef.current;
    if (!rail || rail.clientWidth === 0) return;
    const center = rail.clientWidth / 2;
    for (const el of Object.values(tabRefs.current)) {
      if (!el) continue;
      const itemCenter = el.offsetLeft + el.offsetWidth / 2 - rail.scrollLeft;
      const norm = Math.max(-1, Math.min(1, (itemCenter - center) / center));
      const rotate = norm * ARC_MAX_ROTATE;
      const scale = 1 - Math.abs(norm) * ARC_SCALE_FALLOFF;
      const lift = Math.abs(norm) * ARC_LIFT;
      const opacity = 1 - Math.abs(norm) * ARC_OPACITY_FALLOFF;
      el.style.transform = `translateY(${lift}px) rotateY(${-rotate}deg) scale(${scale})`;
      el.style.opacity = String(opacity);
    }
  }, []);

  // Keep the active tab centred in the rail — on mount, and whenever
  // selection changes programmatically (URL restore, "Clear filters") or by
  // click/keyboard. First run snaps instantly; later ones glide, so landing
  // on the page never shows a slide-in.
  const mountedRef = useRef(false);
  useLayoutEffect(() => {
    const rail = railRef.current;
    const tab = tabRefs.current[active];
    if (!rail || !tab) return;
    const target = tab.offsetLeft + tab.offsetWidth / 2 - rail.clientWidth / 2;
    const max = rail.scrollWidth - rail.clientWidth;
    const clamped = Math.max(0, Math.min(max, target));
    rail.scrollTo({
      left: clamped,
      behavior: mountedRef.current && !prefersReducedMotion() ? "smooth" : "auto",
    });
    mountedRef.current = true;
    applyArc();
  }, [active, categories, applyArc]);

  // Recompute on resize/font-load — offsets shift, but the scroll position
  // itself is left alone (only a selection change re-centres).
  useEffect(() => {
    window.addEventListener("resize", applyArc);
    return () => window.removeEventListener("resize", applyArc);
  }, [applyArc]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    rail.addEventListener("scroll", applyArc, { passive: true });
    return () => rail.removeEventListener("scroll", applyArc);
  }, [applyArc]);

  // Grab-and-throw drag scroll for mouse/trackpad users, with real momentum
  // on release — a fast flick keeps coasting and decelerates on its own,
  // instead of stopping dead the instant the pointer lifts. Pointer capture
  // is deliberately NOT taken on pointerdown — capturing immediately hijacks
  // the click that a plain tap would otherwise fire on the button underneath
  // (setPointerCapture retargets the up/click pair to the capturing element).
  // Capture only kicks in once real movement past the threshold confirms
  // this is a drag, not a click.
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startScroll: number;
    lastX: number;
    lastT: number;
    velocity: number;
    captured: boolean;
  } | null>(null);
  const movedRef = useRef(false);
  const momentumRaf = useRef<number | null>(null);

  const stopMomentum = () => {
    if (momentumRaf.current !== null) {
      cancelAnimationFrame(momentumRaf.current);
      momentumRaf.current = null;
    }
  };
  useEffect(() => stopMomentum, []);

  const DRAG_THRESHOLD = 5; // px of real movement before this counts as a drag, not a click

  const onPointerDown = (e: React.PointerEvent) => {
    const rail = railRef.current;
    if (!rail || e.pointerType !== "mouse") return;
    stopMomentum();
    movedRef.current = false;
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startScroll: rail.scrollLeft,
      lastX: e.clientX,
      lastT: performance.now(),
      velocity: 0,
      captured: false,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const rail = railRef.current;
    const state = drag.current;
    if (!rail || !state) return;
    const dx = e.clientX - state.startX;

    if (!state.captured) {
      if (Math.abs(dx) <= DRAG_THRESHOLD) return; // still could be a click — don't touch scroll yet
      state.captured = true;
      movedRef.current = true;
      setDragging(true);
      rail.setPointerCapture(state.pointerId);
    }

    rail.scrollLeft = state.startScroll - dx;
    const now = performance.now();
    const dt = now - state.lastT;
    if (dt > 8) {
      state.velocity = (e.clientX - state.lastX) / dt; // px/ms
      state.lastX = e.clientX;
      state.lastT = now;
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const rail = railRef.current;
    const state = drag.current;
    setDragging(false);
    drag.current = null;
    if (!rail || !state || !state.captured) return; // never became a drag — leave the click alone

    try {
      rail.releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture already released — safe to ignore
    }
    if (prefersReducedMotion()) return;

    const maxThrow = 90; // px/frame ceiling so a jittery flick can't fling off-rail
    let v = Math.max(-maxThrow, Math.min(maxThrow, -state.velocity * 16));
    const friction = 0.945;
    const step = () => {
      rail.scrollLeft += v;
      v *= friction;
      const atStart = rail.scrollLeft <= 0;
      const atEnd = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 1;
      if (Math.abs(v) < 0.4 || atStart || atEnd) {
        momentumRaf.current = null;
        return;
      }
      momentumRaf.current = requestAnimationFrame(step);
    };
    if (Math.abs(v) > 0.4) momentumRaf.current = requestAnimationFrame(step);
  };

  const focusAndSelect = (category: string) => {
    onChange(category);
    tabRefs.current[category]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") nextIndex = Math.min(categories.length - 1, index + 1);
    else if (e.key === "ArrowLeft") nextIndex = Math.max(0, index - 1);
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = categories.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    focusAndSelect(categories[nextIndex]);
  };

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-line" />
        <span className="text-xs uppercase tracking-[0.3em] text-gold">Category</span>
        <span className="h-px w-8 bg-line" />
      </div>
      {/* touch-action:pan-x below md -- the drag handlers above are mouse-only
          (onPointerDown bails on any non-mouse pointerType, deliberately, so
          a tap still fires its button's click instead of being hijacked into
          a drag), so touch users depend entirely on the browser's own native
          horizontal pan for this overflow-x-auto rail. pan-y (the previous
          value, still used at md+ for parity even though touch panning is
          moot with mouse-only desktop drag) reserves *vertical* panning as
          this element's native gesture instead -- exactly backwards, since
          the rail has no vertical scroll at all, and it left horizontal
          touch swipes completely unhandled (not native, not JS). pan-x
          claims horizontal panning as native here and leaves vertical
          touches to bubble up to the page's own scroll, which is what was
          actually wanted. Native scroll already drives the 3D arc via the
          rail's own "scroll" listener below, so this needed no other
          change. */}
      <div
        ref={railRef}
        role="tablist"
        aria-label="Filter products by category"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`category-rail flex w-full items-center gap-6 overflow-x-auto px-6 py-4 sm:gap-9 sm:px-10 md:px-24 [-webkit-mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)] [mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)] sm:[-webkit-mask-image:linear-gradient(to_right,transparent,black_2.5rem,black_calc(100%-2.5rem),transparent)] sm:[mask-image:linear-gradient(to_right,transparent,black_2.5rem,black_calc(100%-2.5rem),transparent)] [perspective:800px] [scrollbar-width:none] [touch-action:pan-x] md:[touch-action:pan-y] [&::-webkit-scrollbar]:hidden ${
          dragging ? "[&_button]:pointer-events-none" : ""
        }`}
      >
        {categories.map((category, index) => {
          const isActive = category === active;
          return (
            <button
              key={category}
              ref={(el) => {
                tabRefs.current[category] = el;
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => {
                if (!movedRef.current) focusAndSelect(category);
              }}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={`flex shrink-0 cursor-pointer items-baseline gap-1.5 whitespace-nowrap text-xs uppercase tracking-[0.15em] transition-[color] duration-150 ease-out motion-reduce:transition-none will-change-transform ${
                isActive ? "text-ivory" : "text-ivory-dim hover:text-ivory"
              }`}
            >
              {category}
              <span className={`tabular-nums text-[10px] ${isActive ? "text-gold/80" : "text-ivory-dim/60"}`}>
                {counts[category] ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
