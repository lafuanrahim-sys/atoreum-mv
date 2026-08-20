import { describe, it, expect } from "vitest";
import { orderAccessToken, verifyOrderAccessToken } from "@/lib/orderAccessToken";

/**
 * The credential that guards a customer's order.
 *
 * Order ids are `ord-{timestamp}-{3 random bytes}` and were never designed to
 * be secret -- the schema says so outright. Everything that exposes order
 * contents therefore has to check this token, not the id, and these tests
 * exist because that distinction is easy to lose in a refactor and expensive
 * to lose in production.
 */
describe("order access tokens", () => {
  process.env.ADMIN_SESSION_SECRET ??= "test-secret-for-token-tests";

  it("accepts the token minted for that order", () => {
    expect(verifyOrderAccessToken("ord-abc-123", orderAccessToken("ord-abc-123"))).toBe(true);
  });

  it("refuses another order's token", () => {
    // The obvious attack: hold one real order, walk the ids, reuse the token.
    expect(verifyOrderAccessToken("ord-abc-123", orderAccessToken("ord-abc-124"))).toBe(false);
  });

  it("refuses a missing or empty token", () => {
    expect(verifyOrderAccessToken("ord-abc-123", null)).toBe(false);
    expect(verifyOrderAccessToken("ord-abc-123", undefined)).toBe(false);
    expect(verifyOrderAccessToken("ord-abc-123", "")).toBe(false);
  });

  it("refuses a truncated token", () => {
    const full = orderAccessToken("ord-abc-123");
    expect(verifyOrderAccessToken("ord-abc-123", full.slice(0, -1))).toBe(false);
  });

  it("is deterministic, so a customer's bookmarked link keeps working", () => {
    expect(orderAccessToken("ord-abc-123")).toBe(orderAccessToken("ord-abc-123"));
  });

  it("does not leak the secret's length through the token", () => {
    expect(orderAccessToken("ord-abc-123")).toHaveLength(32);
  });
});
