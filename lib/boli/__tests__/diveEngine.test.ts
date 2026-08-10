import { describe, it, expect } from "vitest";
import {
  rollOutcome,
  rollGrid,
  applyGridPity,
  evaluatePick,
  isGoldenShellDay,
  computeStreakMultiplier,
  maleDateString,
  msUntilNextMaleMidnight,
  seededRng,
  isoWeekNumber,
} from "../diveEngine";
import {
  DIVE_PAYOUT_TABLE,
  DIVE_GRID_SIZE,
  LONE_TREASURE_CONSOLATION_BOLI,
  PITY_COUNTER_WINDOW,
  PITY_MINIMUM_TIER,
  PITY_BOOST_BALL_COUNT,
  STREAK_MULTIPLIER,
  STREAK_MULTIPLIER_START_DAY,
} from "../config";

const SAMPLE_SIZE = 100_000;
const TOLERANCE = 0.01; // absolute, e.g. 0.62 +/- 0.01

describe("rollOutcome distribution", () => {
  it("matches the configured payout table weights within tolerance over 100k seeded rolls", () => {
    const rng = seededRng(42);
    const counts: Record<string, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, treasure: 0 };
    for (let i = 0; i < SAMPLE_SIZE; i++) counts[rollOutcome(rng)]++;

    for (const tier of Object.keys(DIVE_PAYOUT_TABLE) as (keyof typeof DIVE_PAYOUT_TABLE)[]) {
      const observed = counts[tier] / SAMPLE_SIZE;
      expect(observed).toBeGreaterThan(DIVE_PAYOUT_TABLE[tier].weight - TOLERANCE);
      expect(observed).toBeLessThan(DIVE_PAYOUT_TABLE[tier].weight + TOLERANCE);
    }
  });

  it("is deterministic for a given seed", () => {
    const a = Array.from({ length: 50 }, () => rollOutcome(seededRng(7)));
    const b = Array.from({ length: 50 }, () => rollOutcome(seededRng(7)));
    // re-seeding resets the sequence, so both arrays must match exactly
    expect(a).toEqual(b);
  });
});

describe("rollGrid", () => {
  it("deals exactly DIVE_GRID_SIZE balls, each a valid tier", () => {
    const grid = rollGrid(seededRng(3));
    expect(grid).toHaveLength(DIVE_GRID_SIZE);
    for (const tier of grid) expect(Object.keys(DIVE_PAYOUT_TABLE)).toContain(tier);
  });

  it("each ball's distribution across many boards matches the same weights as a single roll", () => {
    const counts: Record<string, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, treasure: 0 };
    const rng = seededRng(11);
    const boards = Math.ceil(SAMPLE_SIZE / DIVE_GRID_SIZE);
    for (let i = 0; i < boards; i++) {
      for (const tier of rollGrid(rng)) counts[tier]++;
    }
    const total = boards * DIVE_GRID_SIZE;
    for (const tier of Object.keys(DIVE_PAYOUT_TABLE) as (keyof typeof DIVE_PAYOUT_TABLE)[]) {
      const observed = counts[tier] / total;
      expect(observed).toBeGreaterThan(DIVE_PAYOUT_TABLE[tier].weight - TOLERANCE);
      expect(observed).toBeLessThan(DIVE_PAYOUT_TABLE[tier].weight + TOLERANCE);
    }
  });
});

describe("applyGridPity", () => {
  const allCommonWindow = Array(PITY_COUNTER_WINDOW).fill("common");

  it("leaves the board untouched when the last window isn't all Common", () => {
    const window = [...allCommonWindow];
    window[3] = "rare";
    const board = Array(DIVE_GRID_SIZE).fill("common");
    expect(applyGridPity(board, window, seededRng(1))).toEqual(board);
  });

  it("leaves the board untouched when fewer than a full window of plays exist yet", () => {
    const window = allCommonWindow.slice(0, PITY_COUNTER_WINDOW - 1);
    const board = Array(DIVE_GRID_SIZE).fill("common");
    expect(applyGridPity(board, window, seededRng(1))).toEqual(board);
  });

  it("bumps exactly PITY_BOOST_BALL_COUNT balls up to at least the pity minimum when the window is all Common", () => {
    const board = Array(DIVE_GRID_SIZE).fill("common");
    const boosted = applyGridPity(board, allCommonWindow, seededRng(5));
    const tierRank: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, treasure: 4 };
    const minRank = tierRank[PITY_MINIMUM_TIER];
    const boostedCount = boosted.filter((t) => tierRank[t] >= minRank).length;
    expect(boostedCount).toBe(PITY_BOOST_BALL_COUNT);
  });

  it("never downgrades a ball that already rolled above the pity floor", () => {
    const board = Array(DIVE_GRID_SIZE).fill("common");
    board[0] = "treasure";
    const boosted = applyGridPity(board, allCommonWindow, seededRng(2));
    expect(boosted).toContain("treasure");
  });
});

