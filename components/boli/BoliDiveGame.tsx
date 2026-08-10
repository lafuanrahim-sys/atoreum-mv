"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/motion";
import { getDeviceHash } from "@/lib/boli/deviceHash";
import { msUntilNextMaleMidnight } from "@/lib/boli/diveEngine";
import { playRevealChime } from "@/lib/boli/gameAudio";
import DhoniTrail from "./DhoniTrail";
import type { DivePlayResult } from "@/lib/boli/dive.server";
import { DIVE_GRID_SIZE, DIVE_PICK_COUNT, DIVE_PAYOUT_TABLE, type DiveOutcomeTier } from "@/lib/boli/config";

/**
 * Sangu Dive — 9 balls, pick DIVE_PICK_COUNT blind, then everything opens
 * at once: match 2+ of your picks on the same tier and you win that
 * tier's value (all 3 matching pays a bonus); pick 3 different tiers and
 * you're paid on the lowest of them — never zero. All server state; this
 * component only presents an already-settled fact (BOLI_SPEC.md §6.4).
 *
 * Deliberately its OWN color system, hardcoded rather than the storefront's
 * theme tokens (--ink/--ivory/--gold): those flip with the site's light/
 * dark toggle and, in the light theme, --gold resolves to a muted dusty
 * rose, not gold — fine for restrained editorial UI, wrong for a game
 * screen that needs to read as dramatic and rarity-coded regardless of
 * which theme the rest of the site is in.
 */

const BG_DEEP = "#03070c";
/**
 * The water column, surface to floor. The screen used to be a near-flat
 * near-black with a gold blob and a cyan blob blurred over it, and the two
 * met in the middle as a muddy olive haze — it read as a dark room, not as
 * the sea. These are a real depth ramp instead: lit water at the surface,
 * the colour draining out of it with depth, black at the bottom.
 */
const WATER_TOP = "#12556d";
const WATER_MID = "#0a3a4e";
const WATER_LOW = "#05202e";
const WATER_DEEP = "#02101a";
const ABYSS = "#010a11";
const INK = "#f5efe4";
const INK_DIM = "#a79f8f";
const LINE = "rgba(245,239,228,0.16)";
const GOLD = "#f4c542";
const GOLD_DEEP = "#c99a2e";

/** The sphere's own shading, constant in every state. */
const OCCLUSION = "rgba(0,0,0,0.6)";
const SHEEN = "rgba(190,240,255,0.11)";
const DEPTH_SHADOW = "rgba(0,0,0,0.45)";
const CLEAR = "rgba(244,197,66,0)";

/**
 * Body of an unrevealed shell. Five stops rather than two: a sphere reads as
 * a sphere because the light falls off unevenly across it, and a two-stop
 * gradient falls off linearly, which is why the old balls looked like flat
 * discs with a smudge on them.
 */
const BALL_BODY = "radial-gradient(circle at 34% 26%, #4a7887 0%, #2c5567 20%, #183542 46%, #0b1b24 74%, #050e15 100%)";

/**
 * The same sphere, drained of hue, for a shell that has been opened. The
 * closed shell is teal because it is a thing sitting in water; an open one
 * has to carry its tier colour, and tier colour is the whole reveal — you
 * are meant to know how good it was before reading the number. Layering a
 * 16%-alpha tint over the teal body just produced nine teal balls with
 * differently coloured rings, which reads as "the board" rather than as
 * grey/green/blue/purple/gold.
 */
const BALL_BODY_OPEN = "radial-gradient(circle at 34% 26%, #39424a 0%, #242d34 20%, #151d23 46%, #0a1015 74%, #05090c 100%)";

/**
 * Every state returns the same six shadow layers, in the same order, with the
 * same inset flags — only colour and alpha change.
 *
 * This is not tidiness, it is the entire reason the selection glow animates
 * at all. CSS interpolates two box-shadow lists only when they match in
 * length AND in inset-ness layer by layer; when they don't, the property
 * jumps to its final value on the first frame. The old unselected state was a
 * single `0 0 0 transparent` against a two-layer inset+outer selected state,
 * so the gold bloom snapped on instantly mid-click and the 300ms transition
 * did nothing whatsoever. Measured in the browser, not inferred.
 *
 * The ring is a spread shadow rather than a thicker border for the same
 * reason in miniature: growing a border from 1.5px to 2px both snapped and
 * shifted the icon inside it by a quarter pixel.
 */
function ballShadow(ring: string, bloom: string, tint: string): string {
  return [
    `inset 0 -9px 18px ${OCCLUSION}`, // the sphere's dark underside
    `inset 0 7px 13px ${SHEEN}`, // light wrapping over the top
    `inset 0 0 15px ${tint}`, // state colour, bled in from the rim
    `0 0 0 1.5px ${ring}`,
    `0 0 26px ${bloom}`,
    `0 10px 22px ${DEPTH_SHADOW}`,
  ].join(", ");
}

type TodayResponse = {
  loggedIn: boolean;
  eligible?: boolean;
  ineligibleReason?: string | null;
  play?: DivePlayResult | null;
  hasSeenIntro?: boolean;
  streak?: { currentStreak: number; longestStreak: number; lastPlayDate: string | null; totalPlays: number };
  msUntilNextMaleMidnight?: number;
};

const MUTE_STORAGE_KEY = "atoreum_boli_dive_muted";

