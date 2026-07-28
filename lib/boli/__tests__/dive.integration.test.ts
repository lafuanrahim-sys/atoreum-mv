import { describe, it, expect, afterAll } from "vitest";
import crypto from "crypto";
import { pool } from "../db";
import { playToday, getTodaysPlay } from "../dive.server";
import { PITY_COUNTER_WINDOW, PITY_MINIMUM_TIER, PITY_BOOST_BALL_COUNT, WEEKLY_GAME_BOLI_CAP, DIVE_PAYOUT_TABLE } from "../config";

/**
 * Real integration tests against a live Postgres database with
 * lib/boli/schema.sql applied — same rationale as ledger.integration.test.ts:
 * the guarantee under test (exactly one payout per user per day under
 * concurrency) lives in boli_dive_play()'s row lock and unique constraint,
 * not in application code. Skipped (not failed) without DATABASE_URL.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const TIER_ORDER = ["common", "uncommon", "rare", "epic", "treasure"] as const;
const FIXED_PICK = [0, 1, 2]; // any valid 3-of-9 pick — the specific balls don't matter for these tests

describe.skipIf(!hasDatabase)("Boli Dive integration (live Postgres required)", () => {
  afterAll(async () => {
    await pool().end();
  });

  function freshUserId() {
    return `test-dive-${crypto.randomUUID()}`;
  }
  function freshEmail(userId: string) {
    return `${userId}@example.com`;
  }

  it("concurrent plays: N simultaneous requests for the same user/day produce exactly one payout", async () => {
    const userId = freshUserId();
    const email = freshEmail(userId);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => playToday({ userId, email, pickedIndices: FIXED_PICK, deviceHash: null, ipHash: null }))
    );

    expect(results.every((r) => r.ok)).toBe(true);
    const ids = new Set(results.map((r) => (r.ok ? r.result.id : null)));
    expect(ids.size).toBe(1); // every concurrent caller got back the SAME dive_plays row

    const { rows } = await pool().query(`select count(*) as c from boli_dive_plays where user_id = $1`, [userId]);
    expect(Number(rows[0].c)).toBe(1);

    const { rows: ledgerRows } = await pool().query(
      `select count(*) as c from boli_ledger where user_id = $1 and reason = 'game_earn'`,
      [userId]
    );
    expect(Number(ledgerRows[0].c)).toBe(1); // credited exactly once, not 10 times

    const resumed = await getTodaysPlay(userId);
    expect(resumed?.id).toBe([...ids][0]);
  }, 30_000);

  it("rejects a pick that isn't exactly 3 distinct valid ball indices", async () => {
    const userId = freshUserId();
    const bad = await playToday({ userId, email: freshEmail(userId), pickedIndices: [0, 0, 1], deviceHash: null, ipHash: null });
    expect(bad.ok).toBe(false);

    const bad2 = await playToday({ userId, email: freshEmail(userId), pickedIndices: [0, 1, 9], deviceHash: null, ipHash: null });
    expect(bad2.ok).toBe(false);

    const { rows } = await pool().query(`select count(*) as c from boli_dive_plays where user_id = $1`, [userId]);
    expect(Number(rows[0].c)).toBe(0); // neither invalid attempt was persisted
  }, 30_000);

  it("pity: 10 straight Common plays boost PITY_BOOST_BALL_COUNT balls on the next board to at least the pity-minimum tier", async () => {
    const userId = freshUserId();
    const db = pool();

    await db.query(`insert into boli_users (user_id) values ($1) on conflict do nothing`, [userId]);

    // Fabricate PITY_COUNTER_WINDOW historical Common plays, oldest first,
    // each on its own (past) play_date so they don't collide with today.
    for (let i = PITY_COUNTER_WINDOW; i >= 1; i--) {
      const playDate = new Date();
      playDate.setUTCDate(playDate.getUTCDate() - i - 30); // well outside this week/month, avoids cap interaction
      await db.query(
        `insert into boli_dive_plays (user_id, play_date, outcome_tier, base_payout, final_payout, decoy_outcomes, streak_day)
         values ($1, $2, 'common', $3, $3, $4, 1)`,
        [userId, playDate.toISOString().slice(0, 10), DIVE_PAYOUT_TABLE.common.boli, JSON.stringify([])]
      );
    }

    const result = await playToday({ userId, email: freshEmail(userId), pickedIndices: FIXED_PICK, deviceHash: null, ipHash: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Pity boosts the BOARD, not a guaranteed outcome for any one fixed
    // pick (BOLI-ASSUMPTION: opportunity, not a scripted result) — assert
    // the boost actually landed on the persisted grid.
    const pityIndex = TIER_ORDER.indexOf(PITY_MINIMUM_TIER);
    const boostedCount = result.result.gridTiers.filter((t) => TIER_ORDER.indexOf(t) >= pityIndex).length;
    expect(boostedCount).toBeGreaterThanOrEqual(PITY_BOOST_BALL_COUNT);
  }, 30_000);

  it("weekly cap: a user already at the weekly ceiling gets clamped to zero (or whatever room remains)", async () => {
    const userId = freshUserId();
    const db = pool();

    await db.query(`insert into boli_users (user_id) values ($1) on conflict do nothing`, [userId]);

    // Monday of the current ISO week, in the past relative to "today" but
    // still inside the same week boli_dive_play() computes — fabricate one
    // play that alone already consumes the entire weekly cap.
    const today = new Date();
    const isoDay = today.getUTCDay() || 7;
    const monday = new Date(today);
    monday.setUTCDate(today.getUTCDate() - (isoDay - 1));
    // Use Monday itself only if it isn't today (avoids the unique constraint on user_id+play_date colliding with this test's own play).
    const historicalDate = monday.toISOString().slice(0, 10) === today.toISOString().slice(0, 10)
      ? new Date(monday.getTime() - 86400000 * 1) // fall back a day into last week if Monday == today
      : monday;

    await db.query(
      `insert into boli_dive_plays (user_id, play_date, outcome_tier, base_payout, final_payout, decoy_outcomes, streak_day)
       values ($1, $2, 'treasure', $3, $3, $4, 1)`,
      [userId, historicalDate.toISOString().slice(0, 10), WEEKLY_GAME_BOLI_CAP, JSON.stringify([])]
    );

    const result = await playToday({ userId, email: freshEmail(userId), pickedIndices: FIXED_PICK, deviceHash: null, ipHash: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Whether the fabricated row landed in the SAME week as today's play
    // depends on which day of the week "today" is when this test runs —
    // either way, this play's payout must never push the week's total past
    // the configured cap.
    const { rows } = await db.query<{ total: string }>(
      `select coalesce(sum(final_payout + chest_boli), 0) as total from boli_dive_plays
       where user_id = $1 and play_date >= $2 and play_date <= $3`,
      [
        userId,
        monday.toISOString().slice(0, 10),
        new Date(monday.getTime() + 6 * 86400000).toISOString().slice(0, 10),
      ]
    );
    expect(Number(rows[0].total)).toBeLessThanOrEqual(WEEKLY_GAME_BOLI_CAP);
  }, 30_000);
});