describe("evaluatePick", () => {
  const grid = ["common", "common", "common", "uncommon", "rare", "rare", "epic", "treasure", "common"] as const;

  it("detects a triple when all 3 picks share a tier", () => {
    const result = evaluatePick([...grid], [0, 1, 2]); // three commons
    expect(result.matchType).toBe("triple");
    expect(result.tier).toBe("common");
    expect(result.basePayout).toBe(DIVE_PAYOUT_TABLE.common.boli);
  });

  it("detects a pair when exactly 2 of 3 picks share a tier", () => {
    const result = evaluatePick([...grid], [4, 5, 3]); // rare, rare, uncommon
    expect(result.matchType).toBe("pair");
    expect(result.tier).toBe("rare");
  });

  it("pays the lowest of the 3 tiers when none match", () => {
    // Deliberately treasure-free: a treasure in the picks takes the
    // consolation path below instead, so testing the "lowest of three" rule
    // through a set containing one would only ever assert the exception.
    const result = evaluatePick([...grid], [3, 4, 6]); // uncommon, rare, epic
    expect(result.matchType).toBe("none");
    expect(result.tier).toBe("uncommon"); // lowest-ranked of the three
    expect(result.basePayout).toBe(DIVE_PAYOUT_TABLE.uncommon.boli);
  });

  it("pays the consolation for a lone unmatched treasure, not the lowest tier", () => {
    const result = evaluatePick([...grid], [3, 6, 7]); // uncommon, epic, treasure
    // Still "none" -- nothing matched, and reporting it as a match would
    // misstate the outcome to the ledger and to the player.
    expect(result.matchType).toBe("none");
    expect(result.tier).toBe("treasure");
    expect(result.basePayout).toBe(LONE_TREASURE_CONSOLATION_BOLI);
    expect(result.basePayout).toBeGreaterThan(DIVE_PAYOUT_TABLE.uncommon.boli);
  });

  it("never lets a lone treasure out-pay a real match of the same tier", () => {
    const lone = evaluatePick([...grid], [3, 6, 7]); // treasure, unmatched
    const pairGrid = ["treasure", "treasure", "common"] as const;
    const pair = evaluatePick([...pairGrid], [0, 1, 2]);
    expect(pair.matchType).toBe("pair");
    expect(lone.basePayout).toBeLessThan(pair.basePayout);
  });

  it("never returns a zero payout, even on a no-match", () => {
    const result = evaluatePick([...grid], [3, 6, 7]);
    expect(result.basePayout).toBeGreaterThan(0);
  });
});

describe("isGoldenShellDay", () => {
  it("is identical for every call on the same date (deterministic)", () => {
    const date = new Date("2026-03-10T12:00:00Z");
    expect(isGoldenShellDay(date)).toBe(isGoldenShellDay(date));
  });

  it("fires on exactly one weekday across a full ISO week", () => {
    const weekStart = new Date("2026-03-09T00:00:00Z"); // Monday
    let goldenDays = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart.getTime() + i * 86400000);
      if (isGoldenShellDay(d)) goldenDays++;
    }
    expect(goldenDays).toBe(1);
  });

  it("changing the salt reshuffles which weekday is golden (rotation escape hatch)", () => {
    const date = new Date("2026-03-10T12:00:00Z");
    const withDefaultSalt = isGoldenShellDay(date);
    const withDifferentSalt = isGoldenShellDay(date, "a-different-salt-value");
    // Not guaranteed to differ for every date, but over many weeks the two
    // salts must disagree on which weekday is golden at least once.
    let anyDifference = false;
    for (let w = 0; w < 20; w++) {
      const d = new Date(date.getTime() + w * 7 * 86400000);
      if (isGoldenShellDay(d) !== isGoldenShellDay(d, "a-different-salt-value")) anyDifference = true;
    }
    expect(anyDifference).toBe(true);
    void withDefaultSalt;
  });
});

describe("computeStreakMultiplier", () => {
  it("is 1x before the configured start day", () => {
    for (let day = 1; day < STREAK_MULTIPLIER_START_DAY; day++) {
      expect(computeStreakMultiplier(day)).toBe(1);
    }
  });
  it("applies the configured multiplier from the start day onward", () => {
    expect(computeStreakMultiplier(STREAK_MULTIPLIER_START_DAY)).toBe(STREAK_MULTIPLIER);
    expect(computeStreakMultiplier(STREAK_MULTIPLIER_START_DAY + 4)).toBe(STREAK_MULTIPLIER);
  });
});

describe("maleDateString", () => {
  it("rolls over to the next day 5 hours before UTC midnight (Asia/Male is UTC+5)", () => {
    expect(maleDateString(new Date("2026-03-10T18:59:00Z"))).toBe("2026-03-10");
    expect(maleDateString(new Date("2026-03-10T19:00:00Z"))).toBe("2026-03-11");
  });
});

describe("msUntilNextMaleMidnight", () => {
  it("is positive and never more than 24h", () => {
    const ms = msUntilNextMaleMidnight(new Date("2026-03-10T19:00:00Z")); // just after Male midnight
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });
  it("is near zero just before the next Male midnight", () => {
    const ms = msUntilNextMaleMidnight(new Date("2026-03-11T18:59:59Z"));
    expect(ms).toBeLessThan(2000);
  });
});

describe("isoWeekNumber", () => {
  it("is stable across all days within the same ISO week", () => {
    const mon = new Date("2026-03-09T00:00:00Z");
    const sun = new Date("2026-03-15T23:00:00Z");
    expect(isoWeekNumber(mon)).toBe(isoWeekNumber(sun));
  });
  it("increments into the next week on the following Monday", () => {
    const week1Mon = new Date("2026-03-09T00:00:00Z");
    const week2Mon = new Date("2026-03-16T00:00:00Z");
    expect(isoWeekNumber(week2Mon)).toBe(isoWeekNumber(week1Mon) + 1);
  });
});
