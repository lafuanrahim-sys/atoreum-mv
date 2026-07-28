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
 * Boli Dive — 9 balls, pick DIVE_PICK_COUNT blind, then everything opens
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
const BG_MID = "#0a2230";
const INK = "#f5efe4";
const INK_DIM = "#a79f8f";
const LINE = "rgba(245,239,228,0.16)";
const GOLD = "#f4c542";
const GOLD_DEEP = "#c99a2e";

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
          setIneligibleReason(data.ineligibleReason ?? "Boli Dive isn't available right now.");
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
      setAnnouncement("Reset — ready to play again.");
      setMsToMidnight(null);
      setPhase("picking");
    } catch {
      setError("Couldn't reset — try again.");
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
        `${MATCH_LABEL[play.matchType]} You won ${play.totalPayout.toLocaleString()} Boli${play.isGolden ? " on a Golden Shell day" : ""}.` +
          (play.chestBoli > 0 ? ` Plus a ${play.chestBoli.toLocaleString()} Boli streak chest.` : "") +
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
          setError(data.error ?? "Something went wrong — try again.");
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
        setError("Something went wrong — try again.");
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
        window.setTimeout(() => handleConfirmPick(next), 300);
      }
      return next;
    });
  };

  if (phase === "loading") {
    return <div className="fixed inset-0 z-50" style={{ background: BG_DEEP }} role="status" aria-label="Loading Boli Dive" />;
  }

  const matchedIndices = result ? getMatchedIndices(result) : [];

  return (
    <div
      ref={stageRef}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto"
      style={{
        background: `radial-gradient(120% 90% at 50% -10%, ${BG_MID} 0%, ${BG_DEEP} 55%, #010305 100%)`,
        color: INK,
      }}
    >
      {/* Ambient backdrop — warm gold glow, a cooler deep-water glow, and drifting bubbles. Decorative only. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute left-1/2 top-[10%] h-[440px] w-[440px] -translate-x-1/2 rounded-full blur-[110px]"
          style={{ background: "rgba(244,197,66,0.14)" }}
        />
        <div
          className="absolute -bottom-24 right-[-10%] h-[380px] w-[380px] rounded-full blur-[120px]"
          style={{ background: "rgba(76,201,240,0.1)" }}
        />
        <div ref={bubblesRef} className="absolute inset-0" />
        <div
          className="absolute bottom-0 left-0 h-40 w-full"
          style={{ background: `linear-gradient(to top, ${BG_DEEP}, transparent)` }}
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
          ← My Boli
        </Link>
        <p className="font-display text-sm italic" style={{ color: INK_DIM }}>
          Boli Dive
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
                  Cowrie shells — <span style={{ color: GOLD }}>boli</span> — were currency across the Maldives and the
                  Indian Ocean for centuries before paper money. {DIVE_GRID_SIZE} shells wait on the sand each day —
                  choose {DIVE_PICK_COUNT} blind. Match 2 or more and you win that shell&apos;s value; the whole board
                  opens either way, so you always see what the sea gave up.
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
                Golden Shell day — 1.5× on every ball
              </p>
            )}

            {phase === "picking" && (
              <div className="mb-6 flex flex-col items-center gap-4">
                <p className="text-center text-xs uppercase tracking-[0.2em]" style={{ color: INK_DIM }}>
                  Choose {DIVE_PICK_COUNT} shells — {selected.length} of {DIVE_PICK_COUNT} picked
                </p>
                <p className="max-w-sm text-center text-xs leading-relaxed" style={{ color: INK_DIM }}>
                  Every shell hides a tier. Match {DIVE_PICK_COUNT - 1}+ of your picks on the same tier and you win
                  that tier&apos;s value — match all {DIVE_PICK_COUNT} for a bonus. No match still pays the lowest of
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
                    <div className="relative h-16 w-16 sm:h-24 sm:w-24">
                      {phase === "picking" && !isSelected && (
                        <span
                          ref={(el) => {
                            idleGlowRefs.current[index] = el;
                          }}
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-[-12%] rounded-full blur-lg"
                          style={{ background: "rgba(244,197,66,0.3)", opacity: 0 }}
                        />
                      )}
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleBall(index)}
                        aria-pressed={phase === "picking" ? isSelected : undefined}
                        aria-label={
                          revealed && style
                            ? `Ball ${index + 1}: ${style.label}, ${style.boli.toLocaleString()} Boli${isSelected ? (isMatched ? " — matched" : " — your pick") : ""}`
                            : isSelected
                              ? `Ball ${index + 1}, selected`
                              : `Choose ball ${index + 1}`
                        }
                        className="relative flex h-full w-full items-center justify-center rounded-full transition-[box-shadow,opacity,transform] duration-300 focus-visible:outline focus-visible:outline-2 disabled:cursor-default enabled:active:scale-95"
                        style={{
                          background: revealed && style
                            ? `radial-gradient(circle at 35% 28%, ${style.soft}, #0a161c 72%)`
                            : "radial-gradient(circle at 35% 28%, #24404c, #0a161c 75%)",
                          border: `1.5px solid ${revealed && style ? style.color : isSelected ? GOLD : LINE}`,
                          boxShadow: revealed && style
                            ? `0 0 20px ${style.glow}`
                            : isSelected
                              ? `0 0 14px rgba(244,197,66,0.45)`
                              : "0 0 0 rgba(0,0,0,0)",
                          outlineColor: GOLD,
                          color: INK,
                          opacity: phase === "revealing" && !revealed ? 0.85 : 1,
                        }}
                      >
                        {/* Shine highlight — a soft arc near the top so the ball reads as dimensional, not a flat disc. */}
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute left-[18%] top-[12%] h-[28%] w-[42%] rounded-full blur-[5px]"
                          style={{ background: "rgba(245,239,228,0.14)" }}
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
                            <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7 sm:h-9 sm:w-9" style={{ color: isSelected ? GOLD : INK_DIM }}>
                              <path
                                d="M16 4c6.5 0 10.5 6.5 10.5 12.5S22.5 28 16 28 5.5 22.5 5.5 16.5 9.5 4 16 4Z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.4}
                              />
                              <path d="M16 10v12" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
                            </svg>
                          )}
                        </span>
                      </button>
                    </div>
                    <span className="text-[8px] uppercase tracking-[0.1em] sm:text-[9px]" style={{ color: isMatched ? TIER_STYLE[result!.outcomeTier].color : INK_DIM }}>
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
                  +{result.totalPayout.toLocaleString()} Boli
                </p>

                {result.chestBoli > 0 && (
                  <p
                    className="border px-4 py-3 text-center text-sm"
                    style={{ borderColor: "rgba(244,197,66,0.4)", background: "rgba(244,197,66,0.08)", color: GOLD }}
                  >
                    Day {result.streakDay} chest — +{result.chestBoli.toLocaleString()} Boli
                  </p>
                )}
                {result.shieldFired && (
                  <p className="text-center text-sm" style={{ color: INK_DIM }}>
                    Your shield caught that one — streak protected.
                  </p>
                )}
                {result.wasClamped && (
                  <p className="text-center text-xs" style={{ color: INK_DIM, opacity: 0.8 }}>
                    Today&apos;s payout was capped by your weekly or monthly Boli Dive limit.
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
                      Clears today&apos;s play so you can roll again — admin-only, off before launch.
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