/** Rarity color language, gacha/loot-game standard: gray → green → blue → purple → gold. This alone is what makes a reveal legible as "how good" before the number is even read. `boli` mirrors DIVE_PAYOUT_TABLE so each ball can show its real value, not just a tier name. */
const TIER_STYLE: Record<DiveOutcomeTier, { color: string; soft: string; glow: string; label: string; particles: number; sparkles: boolean; boli: number }> = {
  common: { color: "#9aa5b1", soft: "rgba(154,165,177,0.16)", glow: "rgba(154,165,177,0.55)", label: "Common", particles: 6, sparkles: false, boli: DIVE_PAYOUT_TABLE.common.boli },
  uncommon: { color: "#3ddc97", soft: "rgba(61,220,151,0.16)", glow: "rgba(61,220,151,0.55)", label: "Uncommon", particles: 9, sparkles: false, boli: DIVE_PAYOUT_TABLE.uncommon.boli },
  rare: { color: "#4cc9f0", soft: "rgba(76,201,240,0.18)", glow: "rgba(76,201,240,0.6)", label: "Rare", particles: 13, sparkles: false, boli: DIVE_PAYOUT_TABLE.rare.boli },
  epic: { color: "#b46ef0", soft: "rgba(180,110,240,0.2)", glow: "rgba(180,110,240,0.65)", label: "Epic", particles: 20, sparkles: true, boli: DIVE_PAYOUT_TABLE.epic.boli },
  treasure: { color: GOLD, soft: "rgba(244,197,66,0.24)", glow: "rgba(244,197,66,0.8)", label: "Treasure!", particles: 32, sparkles: true, boli: DIVE_PAYOUT_TABLE.treasure.boli },
};

/** Rarest-last, for the tier legend shown while picking. */
const TIER_ORDER: DiveOutcomeTier[] = ["common", "uncommon", "rare", "epic", "treasure"];

const MATCH_LABEL: Record<DivePlayResult["matchType"], string> = {
  triple: "Triple match!",
  pair: "Matched!",
  none: "No match",
};

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const STAR_PATH = "M12 2 L14.6 9 L22 9.8 L16.5 14.9 L18.2 22 L12 18.1 L5.8 22 L7.5 14.9 L2 9.8 L9.4 9 Z";

/** How hard the screen reacts, scaled by tier — every reveal gets *something*, Treasure gets everything. */
const FLASH_PEAK: Record<DiveOutcomeTier, number> = {
  common: 0.08,
  uncommon: 0.13,
  rare: 0.2,
  epic: 0.35,
  treasure: 0.6,
};
const STAGE_ZOOM: Record<DiveOutcomeTier, number> = {
  common: 1.006,
  uncommon: 1.011,
  rare: 1.017,
  epic: 1.026,
  treasure: 1.04,
};

/** Ticks a number up from 0 to `to`, writing straight to the DOM (not React state) so it can run every frame without a re-render — settles on the exact final value. */
function countUp(el: HTMLElement | null, to: number, opts: { duration?: number; delay?: number } = {}) {
  if (!el) return;
  if (prefersReducedMotion()) {
    el.textContent = `+${to.toLocaleString()}`;
    return;
  }
  const counter = { val: 0 };
  gsap.to(counter, {
    val: to,
    duration: opts.duration ?? 0.65,
    delay: opts.delay ?? 0,
    ease: "power2.out",
    onUpdate: () => {
      el.textContent = `+${Math.round(counter.val).toLocaleString()}`;
    },
    onComplete: () => {
      el.textContent = `+${to.toLocaleString()}`;
    },
  });
}

/** Gold coins falling from the top of the screen — reserved for Treasure, the one outcome rare enough (0.5% per ball) to earn its own extra flourish beyond the particle burst every tier gets. */
function coinRain(container: HTMLElement) {
  if (prefersReducedMotion()) return;
  const count = 22;
  const width = container.getBoundingClientRect().width;
  for (let i = 0; i < count; i++) {
    const coin = document.createElement("span");
    const size = 10 + Math.random() * 10;
    coin.className = "pointer-events-none absolute rounded-full";
    coin.style.width = `${size}px`;
    coin.style.height = `${size}px`;
    coin.style.left = `${Math.random() * width}px`;
    coin.style.top = "-30px";
    coin.style.background = "radial-gradient(circle at 35% 30%, #ffe9a8, #f4c542 55%, #c99a2e)";
    coin.style.boxShadow = "0 0 8px rgba(244,197,66,0.6)";
    container.appendChild(coin);
    gsap.to(coin, {
      y: window.innerHeight * (0.5 + Math.random() * 0.4),
      rotate: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360),
      opacity: 0,
      duration: 1.4 + Math.random() * 0.8,
      delay: Math.random() * 0.5,
      ease: "power1.in",
      onComplete: () => coin.remove(),
    });
  }
}

/** A tier-colored burst — circular fragments for every tier, plus a few spinning star sparkles for Epic/Treasure. */
function burstParticles(container: HTMLElement, tier: DiveOutcomeTier) {
  if (prefersReducedMotion()) return;
  const style = TIER_STYLE[tier];
  const count = style.particles;
  const reach = 40 + count * 2.5;
  const rect = container.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;

  for (let i = 0; i < count; i++) {
    const useStar = style.sparkles && i % 5 === 0;
    const size = useStar ? 8 + Math.random() * 6 : 2.5 + Math.random() * 3;
    let el: HTMLElement | SVGElement;

    if (useStar) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", String(size));
      svg.setAttribute("height", String(size));
      svg.classList.add("pointer-events-none", "absolute");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", STAR_PATH);
      path.setAttribute("fill", style.color);
      svg.appendChild(path);
      el = svg;
    } else {
      const span = document.createElement("span");
      span.className = "pointer-events-none absolute rounded-full";
      span.style.width = `${size}px`;
      span.style.height = `${size}px`;
      span.style.background = Math.random() < 0.4 ? style.color : "#e8dcc0";
      el = span;
    }
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
    container.appendChild(el);

    const angle = Math.random() * Math.PI * 2;
    const distance = reach * (0.5 + Math.random() * 0.6);
    gsap.fromTo(
      el,
      { x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 },
      {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance - 8,
        opacity: 0,
        scale: useStar ? 0.2 : 0.3,
        rotate: useStar ? (Math.random() < 0.5 ? 180 : -180) : 0,
        duration: 0.6 + Math.random() * 0.35,
        ease: "power2.out",
        onComplete: () => el.remove(),
      }
    );
  }
}

