import crypto from "crypto";
import {
  DIVE_PAYOUT_TABLE,
  DIVE_GRID_SIZE,
  TRIPLE_MATCH_MULTIPLIER,
  LONE_TREASURE_CONSOLATION_BOLI,
  PITY_COUNTER_WINDOW,
  PITY_MINIMUM_TIER,
  PITY_BOOST_BALL_COUNT,
  STREAK_MULTIPLIER_START_DAY,
  STREAK_MULTIPLIER,
  GOLDEN_SALT,
  BOLI_TIMEZONE,
  type DiveOutcomeTier,
} from "./config";

/**
 * Boli Dive's roll engine — pure functions only, no I/O, no Date.now(),
 * every source of randomness or "now" passed in explicitly. This is what
 * BOLI_SPEC.md §10 (Phase 2, item 1) means by "fully unit tested — assert
 * the empirical distribution over 100k seeded rolls matches the table
 * within tolerance": none of this is testable that way if it reaches out to
 * the database or the system clock itself. The transactional, stateful
 * parts (streak persistence, cap accounting, idempotency) live in
 * lib/boli/schema.sql's boli_dive_play() and lib/boli/dive.server.ts, which
 * call these functions rather than duplicate their logic.
 */

export type Rng = () => number; // uniform [0, 1)

/** Not cryptographically required (this isn't adversarial-security-critical — see BOLI_SPEC.md §6.4), just unpredictable per-roll. Node's crypto is a convenient, already-imported source. */
export function defaultRng(): number {
  return crypto.randomInt(0, 1_000_000_000) / 1_000_000_000;
}

/** Deterministic seeded PRNG (mulberry32) — for tests only, so a roll sequence is exactly reproducible from a seed. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TIER_ORDER: DiveOutcomeTier[] = ["common", "uncommon", "rare", "epic", "treasure"];

function pickWeighted(rng: Rng, weights: Record<DiveOutcomeTier, number>): DiveOutcomeTier {
  const roll = rng();
  let cumulative = 0;
  for (const tier of TIER_ORDER) {
    cumulative += weights[tier];
    if (roll < cumulative) return tier;
  }
  return TIER_ORDER[TIER_ORDER.length - 1]; // floating-point safety net — weights sum to ~1
}

/** The real, credited roll — straight from the payout table's weights (BOLI_SPEC.md §5.2). */
export function rollOutcome(rng: Rng = defaultRng): DiveOutcomeTier {
  const weights = Object.fromEntries(TIER_ORDER.map((t) => [t, DIVE_PAYOUT_TABLE[t].weight])) as Record<
    DiveOutcomeTier,
    number
  >;
  return pickWeighted(rng, weights);
}

/** Deals the day's board — DIVE_GRID_SIZE independent rolls, each from the exact same weights as before (a ball is exactly as likely to be a Treasure as the old single roll was). */
export function rollGrid(rng: Rng = defaultRng): DiveOutcomeTier[] {
  return Array.from({ length: DIVE_GRID_SIZE }, () => rollOutcome(rng));
}

/**
 * If the last PITY_COUNTER_WINDOW plays all resolved at/below Common,
 * bumps PITY_BOOST_BALL_COUNT random balls on today's board up to at least
 * PITY_MINIMUM_TIER before dealing — a better CHANCE at a big match, not a
 * guaranteed one, since the player still has to blindly pick 2 of the
 * boosted balls together. Never downgrades a ball that already rolled
 * higher than the pity floor.
 */
export function applyGridPity(tiers: DiveOutcomeTier[], recentOutcomesNewestFirst: DiveOutcomeTier[], rng: Rng = defaultRng): DiveOutcomeTier[] {
  const window = recentOutcomesNewestFirst.slice(0, PITY_COUNTER_WINDOW);
  const pityActive = window.length === PITY_COUNTER_WINDOW && window.every((t) => t === "common");
  if (!pityActive) return tiers;

  const minIndex = TIER_ORDER.indexOf(PITY_MINIMUM_TIER);
  const boosted = [...tiers];
  const positions = Array.from({ length: boosted.length }, (_, i) => i);
  // Fisher–Yates shuffle (seeded via rng) so the boosted positions are
  // unpredictable, then take the first PITY_BOOST_BALL_COUNT.
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  for (const pos of positions.slice(0, PITY_BOOST_BALL_COUNT)) {
    if (TIER_ORDER.indexOf(boosted[pos]) < minIndex) boosted[pos] = PITY_MINIMUM_TIER;
  }
  return boosted;
}

