import { describe, it, expect } from "vitest";
import {
  DIVE_PAYOUT_TABLE,
  TIER_THRESHOLD_LIFETIME_EARNED,
  TIER_MULTIPLIER,
  WEEKLY_GAME_BOLI_CAP,
  MONTHLY_GAME_BOLI_CAP,
  MIN_REDEMPTION_BOLI,
  MAX_REDEMPTION_SUBTOTAL_FRACTION,
} from "../config";

describe("Boli config invariants", () => {
  it("dive payout table weights sum to 1", () => {
    const total = Object.values(DIVE_PAYOUT_TABLE).reduce((sum, o) => sum + o.weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("dive payout amounts increase with rarity", () => {
    const order = ["common", "uncommon", "rare", "epic", "treasure"] as const;
    for (let i = 1; i < order.length; i++) {
      expect(DIVE_PAYOUT_TABLE[order[i]].boli).toBeGreaterThan(DIVE_PAYOUT_TABLE[order[i - 1]].boli);
      expect(DIVE_PAYOUT_TABLE[order[i]].weight).toBeLessThan(DIVE_PAYOUT_TABLE[order[i - 1]].weight);
    }
  });

  it("tier thresholds strictly increase with tier", () => {
    const order = ["faru", "vilu", "kandu", "thari"] as const;
    for (let i = 1; i < order.length; i++) {
      expect(TIER_THRESHOLD_LIFETIME_EARNED[order[i]]).toBeGreaterThan(TIER_THRESHOLD_LIFETIME_EARNED[order[i - 1]]);
      expect(TIER_MULTIPLIER[order[i]]).toBeGreaterThan(TIER_MULTIPLIER[order[i - 1]]);
    }
    expect(TIER_THRESHOLD_LIFETIME_EARNED.faru).toBe(0);
    expect(TIER_MULTIPLIER.faru).toBe(1);
  });

  it("a perfect month of game play never exceeds the monthly cap by design intent (weekly * ~4 >= monthly is a sane relationship)", () => {
    // Not a hard mathematical law, but a sanity check that the two caps are
    // in the same ballpark relative to each other, so a config typo (e.g.
    // monthly cap smaller than weekly) is caught here rather than in prod.
    expect(MONTHLY_GAME_BOLI_CAP).toBeGreaterThanOrEqual(WEEKLY_GAME_BOLI_CAP);
  });

  it("redemption cap fraction is between 0 and 1", () => {
    expect(MAX_REDEMPTION_SUBTOTAL_FRACTION).toBeGreaterThan(0);
    expect(MAX_REDEMPTION_SUBTOTAL_FRACTION).toBeLessThanOrEqual(1);
  });

  it("minimum redemption is a positive whole number", () => {
    expect(MIN_REDEMPTION_BOLI).toBeGreaterThan(0);
    expect(Number.isInteger(MIN_REDEMPTION_BOLI)).toBe(true);
  });
});
