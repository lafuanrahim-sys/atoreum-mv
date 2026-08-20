import { describe, it, expect, afterAll } from "vitest";
import crypto from "crypto";
import { pool } from "../db";
import { playToday, getTodaysPlay } from "../dive.server";
import {
  PITY_COUNTER_WINDOW,
  PITY_MINIMUM_TIER,
  PITY_BOOST_BALL_COUNT,
  WEEKLY_GAME_BOLI_CAP,
  DIVE_PAYOUT_TABLE,
  STREAK_CHEST_DAY,
  STREAK_CHEST_BOLI,
} from "../config";

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
  /**
   * Remove what these tests wrote.
   *
   * They played on fixed dates in 2031 chosen to be clear of real data, but
   * the daily budget is GLOBAL: every run consumed a slice of the budget for
   * 2031-09-01 and left it there. Eighty-eight runs later the day was 49,925
   * of 50,000 spent, the day-one Treasure could no longer exhaust the weekly
   * cap it was written to exhaust, and the streak-chest test began failing on
   * a residual payout -- a suite that had quietly been poisoning its own well
   * since the day it was written.
   *
   * Scoped to the test prefix, so it can never touch a real player. Runs
   * before the pool closes, and does not fail the suite if it cannot: a
   * cleanup that breaks the run it is tidying up after is worse than the mess.
   */
  afterAll(async () => {
    try {
      /**
       * The daily budget is the one that actually poisons the well.
       *
       * boli_daily_game_budget accumulates total_boli_issued per date and is
       * never decremented, so deleting the plays leaves the spend behind.
       * These tests play on fixed dates in 2031, and each run pushed that
       * day's total higher until 2031-09-01 held 49,925 of a 50,000 budget.
       * Past that point the day-one Treasure fell back to the common payout,
       * the weekly cap it exists to exhaust was never touched, and the
       * streak-chest assertion started failing on a residual.
       *
       * Scoped to 2030 and later, which no real play can reach.
       */
      await pool().query("delete from boli_daily_game_budget where play_date >= '2030-01-01'");
      // Children before parents: six tables reference boli_users, and the
      // ones these tests write are the plays, streaks and ledger.
      await pool().query("delete from boli_dive_plays where user_id like 'test-dive-%'");
      await pool().query("delete from boli_streaks where user_id like 'test-dive-%'");
      await pool().query("delete from boli_ledger where user_id like 'test-dive-%'");
      await pool().query("delete from boli_users where user_id like 'test-dive-%'");
    } catch (err) {
      console.warn("[dive test] cleanup failed:", err instanceof Error ? err.message : err);
    }
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
      // final_payout only: the streak chest is deliberately exempt from the
      // weekly cap (see boli_dive_play() in lib/boli/schema.sql), so summing
      // chest_boli in here would assert the behaviour this codebase
      // specifically moved away from.
      `select coalesce(sum(final_payout), 0) as total from boli_dive_plays
       where user_id = $1 and play_date >= $2 and play_date <= $3`,
      [
        userId,
        monday.toISOString().slice(0, 10),
        new Date(monday.getTime() + 6 * 86400000).toISOString().slice(0, 10),
      ]
    );
    expect(Number(rows[0].total)).toBeLessThanOrEqual(WEEKLY_GAME_BOLI_CAP);
  }, 30_000);

  /**
   * Regression guard. The chest used to be clamped by leftover cap room,
   * which meant the single best week a player could have -- a completed
   * 7-day streak ending in a big win -- was also the week the chest paid
   * nothing, because the win consumed the headroom first. Drives
   * boli_dive_play() directly with explicit dates so the assertion doesn't
   * depend on which weekday the suite runs on.
   */
  it("streak chest is exempt from the weekly cap: pays in full even when the cap is already spent", async () => {
    const userId = freshUserId();
    const db = pool();
    await db.query(`insert into boli_users (user_id) values ($1) on conflict do nothing`, [userId]);

    const config = {
      gridSize: 9,
      pickCount: 3,
      payoutTable: DIVE_PAYOUT_TABLE,
      tripleMultiplier: 1.5,
      globalDailyBudget: 50_000,
      fallbackCommonPayout: DIVE_PAYOUT_TABLE.common.boli,
      gameExpiryDays: 60,
      streakChestDay: STREAK_CHEST_DAY,
      streakChestBoli: STREAK_CHEST_BOLI,
      streakMultiplierStartDay: 3,
      streakMultiplier: 1.25,
      goldenMultiplier: 1.5,
      weeklyCap: WEEKLY_GAME_BOLI_CAP,
      monthlyCap: 1_800,
    };
    // A Monday well clear of any real data, so all 7 days sit in one ISO week.
    const weekStart = Date.UTC(2031, 8, 1); // 2031-09-01 is a Monday
    const dayOf = (i: number) => new Date(weekStart + i * 86_400_000).toISOString().slice(0, 10);
    // THREE treasures, because the pick is three tiles and the payout follows
    // the matched tier: two treasures and a common is not a match, so the old
    // two-treasure board quietly paid the common rate. Day one then never came
    // close to the weekly cap it exists to exhaust, and the assertion below was
    // testing nothing -- it had been asserting against a premise that was false
    // from the day it was written.
    const treasureBoard = JSON.stringify(["treasure", "treasure", "treasure", ...Array(6).fill("common")]);
    const commonBoard = JSON.stringify(Array(9).fill("common"));

    // Days 1-6 build the streak; day 1 is a Treasure, which alone exhausts
    // the entire weekly cap and would previously have starved the chest.
    for (let i = 0; i < 6; i++) {
      await db.query(`select * from boli_dive_play($1,$2,$3,$4,$5,$6,$7,$8)`, [
        userId, dayOf(i), i === 0 ? treasureBoard : commonBoard,
        JSON.stringify(FIXED_PICK), false, null, null, JSON.stringify(config),
      ]);
    }

    const { rows } = await db.query<{ final_payout: string; chest_boli: string; streak_day: number }>(
      `select * from boli_dive_play($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId, dayOf(6), commonBoard, JSON.stringify(FIXED_PICK), false, null, null, JSON.stringify(config)]
    );

    expect(rows[0].streak_day).toBe(STREAK_CHEST_DAY);
    // Cap fully spent by the day-1 Treasure, so the dive itself pays nothing...
    expect(Number(rows[0].final_payout)).toBe(0);
    // ...but finishing the streak still pays, in full.
    expect(Number(rows[0].chest_boli)).toBe(STREAK_CHEST_BOLI);

    const { rows: weekRows } = await db.query<{ dive: string; chest: string }>(
      `select coalesce(sum(final_payout),0) as dive, coalesce(sum(chest_boli),0) as chest
         from boli_dive_plays where user_id = $1 and play_date >= $2 and play_date <= $3`,
      [userId, dayOf(0), dayOf(6)]
    );
    // The cap still binds the dive side exactly; only the chest sits outside it.
    expect(Number(weekRows[0].dive)).toBe(WEEKLY_GAME_BOLI_CAP);
    expect(Number(weekRows[0].chest)).toBe(STREAK_CHEST_BOLI);
  }, 30_000);
});
