"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import { playKeySound } from "@/lib/keySound";

const WORD = "ATOREUM";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PROXIMITY_RADIUS = 1.6;

type Dims = { rows: number; cols: number };

// Singleton objects so useSyncExternalStore's Object.is check treats a
// re-evaluation of the same breakpoint as "unchanged" (no new reference).
const DIMS_MOBILE: Dims = { rows: 7, cols: 7 };
const DIMS_TABLET: Dims = { rows: 8, cols: 11 };
const DIMS_DESKTOP: Dims = { rows: 5, cols: 9 };

function getDims(): Dims {
  if (typeof window === "undefined") return DIMS_DESKTOP;
  if (window.matchMedia("(max-width: 639px)").matches) return DIMS_MOBILE;
  if (window.matchMedia("(min-width: 640px) and (max-width: 1023px)").matches) return DIMS_TABLET;
  return DIMS_DESKTOP;
}

function subscribeDims(callback: () => void) {
  const mqSmall = window.matchMedia("(max-width: 639px)");
  const mqMedium = window.matchMedia("(min-width: 640px) and (max-width: 1023px)");
  mqSmall.addEventListener("change", callback);
  mqMedium.addEventListener("change", callback);
  return () => {
    mqSmall.removeEventListener("change", callback);
    mqMedium.removeEventListener("change", callback);
  };
}

function getServerDims(): Dims {
  return DIMS_DESKTOP;
}

// Deterministic PRNG (mulberry32) seeded from grid dimensions, so the noise
// letters are identical between server render and client hydration — using
// Math.random() here would make every noise cell mismatch on hydration.
function createRng(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomLetter(rng: () => number, exclude?: string) {
  let letter: string;
  do {
    letter = ALPHABET[Math.floor(rng() * ALPHABET.length)];
  } while (exclude && letter === exclude);
  return letter;
}

type CellData = {
  original: string;
  hover: string;
  isWord: boolean;
};

function buildGrid(rows: number, cols: number): CellData[] {
  const rng = createRng(rows * 1000 + cols + 1);
  const cells: CellData[] = [];
  const wordRow = Math.floor(rows / 2);
  const wordStart = Math.floor((cols - WORD.length) / 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isWord = r === wordRow && c >= wordStart && c < wordStart + WORD.length;
      if (isWord) {
        const letter = WORD[c - wordStart];
        cells.push({ original: letter, hover: letter, isWord: true });
      } else {
        const original = randomLetter(rng);
        const hover = randomLetter(rng, original);
        cells.push({ original, hover, isWord: false });
      }
    }
  }
  return cells;
}

export default function LetterGrid() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeRef = useRef<Set<number>>(new Set());

  const dims = useSyncExternalStore(subscribeDims, getDims, getServerDims);
  const [isTouch, setIsTouch] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(hover: none), (pointer: coarse)").matches
  );
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const cells = useMemo(() => buildGrid(dims.rows, dims.cols), [dims]);

  // Cell indices are meaningless across a dimension change (rows/cols differ),
  // and the grid's key already forces React to remount + repopulate cellRefs.
  useEffect(() => {
    activeRef.current = new Set();
  }, [dims]);

  // Track reduced-motion preference and touch/pointer capability changes.
  useEffect(() => {
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => setReduceMotion(mqMotion.matches);
    mqMotion.addEventListener("change", applyMotion);

    const mqTouch = window.matchMedia("(hover: none), (pointer: coarse)");
    const applyTouch = () => setIsTouch(mqTouch.matches);
    mqTouch.addEventListener("change", applyTouch);

    return () => {
      mqMotion.removeEventListener("change", applyMotion);
      mqTouch.removeEventListener("change", applyTouch);
    };
  }, []);

  const setCellState = useCallback((index: number, hovered: boolean, withSound = false) => {
    const el = cellRefs.current[index];
    if (!el || el.dataset.word === "true") return;

    const wasActive = activeRef.current.has(index);
    if (hovered === wasActive) return;

    if (hovered) activeRef.current.add(index);
    else activeRef.current.delete(index);

    if (hovered && withSound) playKeySound();

    const target = hovered ? el.dataset.hover! : el.dataset.original!;

    gsap.killTweensOf(el);
    gsap
      .timeline()
      .to(el, { opacity: 0, scale: 0.55, duration: 0.12, ease: "power1.in" })
      .call(() => {
        el.textContent = target;
      })
      .to(el, { opacity: 1, scale: 1, duration: 0.18, ease: "back.out(2)" });
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const { rows, cols } = dims;
      const rect = container.getBoundingClientRect();
      const cellW = rect.width / cols;
      const cellH = rect.height / rows;
      const pointerCol = (event.clientX - rect.left) / cellW;
      const pointerRow = (event.clientY - rect.top) / cellH;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const dist = Math.hypot(c + 0.5 - pointerCol, r + 0.5 - pointerRow);
          setCellState(r * cols + c, dist <= PROXIMITY_RADIUS, true);
        }
      }
    },
    [dims, setCellState]
  );

  const handlePointerLeave = useCallback(() => {
    Array.from(activeRef.current).forEach((index) => setCellState(index, false));
  }, [setCellState]);

  useEffect(() => {
    if (isTouch || reduceMotion) return;
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [isTouch, reduceMotion, handlePointerMove, handlePointerLeave]);

  // Touch devices get no pointer tracking — a quiet ambient scramble instead.
  useEffect(() => {
    if (!isTouch || reduceMotion) return;
    const total = dims.rows * dims.cols;
    if (!total) return;

    const id = window.setInterval(() => {
      const index = Math.floor(Math.random() * total);
      setCellState(index, true);
      window.setTimeout(() => setCellState(index, false), 450);
    }, 260);

    return () => window.clearInterval(id);
  }, [isTouch, reduceMotion, dims, setCellState]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="relative grid w-full select-none gap-1 sm:gap-2"
      style={{
        aspectRatio: `${dims.cols} / ${dims.rows}`,
        gridTemplateColumns: `repeat(${dims.cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${dims.rows}, minmax(0, 1fr))`,
      }}
    >
      {cells.map((cell, index) => (
        <div
          key={`${dims.rows}x${dims.cols}-${index}`}
          ref={(el) => {
            cellRefs.current[index] = el;
          }}
          data-original={cell.original}
          data-hover={cell.hover}
          data-word={cell.isWord ? "true" : "false"}
          className={`flex items-center justify-center font-sans text-[24px] tracking-widest sm:text-[34px] md:text-[28px] ${
            cell.isWord ? "font-semibold text-ivory" : "text-ivory-dim/35"
          }`}
        >
          {cell.original}
        </div>
      ))}
    </div>
  );
}
