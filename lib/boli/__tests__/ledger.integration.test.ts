import { describe, it, expect, afterAll } from "vitest";
import crypto from "crypto";
import { pool } from "../db";
import { creditPurchaseEarn, redeemForOrder, reverseOrder, getBalance, expireUser, adminAdjustment } from "../ledger.server";
import { MIN_REDEMPTION_BOLI } from "../config";

/**
 * These are REAL integration tests against a live Postgres database with
 * lib/boli/schema.sql applied — the guarantees they prove (one payout per
 * idempotency key under concurrency, exactly one winner on a concurrent
 * double-spend, FIFO expiry ordering) live in the database's row locks and
 * unique constraints, not in application code, so mocking the db client
 * here would only prove "this function issues a query" and say nothing
 * about whether the query is actually safe under concurrency. Skipped
 * entirely (not failed) when DATABASE_URL isn't set — see docs/BOLI_SPEC.md
 * for how to provision one and run `lib/boli/schema.sql` before these can
 * execute.
 *
 * Each test uses a fresh random "test-{uuid}" user id so runs never
 * collide with each other or with real data — but they do leave rows
 * behind in whatever database DATABASE_URL points at; there's no automatic
 * cleanup here.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("Boli ledger integration (live Postgres required)", () => {
  afterAll(async () => {
    await pool().end();
  });

  function freshUserId() {
    return `test-${crypto.randomUUID()}`;
  }
  function freshOrderId() {
    return `test-order-${crypto.randomUUID()}`;
  }

  it("concurrent double-credit: the same purchase-earn fired N times in parallel produces exactly one payout", async () => {
    const userId = freshUserId();
    const orderId = freshOrderId();

    const results = await Promise.all(
      Array.from({ length: 10 }, () => creditPurchaseEarn({ userId, orderId, orderSubtotalMvr: 100, boliDiscountMvr: 0 }))
    );

    const ids = new Set(results.filter(Boolean).map((r) => r!.id));
    expect(ids.size).toBe(1); // every concurrent caller got back the SAME ledger row

    const snapshot = await getBalance(userId);
    expect(snapshot.trueBalance).toBe(BigInt(200)); // floor(100/10)*20 boli, credited exactly once, not 10 times
  }, 30_000);

  it("concurrent double-spend: two concurrent full-balance redemptions produce exactly one success", async () => {
    const userId = freshUserId();
    await creditPurchaseEarn({ userId, orderId: freshOrderId(), orderSubtotalMvr: 100_000, boliDiscountMvr: 0 });

    const balance = (await getBalance(userId)).trueBalance;
    expect(balance).toBeGreaterThan(BigInt(0));

    const [resultA, resultB] = await Promise.all([
      redeemForOrder({ userId, orderId: freshOrderId(), boliAmount: balance, orderSubtotalMvr: 100_000 }),
      redeemForOrder({ userId, orderId: freshOrderId(), boliAmount: balance, orderSubtotalMvr: 100_000 }),
    ]);

    const successes = [resultA, resultB].filter((r) => r.ok).length;
    expect(successes).toBe(1); // the second racer must see the first's debit and be rejected for insufficient balance

    expect((await getBalance(userId)).trueBalance).toBe(BigInt(0));
  }, 30_000);

  it("redemption is blocked on an account with zero delivered orders, regardless of balance", async () => {
    const userId = freshUserId();
    // Boli via admin adjustment only — has_delivered_order is only ever set true by a purchase_earn credit, which this account never received.
    await adminAdjustment({ userId, delta: BigInt(MIN_REDEMPTION_BOLI * 5), adminId: "test-admin", reason: "integration test seed" });

    const result = await redeemForOrder({
      userId,
      orderId: freshOrderId(),
      boliAmount: BigInt(MIN_REDEMPTION_BOLI),
      orderSubtotalMvr: 100_000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain("eligible");
  }, 30_000);

  it("refund clawback can drive the true balance negative, and redemption is blocked while it is under review", async () => {
    const userId = freshUserId();
    const earnOrderId = freshOrderId();
    await creditPurchaseEarn({ userId, orderId: earnOrderId, orderSubtotalMvr: 1000, boliDiscountMvr: 0 }); // earns 2,000 Boli

    const earned = (await getBalance(userId)).trueBalance;
    expect(earned).toBeGreaterThan(BigInt(0));

    // spend it all on a separate order
    const spendResult = await redeemForOrder({ userId, orderId: freshOrderId(), boliAmount: earned, orderSubtotalMvr: 100_000 });
    expect(spendResult.ok).toBe(true);
    expect((await getBalance(userId)).trueBalance).toBe(BigInt(0));

    // the EARNING order is now refunded/cancelled — clawback removes what it earned, which is no longer there to remove, so the balance goes negative
    const { clawback } = await reverseOrder({ userId, orderId: earnOrderId });
    expect(clawback).not.toBeNull();

    const afterClawback = await getBalance(userId);
    expect(afterClawback.trueBalance).toBeLessThan(BigInt(0));
    expect(afterClawback.displayBalance).toBe(BigInt(0)); // never shown negative to the user

    const blocked = await redeemForOrder({
      userId,
      orderId: freshOrderId(),
      boliAmount: BigInt(MIN_REDEMPTION_BOLI),
      orderSubtotalMvr: 100_000,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.toLowerCase()).toContain("review");
  }, 30_000);

  it("FIFO expiry: the soonest-expiring lot is consumed by spend first, and only its true remainder is ever swept", async () => {
    const userId = freshUserId();
    const db = pool();
    const lotAmount = MIN_REDEMPTION_BOLI * 2;
    const spendAmount = MIN_REDEMPTION_BOLI + Math.floor(MIN_REDEMPTION_BOLI / 5); // more than one minimum, less than one lot

    const soonExpiry = new Date(Date.now() + 1000).toISOString();
    const laterExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

    const { rows: lot1Rows } = await db.query(`select * from boli_ledger_write($1,$2,$3,$4,$5,$6,$7)`, [
      userId,
      String(lotAmount),
      "purchase_earn",
      "order",
      "lot1",
      `test-lot1-${userId}`,
      soonExpiry,
    ]);
    const lot1 = lot1Rows[0];

    const { rows: lot2Rows } = await db.query(`select * from boli_ledger_write($1,$2,$3,$4,$5,$6,$7)`, [
      userId,
      String(lotAmount),
      "purchase_earn",
      "order",
      "lot2",
      `test-lot2-${userId}`,
      laterExpiry,
    ]);
    const lot2 = lot2Rows[0];

    const spend = await redeemForOrder({
      userId,
      orderId: freshOrderId(),
      boliAmount: BigInt(spendAmount),
      orderSubtotalMvr: 100_000,
    });
    expect(spend.ok).toBe(true);

    const { rows: lots } = await db.query<{ ledger_id: string; remaining: string }>(
      `select * from boli_spendable_lots($1)`,
      [userId]
    );
    const byId = new Map(lots.map((l) => [l.ledger_id, Number(l.remaining)]));
    expect(byId.get(lot1.id)).toBe(lotAmount - spendAmount); // lot1 (soonest-expiring) absorbed the spend first
    expect(byId.get(lot2.id)).toBe(lotAmount); // lot2 untouched

    await new Promise((resolve) => setTimeout(resolve, 1200)); // let lot1's expiry actually pass
    const expiredCount = await expireUser(userId);
    expect(expiredCount).toBe(1); // only lot1 has passed its expiry

    const balanceAfterExpiry = await getBalance(userId);
    expect(balanceAfterExpiry.trueBalance).toBe(BigInt(lotAmount)); // lot1's leftover swept away; lot2 remains whole
  }, 30_000);
});
