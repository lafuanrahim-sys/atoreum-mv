import { describe, it, expect } from "vitest";
import { getTier, parseBoliAmount, estimatePurchaseEarn, redeemForOrder } from "../ledger.server";
import { MIN_REDEMPTION_BOLI, PURCHASE_EARN_BOLI, PURCHASE_EARN_PER_MVR, TIER_MULTIPLIER } from "../config";

// Pure logic only — nothing here touches Supabase. The three early-return
// validation paths in redeemForOrder() are tested directly below because
// they `return` before ever calling supabaseAdmin(); anything that
// actually reaches the RPC lives in ledger.integration.test.ts instead,
// which needs a live Postgres project.

describe("parseBoliAmount", () => {
  it("accepts a positive integer string", () => {
    expect(parseBoliAmount("1500")).toBe(BigInt(1500));
  });

  it("accepts a positive integer number", () => {
    expect(parseBoliAmount(1500)).toBe(BigInt(1500));
  });

  it("rejects zero", () => {
    expect(parseBoliAmount("0")).toBeNull();
  });

  it("rejects negative numbers", () => {
    expect(parseBoliAmount("-50")).toBeNull();
    expect(parseBoliAmount(-50)).toBeNull();
  });

  it("rejects fractional amounts", () => {
    expect(parseBoliAmount("50.5")).toBeNull();
    expect(parseBoliAmount(50.5)).toBeNull();
  });

  it("rejects non-numeric strings", () => {
    expect(parseBoliAmount("abc")).toBeNull();
    expect(parseBoliAmount("100abc")).toBeNull();
    expect(parseBoliAmount("1e10")).toBeNull(); // scientific notation must not sneak through
    expect(parseBoliAmount(" 100 ")).not.toBeNull(); // whitespace is trimmed...
    expect(parseBoliAmount("1 00")).toBeNull(); // ...but not internal whitespace
  });

  it("rejects other types entirely", () => {
    expect(parseBoliAmount(null)).toBeNull();
    expect(parseBoliAmount(undefined)).toBeNull();
    expect(parseBoliAmount({})).toBeNull();
    expect(parseBoliAmount([])).toBeNull();
    expect(parseBoliAmount(true)).toBeNull();
  });

  it("rejects amounts beyond Number.MAX_SAFE_INTEGER (overflow guard)", () => {
    expect(parseBoliAmount(String(Number.MAX_SAFE_INTEGER))).not.toBeNull();
    expect(parseBoliAmount(String(Number.MAX_SAFE_INTEGER) + "0")).toBeNull();
  });
});

describe("getTier", () => {
  it("returns faru at zero lifetime earned", () => {
    expect(getTier(BigInt(0))).toBe("faru");
  });

  it("returns the highest tier whose threshold is cleared", () => {
    expect(getTier(BigInt(4_999))).toBe("faru");
    expect(getTier(BigInt(5_000))).toBe("vilu");
    expect(getTier(BigInt(19_999))).toBe("vilu");
    expect(getTier(BigInt(20_000))).toBe("kandu");
    expect(getTier(BigInt(49_999))).toBe("kandu");
    expect(getTier(BigInt(50_000))).toBe("thari");
    expect(getTier(BigInt(1_000_000))).toBe("thari");
  });
});

describe("estimatePurchaseEarn", () => {
  it("matches the documented formula at faru (1.0x)", () => {
    // MVR 100 subtotal, no discount, faru tier => floor(100/10)*20 * 1.0 = 200
    expect(estimatePurchaseEarn(100, 0, "faru")).toBe(200);
  });

  it("rounds down on partial MVR-per-increment amounts", () => {
    // MVR 25 => floor(25/10) = 2 increments => 2*20 = 40, not 50
    expect(estimatePurchaseEarn(25, 0, "faru")).toBe(40);
  });

  it("excludes the Boli-discounted portion of the order", () => {
    // MVR 100 subtotal, MVR 30 already covered by a Boli discount => only 70 MVR earns
    expect(estimatePurchaseEarn(100, 30, "faru")).toBe(estimatePurchaseEarn(70, 0, "faru"));
  });

  it("applies the tier multiplier, then floors again", () => {
    const base = Math.floor(Math.floor(55 / PURCHASE_EARN_PER_MVR) * PURCHASE_EARN_BOLI * TIER_MULTIPLIER.vilu);
    expect(estimatePurchaseEarn(55, 0, "vilu")).toBe(base);
  });

  it("never earns on a subtotal below one earn increment", () => {
    expect(estimatePurchaseEarn(PURCHASE_EARN_PER_MVR - 1, 0, "faru")).toBe(0);
  });

  it("never goes negative when the discount exceeds the subtotal", () => {
    expect(estimatePurchaseEarn(50, 999, "faru")).toBe(0);
  });
});

describe("redeemForOrder — validation that never reaches the network", () => {
  it("rejects a non-positive amount before calling Supabase", async () => {
    const result = await redeemForOrder({ userId: "u1", orderId: "o1", boliAmount: BigInt(0), orderSubtotalMvr: 1000 });
    expect(result.ok).toBe(false);
  });

  it("rejects below the minimum redemption", async () => {
    const result = await redeemForOrder({
      userId: "u1",
      orderId: "o1",
      boliAmount: BigInt(MIN_REDEMPTION_BOLI - 1),
      orderSubtotalMvr: 100_000, // subtotal large enough that the 30% cap isn't the reason for rejection
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain("minimum");
  });

  it("rejects above the 30% of subtotal cap", async () => {
    // MVR 100 subtotal => cap is 30 MVR => 3,000 Boli max. Ask for way more.
    const result = await redeemForOrder({
      userId: "u1",
      orderId: "o1",
      boliAmount: BigInt(50_000),
      orderSubtotalMvr: 100,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/%/);
  });
});