/** Which of the 3 picked balls actually count toward the payout — all 3 on a triple, the 2 that share the winning tier on a pair, or just the single lowest-tier pick on a no-match. */
function getMatchedIndices(result: DivePlayResult): number[] {
  return result.pickedIndices.filter((i) => result.gridTiers[i] === result.outcomeTier);
}

export default function BoliDiveGame({
  dismissIntroAction,
  canReplayForTesting = false,
  replayAction,
}: {
  dismissIntroAction: () => Promise<void>;
  /** UNLIMITED_DIVE_PLAYS_FOR_ADMINS + admin role, resolved server-side — shows a "Play again (testing)" control after each reveal. See lib/boli/config.ts. */
  canReplayForTesting?: boolean;
  replayAction?: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<"loading" | "ineligible" | "picking" | "rolling" | "revealing" | "revealed">("loading");
  const [ineligibleReason, setIneligibleReason] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [board, setBoard] = useState<DiveOutcomeTier[] | null>(null);
  const [result, setResult] = useState<DivePlayResult | null>(null);
  const [previousStreakDay, setPreviousStreakDay] = useState<number | undefined>(undefined);
  const [showIntro, setShowIntro] = useState(false);
  const [muted, setMuted] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [msToMidnight, setMsToMidnight] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ballRefs = useRef<(HTMLDivElement | null)[]>([]);
  const numberElRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const idleGlowRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const numbersAnimatedRef = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const boardRowRef = useRef<HTMLDivElement | null>(null);
  const bubblesRef = useRef<HTMLDivElement | null>(null);
  const preRollStreakRef = useRef(0);
  const enteredRef = useRef(false);
  const idleTweenRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    try {
      // Sound defaults ON — only muted if the user explicitly turned it off before.
      setMuted(window.localStorage.getItem(MUTE_STORAGE_KEY) === "true");
    } catch {
      // localStorage unavailable — default to sound on.
    }
  }, []);

  // Full-screen takeover — lock the page behind it from scrolling too.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Drifting bubbles for ambient depth — decorative only, respects reduced motion by simply not rendering any.
  useEffect(() => {
    const container = bubblesRef.current;
    if (!container || prefersReducedMotion()) return;
    const bubbles: HTMLElement[] = [];
    const count = 14;
    for (let i = 0; i < count; i++) {
      const b = document.createElement("span");
      const size = 3 + Math.random() * 7;
      b.className = "pointer-events-none absolute rounded-full";
      b.style.width = `${size}px`;
      b.style.height = `${size}px`;
      b.style.left = `${Math.random() * 100}%`;
      b.style.bottom = `-20px`;
      b.style.background = "rgba(245,239,228,0.08)";
      b.style.boxShadow = "0 0 6px rgba(245,239,228,0.06)";
      container.appendChild(b);
      bubbles.push(b);
      gsap.to(b, {
        y: -(400 + Math.random() * 500),
        x: `+=${(Math.random() - 0.5) * 60}`,
        opacity: 0,
        duration: 8 + Math.random() * 8,
        delay: Math.random() * 10,
        repeat: -1,
        ease: "none",
        onRepeat: () => {
          gsap.set(b, { y: 0, opacity: 0.5, left: `${Math.random() * 100}%` });
        },
      });
    }
    return () => {
      bubbles.forEach((b) => {
        gsap.killTweensOf(b);
        b.remove();
      });
    };
  }, []);

  const toggleMuted = () => {
    setMuted((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(MUTE_STORAGE_KEY, String(next));
      } catch {
        // Best-effort persistence only.
      }
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/boli/dive/today")
      .then((res) => res.json())
      .then((data: TodayResponse) => {
        if (cancelled || !data.loggedIn) return;
        preRollStreakRef.current = data.streak?.currentStreak ?? 0;
        if (!data.eligible) {
          setIneligibleReason(data.ineligibleReason ?? "Sangu Dive isn't available right now.");
          setPhase("ineligible");
          return;
        }
        setShowIntro(!data.hasSeenIntro);
        if (data.play) {
          setResult(data.play);
          setBoard(data.play.gridTiers);
          setSelected(data.play.pickedIndices);
          setMsToMidnight(data.msUntilNextMaleMidnight ?? null);
          setPhase("revealed");
        } else {
          setPhase("picking");
          setMsToMidnight(data.msUntilNextMaleMidnight ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setPhase("ineligible");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Entrance: the 9 balls drop into place once there's something to show
  // for them (a fresh board to pick from, or a resumed/settled result) —
  // plays once per mount, not on every phase change.
  useEffect(() => {
    if (enteredRef.current) return;
    if (phase !== "picking" && phase !== "revealed") return;
    enteredRef.current = true;
    const els = ballRefs.current.filter(Boolean) as HTMLDivElement[];
    if (els.length === 0) return;
    if (prefersReducedMotion()) {
      gsap.set(els, { opacity: 1, y: 0, scale: 1 });
      return;
    }
    gsap.fromTo(
      els,
      { opacity: 0, y: -22, scale: 0.85 },
      { opacity: 1, y: 0, scale: 1, duration: 0.55, stagger: 0.05, ease: "back.out(1.6)" }
    );
  }, [phase]);

  // Resumed-on-load numbers: when the page loads straight into "revealed"
  // (today's play already happened), there's no live reveal moment to
  // animate through — just set the final numbers directly. A live reveal
  // (revealResult) marks numbersAnimatedRef true itself and handles its own
  // count-up, so this effect only ever fires for the resume case.
  useEffect(() => {
    if (phase !== "revealed" || !board || numbersAnimatedRef.current) return;
    numbersAnimatedRef.current = true;
    board.forEach((tier, i) => countUp(numberElRefs.current[i], TIER_STYLE[tier].boli, { duration: 0 }));
  }, [phase, board]);

  // Idle "alive" state — a slow, staggered breathing glow behind each
  // unpicked ball, so the board doesn't sit dead-still while choosing.
  // Deliberately does NOT move the ball itself (no bob/translate): a
  // drifting hit target is genuinely harder to tap precisely, for real
  // users and automated testing alike — the glow gets the "alive" feeling
  // without ever moving what you're aiming for. Killed once picking ends.
  useEffect(() => {
    idleTweenRef.current?.kill();
    idleTweenRef.current = null;
    if (phase !== "picking" || prefersReducedMotion()) return;
    const els = idleGlowRefs.current.filter(Boolean) as HTMLSpanElement[];
    if (els.length === 0) return;
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    els.forEach((el, i) => {
      tl.to(el, { opacity: 0.35, scale: 1.08, duration: 1.6, ease: "sine.inOut" }, (i % 3) * 0.2);
    });
    idleTweenRef.current = tl;
    return () => {
      tl.kill();
    };
  }, [phase]);

  useEffect(() => {
    if (msToMidnight === null || phase !== "revealed") return;
    const interval = window.setInterval(() => {
      setMsToMidnight((prev) => (prev === null ? null : Math.max(0, prev - 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [msToMidnight, phase]);

  const dismissIntro = () => {
    setShowIntro(false);
    dismissIntroAction().catch(() => {});
  };

  const [replaying, setReplaying] = useState(false);
  const handleReplay = useCallback(async () => {
    if (!replayAction || replaying) return;
    setReplaying(true);
    setError(null);
    try {
      await replayAction();
      ballRefs.current = [];
      numbersAnimatedRef.current = false;
      enteredRef.current = false;
      setSelected([]);
      setBoard(null);
      setResult(null);
      setPreviousStreakDay(undefined);
      setAnnouncement("Reset. Ready to play again.");
      setMsToMidnight(null);
      setPhase("picking");
    } catch {
      setError("Couldn't reset. Try again.");
    } finally {
      setReplaying(false);
    }
  }, [replayAction, replaying]);

  const fireHaptic = (tier: DiveOutcomeTier) => {
    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    const pattern: Record<DiveOutcomeTier, number | number[]> = {
      common: 12,
      uncommon: 15,
      rare: [15, 40, 15],
      epic: [18, 40, 18, 40, 18],
      treasure: [20, 30, 20, 30, 40, 30, 60],
    };
    try {
      navigator.vibrate(pattern[tier]);
    } catch {
      // Unsupported — silently skip.
    }
  };

  // Takes the fresh play as a PARAMETER rather than reading it from
  // `result` state — this fires from a setTimeout scheduled right after the
  // setState call that sets it, so a closure over the state would still
  // see the stale pre-update value. Passing it explicitly sidesteps that.
  const revealResult = useCallback(
    (play: DivePlayResult) => {
      setPhase("revealed");
      numbersAnimatedRef.current = true;
      if (!muted) playRevealChime(play.outcomeTier);
      const matched = getMatchedIndices(play);
      setAnnouncement(
        `${MATCH_LABEL[play.matchType]} You won ${play.totalPayout.toLocaleString()} Sangu${play.isGolden ? " on a Golden Shell day" : ""}.` +
          (play.chestSangu > 0 ? ` Plus a ${play.chestSangu.toLocaleString()} Sangu streak chest.` : "") +
          (play.shieldFired ? " Your shield caught a missed day." : "")
      );

      requestAnimationFrame(() => {
        const tier = play.outcomeTier;
        const style = TIER_STYLE[tier];
        fireHaptic(tier);

        // Every ball counts its number up from zero rather than snapping
        // straight to the final value, staggered a touch so the reveal
        // reads left-to-right rather than all at once.
        play.gridTiers.forEach((t, i) => {
          countUp(numberElRefs.current[i], TIER_STYLE[t].boli, { duration: 0.5, delay: 0.05 * i });
        });

        // The whole screen reacts to every reveal, scaled by rarity — a
        // barely-there pulse for Common, a real jolt for Treasure — so
        // nothing ever feels like a non-event, but the top tiers still
        // stand clearly apart.
        if (stageRef.current && !prefersReducedMotion()) {
          const flash = document.createElement("div");
          flash.className = "pointer-events-none absolute inset-0 z-20";
          flash.style.background = `radial-gradient(circle at 50% 40%, ${style.glow}, transparent 70%)`;
          flash.style.opacity = "0";
          stageRef.current.appendChild(flash);
          gsap.to(flash, {
            opacity: FLASH_PEAK[tier],
            duration: 0.15,
            yoyo: true,
            repeat: 1,
            onComplete: () => flash.remove(),
          });
          gsap
            .timeline()
            .to(stageRef.current, { scale: STAGE_ZOOM[tier], duration: 0.16, ease: "power2.out" })
            .to(stageRef.current, { scale: 1, duration: 0.35, ease: "power2.inOut" });
        }
        if (tier === "treasure" && stageRef.current && !prefersReducedMotion()) {
          coinRain(stageRef.current);
        }

        // The matched balls (the ones the payout is actually based on) get
        // the full punch + glow ring + particles; the rest of the board
        // just does the flip-open reveal below.
        matched.forEach((idx) => {
          const container = ballRefs.current[idx];
          if (!container) return;
          if (!prefersReducedMotion()) {
            gsap
              .timeline()
              .fromTo(container, { scale: 1 }, { scale: 1.22, duration: 0.22, ease: "power2.out" })
              .to(container, { scale: 1, duration: 0.38, ease: "elastic.out(1, 0.45)" });

            const glow = document.createElement("div");
            glow.className = "pointer-events-none absolute inset-0 rounded-full";
            glow.style.border = `2px solid ${style.color}`;
            glow.style.opacity = "0.95";
            container.appendChild(glow);
            const ringScale = tier === "treasure" ? 2.6 : tier === "epic" ? 2.15 : tier === "rare" ? 1.75 : tier === "uncommon" ? 1.5 : 1.3;
            gsap.fromTo(
              glow,
              { scale: 1, opacity: 0.95 },
              { scale: ringScale, opacity: 0, duration: 0.7, ease: "power2.out", onComplete: () => glow.remove() }
            );
          }
          burstParticles(container, tier);
        });

        // Treasure alone gets a shake on top of the always-on flash above —
        // the one outcome rare enough to earn a physical jolt.
        if (tier === "treasure" && boardRowRef.current && !prefersReducedMotion()) {
          gsap.fromTo(boardRowRef.current, { x: -6 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.3)", clearProps: "x" });
        }

        // Every ball on the board flips open, matched ones a beat ahead of
        // the rest — "the most important sentence in this document" now
        // applies to the whole board, not just two decoys.
        const els = ballRefs.current.filter(Boolean) as HTMLDivElement[];
        if (prefersReducedMotion()) {
          gsap.set(els, { opacity: 1, rotateY: 0 });
        } else {
          const matchedSet = new Set(matched);
          els.forEach((el, i) => {
            gsap.fromTo(
              el.querySelector("[data-face]"),
              { opacity: 0, rotateY: -100, transformPerspective: 400 },
              {
                opacity: 1,
                rotateY: 0,
                duration: 0.5,
                ease: "power3.out",
                delay: matchedSet.has(i) ? 0 : 0.12 + i * 0.03,
              }
            );
          });
        }
      });
    },
    [muted]
  );

  const handleConfirmPick = useCallback(
    async (picks: number[]) => {
      setPhase("rolling");
      setError(null);
      setAnnouncement("Opening the balls…");

      const deviceHash = await getDeviceHash();
      try {
        const res = await fetch("/api/boli/dive/play", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceHash, pickedIndices: picks }),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error ?? "Something went wrong. Try again.");
          setPhase("picking");
          setSelected([]);
          return;
        }

        const play: DivePlayResult = data.result;
        setBoard(play.gridTiers);
        setResult(play);
        setPreviousStreakDay(preRollStreakRef.current || undefined);
        setMsToMidnight(msUntilNextMaleMidnight(new Date()));
        setPhase("revealing");
        window.setTimeout(() => revealResult(play), 250);
      } catch {
        setError("Something went wrong. Try again.");
        setPhase("picking");
        setSelected([]);
      }
    },
    [revealResult]
  );

  const toggleBall = (index: number) => {
    if (phase !== "picking") return;
    setSelected((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index);
      if (prev.length >= DIVE_PICK_COUNT) return prev;
      const next = [...prev, index];
      if (next.length === DIVE_PICK_COUNT) {
        idleTweenRef.current?.kill();
        gsap.set(idleGlowRefs.current.filter(Boolean) as HTMLSpanElement[], { opacity: 0, scale: 1 });
        // Long enough for the third pick to visibly land before the board
        // starts revealing. At the old 300ms this fired exactly as the
        // selection transition finished, so the ball you just chose was
        // swallowed by the reveal and the choice never registered.
        window.setTimeout(() => handleConfirmPick(next), 520);
      }
      return next;
    });
  };

  if (phase === "loading") {
    // Was a blank dark div -- indistinguishable from a hang, especially on
    // a cold serverless DB connection where /api/boli/dive/today's first
    // hit of the day can take a real moment. A visible spinner at least
    // confirms something is happening.
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        // Same water ramp as the game itself, so the spinner sits in the
        // water the board is about to appear in rather than on a flat black
        // panel that then jumps.
        style={{
          background: `linear-gradient(to bottom, ${WATER_TOP} 0%, ${WATER_MID} 22%, ${WATER_LOW} 52%, ${WATER_DEEP} 78%, ${ABYSS} 100%)`,
        }}
        role="status"
        aria-label="Loading Sangu Dive"
      >
        <span
          aria-hidden="true"
          className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
          style={{ borderTopColor: GOLD, borderRightColor: "rgba(244,197,66,0.25)" }}
        />
      </div>
    );
  }

  const matchedIndices = result ? getMatchedIndices(result) : [];

  return (
    <div
      ref={stageRef}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto"
      style={{
        background: `linear-gradient(to bottom, ${WATER_TOP} 0%, ${WATER_MID} 22%, ${WATER_LOW} 52%, ${WATER_DEEP} 78%, ${ABYSS} 100%)`,
        color: INK,
      }}
    >
      {/* The water column. Decorative throughout — every layer is
          aria-hidden and sits below the board's z-10. See the
          "Sangu Dive: the water column" block in globals.css for why each
          layer is built the way it is. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* The sun, off the top edge at 66% — the point every shaft below
            radiates from, and deliberately off-centre: light dead overhead
            gives a symmetrical fan, which looks like a diagram. */}
        <div
          className="dive-sun absolute left-[66%] top-[-30%] h-[62%] w-[86%] -translate-x-1/2 rounded-[50%] blur-[60px]"
          style={{
            background:
              "radial-gradient(closest-side, rgba(240,254,255,0.62) 0%, rgba(158,236,255,0.3) 38%, rgba(80,180,220,0.1) 66%, transparent 82%)",
          }}
        />

        {/* Surface, shafts, floor. Order matters: the surface is above the
            shafts so the shafts appear to emerge from underneath it. */}
        <div className="dive-godray dive-godray-a" />
        <div className="dive-godray dive-godray-b" />

        <div className="dive-surface">
          <div className="dive-surface-layer dive-surface-a" />
          <div className="dive-surface-layer dive-surface-b" />
        </div>

        <div className="dive-floor">
          <div className="dive-floor-wash" />
          <div className="dive-floor-layer dive-floor-a" />
          <div className="dive-floor-layer dive-floor-b" />
        </div>

        {/* The shafts landing on that floor. Shares .dive-godray's geometry
            on purpose — same element box, same cone, same sway — so the lit
            patches cannot drift out of line with the shafts above them. */}
        <div className="dive-godray dive-godray-floor" />

        <div ref={bubblesRef} className="absolute inset-0" />

        {/* A pool of dark composited back over the middle of the screen.
            Not decoration — load-bearing. The board's whole visual language
            is faint tier glows on unlit spheres, and the supporting copy is
            a dim warm grey; both were designed against near-black, and lit
            water underneath them costs the copy about a third of its
            contrast. So the water is dimmed down the centre column, which
            also frames the play area and leaves the caustics and shafts
            reading at the edges where nothing has to be legible. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(66% 66% at 50% 40%, rgba(1,7,13,0.9) 0%, rgba(1,7,13,0.62) 42%, transparent 80%)",
          }}
        />
        {/* Scrim under the header. The surface is at its brightest precisely
            where the header sits, and measured against it "My Sangu" came out
            at 1.05:1 — the same luminance as its own background, which is to
            say invisible. Brightening the text doesn't rescue it; nothing
            legible sits on water that bright, so the water is darkened
            instead. Standard treatment for text over an image, and it reads
            as intent rather than as damage. */}
        <div
          className="absolute inset-x-0 top-0"
          style={{
            // Height inline rather than via a utility class: this is the only
            // place in the file that would have needed `h-32`, and it came out
            // of the build with no rule behind it, so the element rendered
            // 0px tall and the scrim silently did nothing. Every other layer
            // in this backdrop sizes itself inline anyway.
            height: "9rem",
            background: "linear-gradient(to bottom, rgba(1,10,16,0.91) 0%, rgba(1,10,16,0.47) 52%, transparent 100%)",
          }}
        />
        {/* An edge vignette to close the frame in. There used to be a solid
            fade to black across the bottom too; it has gone, because the
            floor is lit now and blacking it out is precisely what made the
            old version read as a dark room rather than as the sea. */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(122% 82% at 50% 40%, transparent 44%, rgba(1,6,11,0.62) 100%)" }}
        />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Link
          href="/account?tab=boli&boliView=my"
          className="text-xs uppercase tracking-[0.2em] transition-colors"
          style={{ color: INK_DIM }}
          onMouseEnter={(e) => (e.currentTarget.style.color = GOLD)}
          onMouseLeave={(e) => (e.currentTarget.style.color = INK_DIM)}
        >
          ← My Sangu
        </Link>
        <p className="font-display text-sm italic" style={{ color: INK_DIM }}>
          Sangu Dive
        </p>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 pb-16">
        {phase === "ineligible" ? (
          <p className="text-center text-sm" style={{ color: INK_DIM }}>
            {ineligibleReason}
          </p>
        ) : (
          <div className="w-full">
            {showIntro && (
              <div className="mb-8 border p-5" style={{ borderColor: "rgba(244,197,66,0.4)", background: "rgba(244,197,66,0.06)" }}>
                <p className="text-sm leading-relaxed" style={{ color: INK }}>
                  {/* Deliberately does not call sangu a historical currency:
                      the shell money of the Maldives was the cowrie, not the
                      conch. Conch was genuinely dived, traded and prized
                      across the Indian Ocean, which is what this says
                      instead — the claim stays true after the rename. */}
                  Conch, or <span style={{ color: GOLD }}>sangu</span>, has been dived from Maldivian reefs for as long
                  as anyone has sailed them, and carried far across the Indian Ocean as treasure.{" "}
                  {DIVE_GRID_SIZE} shells wait on the sand each day. Choose {DIVE_PICK_COUNT} blind. Match 2 or more
                  and you win that shell&apos;s value; the whole board opens either way, so you always see what the sea
                  gave up.
                </p>
                <button
                  type="button"
                  onClick={dismissIntro}
                  className="mt-3 text-xs uppercase tracking-[0.2em] hover:underline"
                  style={{ color: GOLD }}
                >
                  Got it
                </button>
              </div>
            )}

            {result?.isGolden && (phase === "revealing" || phase === "revealed") && (
              <p
                className="relative mb-4 inline-block overflow-hidden border px-3 py-1 text-xs uppercase tracking-[0.2em]"
                style={{ borderColor: GOLD, color: GOLD }}
              >
                Golden Shell day · 1.5× on every ball
              </p>
            )}

            {phase === "picking" && (
              <div className="mb-6 flex flex-col items-center gap-4">
                <p className="text-center text-xs uppercase tracking-[0.2em]" style={{ color: INK_DIM }}>
                  Choose {DIVE_PICK_COUNT} shells · {selected.length} of {DIVE_PICK_COUNT} picked
                </p>
                <p className="max-w-sm text-center text-xs leading-relaxed" style={{ color: INK_DIM }}>
                  Every shell hides a tier. Match {DIVE_PICK_COUNT - 1}+ of your picks on the same tier and you win
                  that tier&apos;s value. Match all {DIVE_PICK_COUNT} for a bonus. No match still pays the lowest of
                  your three, never nothing.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                  {TIER_ORDER.map((tier) => (
                    <span key={tier} className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em]" style={{ color: INK_DIM }}>
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full"
                        style={{ background: TIER_STYLE[tier].color, boxShadow: `0 0 6px ${TIER_STYLE[tier].glow}` }}
                      />
                      {TIER_STYLE[tier].label.replace("!", "")}
                      <span style={{ color: TIER_STYLE[tier].color }}>+{TIER_STYLE[tier].boli.toLocaleString()}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {phase === "revealed" && result && (
              <p
                className="mb-4 text-center text-sm font-semibold uppercase tracking-[0.15em]"
                style={{ color: result.matchType === "none" ? INK_DIM : TIER_STYLE[result.outcomeTier].color }}
              >
                {MATCH_LABEL[result.matchType]}
              </p>
            )}

            {error && (
              <p className="mb-4 text-center text-sm" style={{ color: "#f87171" }}>
                {error}
              </p>
            )}

            <div aria-live="polite" className="sr-only">
              {announcement}
            </div>

            <div ref={boardRowRef} className="grid grid-cols-3 place-items-center gap-3 sm:gap-5">
              {Array.from({ length: DIVE_GRID_SIZE }, (_, index) => {
                const tier = board?.[index] ?? null;
                const style = tier ? TIER_STYLE[tier] : null;
                const isSelected = selected.includes(index);
                const pickOrder = selected.indexOf(index) + 1; // 0 when unpicked
                const atCapacity = selected.length >= DIVE_PICK_COUNT;
                const isMatched = matchedIndices.includes(index);
                const revealed = phase === "revealed" && tier !== null;
                const disabled = phase !== "picking" || (!isSelected && selected.length >= DIVE_PICK_COUNT);

                return (
                  <div
                    key={index}
                    ref={(el) => {
                      ballRefs.current[index] = el;
                    }}
                    className="relative flex flex-col items-center gap-1.5"
                    style={{ opacity: enteredRef.current ? undefined : 0 }}
                  >
                    <div
                      // 340ms here and on the button below: the lift, the glow
                      // and the icon's turn are one gesture, and at 500 vs 300
                      // the glow finished while the ball was still growing,
                      // which is what made the pick feel like two events.
                      className="relative h-16 w-16 transition-[transform,opacity,filter] duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:h-24 sm:w-24"
                      style={{
                        // Your three stay raised once the board opens, and the
                        // six you didn't take drop back. Without this the
                        // result is nine identically-lit balls and the only
                        // thing marking your own picks is an 8px caption —
                        // the tier colours read as "what the board held",
                        // never as "what you chose". Matched picks sit a
                        // little higher again, since those are what actually
                        // paid.
                        transform:
                          isSelected && (phase === "picking" || phase === "revealed")
                            ? isMatched && phase === "revealed"
                              ? "scale(1.1)"
                              : "scale(1.07)"
                            : "scale(1)",
                        opacity:
                          !isSelected && ((phase === "picking" && atCapacity) || phase === "revealed") ? 0.35 : 1,
                        // Slight desaturation on the unpicked, so their tier
                        // colour still reads but never competes with yours.
                        filter: !isSelected && phase === "revealed" ? "saturate(0.55)" : "none",
                      }}
                    >
                      {/* Idle halo. Mounted for the whole picking phase and
                          faded out by CSS when chosen, rather than unmounted
                          on selection — pulling it out of the DOM mid-pulse
                          made the halo vanish on the same frame the click
                          landed, which read as a flicker. GSAP drives the
                          inner element; the outer only fades. Two elements so
                          neither has to know about the other. */}
                      {phase === "picking" && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-[-12%] transition-opacity duration-300 ease-out motion-reduce:transition-none"
                          style={{ opacity: isSelected ? 0 : 1 }}
                        >
                          <span
                            ref={(el) => {
                              idleGlowRefs.current[index] = el;
                            }}
                            className="absolute inset-0 rounded-full blur-lg"
                            style={{ background: "rgba(244,197,66,0.3)", opacity: 0 }}
                          />
                        </span>
                      )}

                      {/* One-shot ring pushed outward as the shell is taken,
                          like water displaced. Keyed on the pick order so it
                          re-fires if the same ball is deselected and chosen
                          again. */}
                      {isSelected && phase === "picking" && (
                        <span
                          key={`ring-${pickOrder}`}
                          aria-hidden="true"
                          className="dive-pick-ring pointer-events-none absolute inset-0 rounded-full"
                          style={{ border: `1.5px solid ${GOLD}`, opacity: 0 }}
                        />
                      )}
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleBall(index)}
                        aria-pressed={phase === "picking" ? isSelected : undefined}
                        aria-label={
                          revealed && style
                            ? `Ball ${index + 1}: ${style.label}, ${style.boli.toLocaleString()} Sangu${isSelected ? (isMatched ? ", matched" : ", your pick") : ""}`
                            : isSelected
                              ? `Ball ${index + 1}, selected`
                              : `Choose ball ${index + 1}`
                        }
                        className="relative flex h-full w-full items-center justify-center rounded-full transition-[box-shadow,opacity,transform] duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline focus-visible:outline-2 motion-reduce:transition-none disabled:cursor-default enabled:active:scale-[0.95]"
                        style={{
                          // Tier tint sits over the sphere body rather than
                          // replacing it, so a revealed shell keeps its
                          // shading instead of flattening into a coloured
                          // wash — style.soft is translucent, and on its own
                          // it let the water read straight through the ball.
                          // Two washes rather than one: the first sits under
                          // the highlight, the second lower and wider, so the
                          // tier colour covers the ball instead of pooling in
                          // one corner — while the neutral body underneath
                          // keeps the shading that makes it a sphere.
                          background:
                            revealed && style
                              ? `radial-gradient(circle at 34% 26%, ${style.soft}, transparent 60%), radial-gradient(circle at 52% 64%, ${style.soft}, transparent 78%), ${BALL_BODY_OPEN}`
                              : BALL_BODY,
                          boxShadow:
                            revealed && style
                              ? ballShadow(style.color, style.glow, style.soft)
                              : isSelected
                                ? ballShadow(GOLD, "rgba(244,197,66,0.5)", "rgba(244,197,66,0.22)")
                                : ballShadow(LINE, CLEAR, CLEAR),
                          outlineColor: GOLD,
                          color: INK,
                          opacity: phase === "revealing" && !revealed ? 0.85 : 1,
                        }}
                      >
                        {pickOrder > 0 && phase === "picking" && (
                          <span
                            aria-hidden="true"
                            className="dive-badge-in pointer-events-none absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums sm:h-6 sm:w-6 sm:text-xs"
                            style={{ background: GOLD, color: BG_DEEP, boxShadow: `0 0 12px ${GOLD}66` }}
                          >
                            {pickOrder}
                          </span>
                        )}

                        {/* Three lights, which is what separates a sphere
                            from a disc with a smudge on it: a broad diffuse
                            highlight where the light hits, a small hard
                            specular inside it for the wet look, and a cool
                            crescent along the bottom edge — light bouncing
                            back up off the water. The crescent is the one
                            doing most of the work; without it the lower half
                            of the ball has no edge and the shape dies. */}
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute left-[16%] top-[10%] h-[30%] w-[44%] -rotate-[18deg] rounded-full blur-[6px]"
                          style={{ background: "rgba(235,250,255,0.18)" }}
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute left-[27%] top-[17%] h-[8%] w-[11%] rounded-full blur-[1px]"
                          style={{ background: "rgba(255,255,255,0.55)" }}
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 rounded-full"
                          style={{
                            background:
                              "radial-gradient(circle at 50% 116%, rgba(150,228,255,0.34) 0%, rgba(150,228,255,0.1) 26%, transparent 46%)",
                          }}
                        />
                        <span data-face className="relative flex flex-col items-center">
                          {revealed && style ? (
                            <>
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl"
                                style={{ background: style.glow, opacity: 0.3 }}
                              />
                              <span
                                ref={(el) => {
                                  numberElRefs.current[index] = el;
                                }}
                                className="relative font-display text-sm tabular-nums sm:text-lg"
                                style={{ color: style.color }}
                              />
                              <span
                                className="relative mt-0.5 text-[7px] font-semibold uppercase tracking-[0.15em] sm:text-[8px]"
                                style={{ color: style.color, opacity: 0.85 }}
                              >
                                {style.label}
                              </span>
                            </>
                          ) : (
                            <svg
                              viewBox="0 0 20 20"
                              aria-hidden="true"
                              className="h-7 w-7 transition-[color,transform] duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:h-9 sm:w-9"
                              style={{
                                color: isSelected ? GOLD : INK_DIM,
                                // A quarter turn as it is chosen: the shell
                                // reads as being picked up and turned over,
                                // which is the one bit of motion here that
                                // carries meaning rather than decoration.
                                transform: isSelected ? "rotate(-90deg)" : "rotate(0deg)",
                              }}
                            >
                              <path
                                d="M16.8 10a6.8 6.8 0 1 1-6.8-6.8 5.2 5.2 0 0 1 5.2 5.2 3.9 3.9 0 0 1-3.9 3.9 2.9 2.9 0 0 1-2.9-2.9 2.1 2.1 0 0 1 2.1-2.1"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.9}
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                        </span>
                      </button>
                    </div>
                    <span
                      className={`text-[8px] uppercase tracking-[0.1em] transition-colors duration-500 sm:text-[9px] ${
                        isMatched ? "font-semibold" : ""
                      }`}
                      style={{
                        // "Your pick" was rendering in the same dim grey as
                        // an empty caption slot, which made the one pick that
                        // didn't match nearly invisible next to the two that
                        // did.
                        color: isMatched ? TIER_STYLE[result!.outcomeTier].color : isSelected ? INK : INK_DIM,
                      }}
                    >
                      {revealed
                        ? isSelected
                          ? isMatched
                            ? "Matched"
                            : "Your pick"
                          : ""
                        : isSelected
                          ? "Selected"
                          : ""}
                    </span>
                  </div>
                );
              })}
            </div>

            {phase === "revealed" && result && (
              <div className="mt-8 flex flex-col gap-6">
                <p className="text-center font-display text-3xl tabular-nums" style={{ color: TIER_STYLE[result.outcomeTier].color }}>
                  +{result.totalPayout.toLocaleString()} Sangu
                </p>

                {result.chestSangu > 0 && (
                  <p
                    className="border px-4 py-3 text-center text-sm"
                    style={{ borderColor: "rgba(244,197,66,0.4)", background: "rgba(244,197,66,0.08)", color: GOLD }}
                  >
                    Day {result.streakDay} chest · +{result.chestSangu.toLocaleString()} Sangu
                  </p>
                )}
                {result.shieldFired && (
                  <p className="text-center text-sm" style={{ color: INK_DIM }}>
                    Your shield caught that one. Streak protected.
                  </p>
                )}
                {result.wasClamped && (
                  <p className="text-center text-xs" style={{ color: INK_DIM, opacity: 0.8 }}>
                    Today&apos;s payout was capped by your weekly or monthly Sangu Dive limit.
                  </p>
                )}

                {canReplayForTesting && (
                  <div className="flex flex-col items-center gap-2 border border-dashed px-4 py-4" style={{ borderColor: "rgba(244,197,66,0.5)" }}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>
                      Testing mode
                    </p>
                    <button
                      type="button"
                      onClick={handleReplay}
                      disabled={replaying}
                      className="px-5 py-2 font-mono text-xs uppercase tracking-[0.15em] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: GOLD_DEEP, color: "#1a1206" }}
                    >
                      {replaying ? "Resetting…" : "Play again"}
                    </button>
                    <p className="text-center text-[11px]" style={{ color: INK_DIM }}>
                      Clears today&apos;s play so you can roll again. Admin-only, off before launch.
                    </p>
                  </div>
                )}

                <DhoniTrail streakDay={result.streakDay} previousStreakDay={previousStreakDay} shieldFired={result.shieldFired} />

                <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-6" style={{ borderColor: LINE }}>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em]" style={{ color: INK_DIM }}>
                      Back tomorrow
                    </p>
                    <p className="mt-1 font-mono text-lg tabular-nums" style={{ color: INK }}>
                      {msToMidnight !== null ? formatCountdown(msToMidnight) : "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleMuted}
                    aria-pressed={!muted}
                    className="text-xs uppercase tracking-[0.2em] transition-colors"
                    style={{ color: INK_DIM }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = GOLD)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = INK_DIM)}
                  >
                    Sound {muted ? "off" : "on"}
                  </button>
                </div>

                <Link
                  href="/products"
                  className="text-center text-xs uppercase tracking-[0.2em] hover:underline"
                  style={{ color: GOLD }}
                >
                  Browse the Collection →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
