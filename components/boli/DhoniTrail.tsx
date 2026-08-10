"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/motion";
import { STREAK_CHEST_DAY } from "@/lib/boli/config";

/**
 * The Dhoni Trail (BOLI_SPEC.md §5.3, §9) — a 7-island streak map with the
 * boat animating from island N to N+1 on each consecutive play, treasure
 * chest waiting on island 7. `streakDay` is 1-indexed and clamped to
 * [1, STREAK_CHEST_DAY]; the boat's resting position always reflects the
 * most recently completed play, animating there once on mount/update.
 *
 * Hardcoded palette matching BoliDiveGame.tsx's game colors, not the
 * storefront's theme tokens — see that file's header comment for why.
 */
const GOLD = "#f4c542";
const INK_DIM = "#a79f8f";
const INK = "#f5efe4";

const ISLAND_COUNT = STREAK_CHEST_DAY;
const WIDTH = 320;
const HEIGHT = 72;

function islandX(index: number): number {
  // index is 0-based across ISLAND_COUNT islands, evenly spaced with margin.
  const margin = 24;
  const span = WIDTH - margin * 2;
  return margin + (span * index) / (ISLAND_COUNT - 1);
}

export default function DhoniTrail({
  streakDay,
  previousStreakDay,
  shieldFired,
}: {
  streakDay: number;
  /** Only pass this right after a play completes in this session — it's what lets the boat visibly travel from yesterday's island rather than just appearing at today's. Omit on a plain page load/reload. */
  previousStreakDay?: number;
  shieldFired: boolean;
}) {
  const boatRef = useRef<SVGGElement | null>(null);
  const chestGlowRef = useRef<SVGCircleElement | null>(null);
  const clampedDay = Math.min(Math.max(1, streakDay), ISLAND_COUNT);
  const boatX = islandX(clampedDay - 1);
  const startDay = previousStreakDay ? Math.min(Math.max(1, previousStreakDay), ISLAND_COUNT) : clampedDay;
  const chestReached = clampedDay >= ISLAND_COUNT;

  useEffect(() => {
    const boat = boatRef.current;
    if (!boat) return;
    gsap.set(boat, { x: islandX(startDay - 1) });
    if (startDay === clampedDay || prefersReducedMotion()) {
      gsap.set(boat, { x: boatX });
    } else {
      gsap.to(boat, { x: boatX, duration: 1.1, ease: "power2.inOut", delay: 0.2 });
    }
    // A gentle idle bob so the boat doesn't sit dead-still once it arrives.
    if (!prefersReducedMotion()) {
      gsap.to(boat, { y: "-=3", duration: 1.6, delay: 1.3, repeat: -1, yoyo: true, ease: "sine.inOut" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boatX, startDay]);

  useEffect(() => {
    const glow = chestGlowRef.current;
    if (!glow || !chestReached || prefersReducedMotion()) return;
    gsap.to(glow, { opacity: 0.15, r: 15, duration: 1.1, repeat: -1, yoyo: true, ease: "sine.inOut" });
  }, [chestReached]);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mx-auto block h-16 w-full max-w-sm"
        role="img"
        aria-label={`Streak day ${clampedDay} of ${ISLAND_COUNT}${shieldFired ? ", your shield caught a missed day" : ""}`}
      >
        <path
          d={`M ${islandX(0)} ${HEIGHT / 2} L ${islandX(ISLAND_COUNT - 1)} ${HEIGHT / 2}`}
          stroke={INK_DIM}
          strokeOpacity={0.3}
          strokeWidth={1.5}
          strokeDasharray="2 5"
        />
        {Array.from({ length: ISLAND_COUNT }, (_, i) => {
          const reached = i + 1 <= clampedDay;
          const isChest = i + 1 === ISLAND_COUNT;
          return (
            <g key={i} transform={`translate(${islandX(i)}, ${HEIGHT / 2})`}>
              {isChest && (
                <circle ref={chestGlowRef} r={11} fill={GOLD} opacity={reached ? 0.3 : 0} />
              )}
              <circle r={isChest ? 9 : 6} fill={reached ? GOLD : "rgba(167,159,143,0.3)"} />
              {isChest && (
                <text
                  y={-16}
                  textAnchor="middle"
                  className="font-mono text-[8px] uppercase tracking-[0.1em]"
                  fill={reached ? GOLD : "rgba(167,159,143,0.5)"}
                >
                  Chest
                </text>
              )}
            </g>
          );
        })}
        <g ref={boatRef} transform={`translate(0, ${HEIGHT / 2 - 16})`}>
          <path
            d="M -9 6 L 9 6 L 6 12 L -6 12 Z M -1.5 -8 L 1.5 -8 L 1.5 6 L -1.5 6 Z M 1.5 -6 L 8 0 L 1.5 3 Z"
            fill={INK}
          />
        </g>
      </svg>
    </div>
  );
}