export type PickMatchType = "triple" | "pair" | "none";
export type PickEvaluation = { matchType: PickMatchType; tier: DiveOutcomeTier; basePayout: number };

/**
 * Pure match-resolution for a "pick 3 of 9" play: all 3 the same tier is a
 * triple (bonus multiplier applied by the caller), exactly 2 the same is a
 * pair (that tier's value), and 3 different tiers pays the LOWEST of the
 * three — never zero, same "always a small win" principle as before.
 *
 * One exception: three different tiers INCLUDING a Treasure pays the lone
 * Treasure consolation instead of the lowest. Without it, Treasure only ever
 * paid on a pair or better — 1 play in 12,422, about once every 34 years for
 * a daily player — so the rarest thing on the board was one virtually no
 * customer would ever be paid for. It stays classified as "none": nothing was
 * matched, and calling it a match would misreport the outcome to the ledger
 * and to the player.
 */
export function evaluatePick(tiers: DiveOutcomeTier[], pickedIndices: number[]): PickEvaluation {
  const picked = pickedIndices.map((i) => tiers[i]);
  const counts = new Map<DiveOutcomeTier, number>();
  for (const t of picked) counts.set(t, (counts.get(t) ?? 0) + 1);

  for (const [tier, count] of counts) {
    if (count === 3) return { matchType: "triple", tier, basePayout: DIVE_PAYOUT_TABLE[tier].boli };
  }
  for (const [tier, count] of counts) {
    if (count === 2) return { matchType: "pair", tier, basePayout: DIVE_PAYOUT_TABLE[tier].boli };
  }
  const lowest = picked.reduce((worst, t) => (TIER_ORDER.indexOf(t) < TIER_ORDER.indexOf(worst) ? t : worst));
  if (picked.includes("treasure")) {
    // Reported against the treasure tier, not the lowest, so the reveal can
    // colour and label it as the treasure it actually is.
    return { matchType: "none", tier: "treasure", basePayout: LONE_TREASURE_CONSOLATION_BOLI };
  }
  return { matchType: "none", tier: lowest, basePayout: DIVE_PAYOUT_TABLE[lowest].boli };
}

export { TRIPLE_MATCH_MULTIPLIER };

/**
 * Golden Shell day (BOLI_SPEC.md §5.4): one weekday per ISO week, identical
 * for every user, unpredictable week to week, reproducible in tests —
 * `hash(isoWeekNumber + GOLDEN_SALT) % 7`. Never derived from anything a
 * client could see in advance.
 */
export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function isoWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

/** 0 (Monday) – 6 (Sunday), matching JS's ISO weekday minus one, for the golden-day weekday check below. */
function isoWeekday0(date: Date): number {
  return (date.getUTCDay() || 7) - 1;
}

export function isGoldenShellDay(date: Date, salt: string = GOLDEN_SALT): boolean {
  const key = `${isoWeekYear(date)}-W${isoWeekNumber(date)}:${salt}`;
  const hash = crypto.createHash("sha256").update(key).digest();
  const goldenWeekday = hash.readUInt32BE(0) % 7;
  return isoWeekday0(date) === goldenWeekday;
}

/** BOLI_SPEC.md §5.3 — 1.25× from day 3 onward, flat otherwise. */
export function computeStreakMultiplier(streakDay: number): number {
  return streakDay >= STREAK_MULTIPLIER_START_DAY ? STREAK_MULTIPLIER : 1;
}

/**
 * Asia/Male has no DST and a fixed UTC+5 offset, so "today's date in
 * Asia/Male" is just UTC+5h reformatted — no Intl timezone database call
 * needed, and this stays trivially pure/synchronous for tests.
 */
export function maleDateString(date: Date): string {
  const shifted = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/** Milliseconds until the next Asia/Male midnight, for the post-play countdown (BOLI_SPEC.md §9). */
export function msUntilNextMaleMidnight(date: Date): number {
  const shifted = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  const nextMidnightShifted = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1)
  );
  return nextMidnightShifted.getTime() - shifted.getTime();
}

export { BOLI_TIMEZONE };
