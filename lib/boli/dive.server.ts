import { pool } from "./db";
import { getEffectiveGameEnabled, getEffectiveCaps } from "./runtimeConfig.server";
import { flagDeviceHashCollisionIfNeeded } from "./fraud.server";
import { isDisposableEmailDomain } from "./disposableEmailDomains";
import { rollGrid, applyGridPity, isGoldenShellDay, maleDateString, defaultRng } from "./diveEngine";
import {
  DIVE_PAYOUT_TABLE,
  DIVE_GRID_SIZE,
  DIVE_PICK_COUNT,
  TRIPLE_MATCH_MULTIPLIER,
  GAME_BOLI_EXPIRY_DAYS,
  STREAK_CHEST_DAY,
  STREAK_CHEST_BOLI,
  STREAK_MULTIPLIER_START_DAY,
  STREAK_MULTIPLIER,
  GOLDEN_SHELL_MULTIPLIER,
  REQUIRE_PHONE_FOR_GAME,
  REQUIRE_VERIFIED_EMAIL_FOR_GAME,
  type DiveOutcomeTier,
} from "./config";

/**
 * Boli Dive orchestration — the only place that calls boli_dive_play()
 * (lib/boli/schema.sql). Deals the day's 9-ball board using the pure,
 * unit-tested engine (lib/boli/diveEngine.ts), then hands the board and
 * the player's 3 picks to the Postgres function, which re-derives the
 * match, streak/caps under lock, and performs the ledger credit
 * atomically. See schema.sql's comment on boli_dive_play() for why the
 * split is safe: nothing here is trusted for the numbers that actually
 * matter (which balls matched, streak day, cap remaining, final payout) —
 * the database recomputes those itself.
 */

export type PickMatchType = "triple" | "pair" | "none";

export type DivePlayResult = {
  id: string;
  playDate: string;
  gridTiers: DiveOutcomeTier[];
  pickedIndices: number[];
  matchType: PickMatchType;
  outcomeTier: DiveOutcomeTier;
  basePayout: number;
  streakMultiplier: number;
  goldenMultiplier: number;
  isGolden: boolean;
  finalPayout: number;
  chestBoli: number;
  totalPayout: number;
  wasClamped: boolean;
  shieldFired: boolean;
  streakDay: number;
};

type DivePlayRow = {
  id: string;
  play_date: string;
  outcome_tier: DiveOutcomeTier;
  base_payout: string;
  streak_multiplier: string;
  golden_multiplier: string;
  cap_clamped_amount: string;
  final_payout: string;
  chest_boli: string;
  shield_fired: boolean;
  streak_day: number;
  grid_tiers: DiveOutcomeTier[] | null;
  picked_indices: number[] | null;
  match_type: PickMatchType | null;
};

function mapRow(row: DivePlayRow): DivePlayResult {
  const finalPayout = Number(row.final_payout);
  const chestBoli = Number(row.chest_boli);
  return {
    id: row.id,
    playDate: row.play_date,
    gridTiers: row.grid_tiers ?? [],
    pickedIndices: row.picked_indices ?? [],
    matchType: row.match_type ?? "none",
    outcomeTier: row.outcome_tier,
    basePayout: Number(row.base_payout),
    streakMultiplier: Number(row.streak_multiplier),
    goldenMultiplier: Number(row.golden_multiplier),
    isGolden: Number(row.golden_multiplier) > 1,
    finalPayout,
    chestBoli,
    totalPayout: finalPayout + chestBoli,
    wasClamped: Number(row.cap_clamped_amount) > 0,
    shieldFired: row.shield_fired,
    streakDay: row.streak_day,
  };
}

export type DiveEligibility = { eligible: true } | { eligible: false; reason: string };

/** Checks everything short of "already played today" — the unlock gates from BOLI_SPEC.md §6.1. */
export async function checkDiveEligibility(params: { userId: string; email: string }): Promise<DiveEligibility> {
  if (!(await getEffectiveGameEnabled())) {
    return { eligible: false, reason: "Boli Dive isn't available right now — check back soon." };
  }

  if (isDisposableEmailDomain(params.email)) {
    return { eligible: false, reason: "Boli Dive isn't available for this email address." };
  }

  // Both flags default false in this codebase (no email-verification or
  // SMS-OTP flow exists to check against — see config.ts comments); wired
  // here so flipping either on later needs no change to this function.
  if (REQUIRE_VERIFIED_EMAIL_FOR_GAME) {
    return { eligible: false, reason: "Verify your email to unlock Boli Dive." };
  }
  if (REQUIRE_PHONE_FOR_GAME) {
    return { eligible: false, reason: "Verify your phone number to unlock Boli Dive." };
  }

  const { rows } = await pool().query<{ game_access_suspended: boolean }>(
    `select game_access_suspended from boli_users where user_id = $1`,
    [params.userId]
  );
  if (rows[0]?.game_access_suspended) {
    return { eligible: false, reason: "Boli Dive is paused on this account pending review — contact us if you have questions." };
  }

  return { eligible: true };
}

/** Today's play if it already happened, for resume-on-reload — the same board and the same 3 picks, never re-dealt (BOLI_SPEC.md §6.4). */
export async function getTodaysPlay(userId: string): Promise<DivePlayResult | null> {
  const playDate = maleDateString(new Date());
  const { rows } = await pool().query<DivePlayRow>(
    `select * from boli_dive_plays where user_id = $1 and play_date = $2`,
    [userId, playDate]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export type PlayTodayResult =
  | { ok: true; result: DivePlayResult }
  | { ok: false; error: string };

/** Validates a client-submitted pick: exactly DIVE_PICK_COUNT distinct integers, each a valid ball index. Never trust the client further than this — the match itself is recomputed server-side regardless (BOLI_SPEC.md §6.4). */
export function parsePickedIndices(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== DIVE_PICK_COUNT) return null;
  const nums = raw.map((v) => Number(v));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n >= DIVE_GRID_SIZE)) return null;
  if (new Set(nums).size !== nums.length) return null;
  return nums;
}

/**
 * Deals today's board (or, if already played, simply returns it) and
 * resolves the player's 3 picks. Safe to call more than once for the same
 * user/day — a retry's board is discarded, the database returns the first
 * call's actual result (BOLI_SPEC.md §6.3, §6.4).
 */
export async function playToday(params: {
  userId: string;
  email: string;
  pickedIndices: number[];
  deviceHash: string | null;
  ipHash: string | null;
  rng?: () => number;
}): Promise<PlayTodayResult> {
  const eligibility = await checkDiveEligibility({ userId: params.userId, email: params.email });
  if (!eligibility.eligible) return { ok: false, error: eligibility.reason };

  if (parsePickedIndices(params.pickedIndices) === null) {
    return { ok: false, error: `Pick exactly ${DIVE_PICK_COUNT} balls.` };
  }

  const now = new Date();
  const playDate = maleDateString(now);
  const rng = params.rng ?? defaultRng;

  const { rows: recentRows } = await pool().query<{ outcome_tier: DiveOutcomeTier }>(
    `select outcome_tier from boli_dive_plays where user_id = $1 order by play_date desc limit 10`,
    [params.userId]
  );
  const recentOutcomesNewestFirst = recentRows.map((r) => r.outcome_tier);

  const grid = applyGridPity(rollGrid(rng), recentOutcomesNewestFirst, rng);
  const isGolden = isGoldenShellDay(now);
  const caps = await getEffectiveCaps();

  const config = {
    gridSize: DIVE_GRID_SIZE,
    pickCount: DIVE_PICK_COUNT,
    payoutTable: DIVE_PAYOUT_TABLE,
    tripleMultiplier: TRIPLE_MATCH_MULTIPLIER,
    globalDailyBudget: caps.globalDailyBudget,
    fallbackCommonPayout: DIVE_PAYOUT_TABLE.common.boli,
    gameExpiryDays: GAME_BOLI_EXPIRY_DAYS,
    streakChestDay: STREAK_CHEST_DAY,
    streakChestBoli: STREAK_CHEST_BOLI,
    streakMultiplierStartDay: STREAK_MULTIPLIER_START_DAY,
    streakMultiplier: STREAK_MULTIPLIER,
    goldenMultiplier: GOLDEN_SHELL_MULTIPLIER,
    weeklyCap: caps.weeklyCap,
    monthlyCap: caps.monthlyCap,
  };

  const { rows } = await pool().query<DivePlayRow>(
    `select * from boli_dive_play($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      params.userId,
      playDate,
      JSON.stringify(grid),
      JSON.stringify(params.pickedIndices),
      isGolden,
      params.deviceHash,
      params.ipHash,
      JSON.stringify(config),
    ]
  );

  if (rows.length === 0) throw new Error("boli_dive_play returned no row");

  if (params.deviceHash) {
    // Fire-and-forget-with-logging — a fraud-flag write must never break a
    // successful play (same posture as the order-status Boli hook).
    flagDeviceHashCollisionIfNeeded(params.deviceHash).catch((err) =>
      console.error("[boli] device hash flag check failed:", err)
    );
  }

  return { ok: true, result: mapRow(rows[0]) };
}

/** Marks the one-time onboarding card dismissed (BOLI_SPEC.md §9: "Store has_seen_dive_intro"). */
export async function dismissDiveIntro(userId: string): Promise<void> {
  await pool().query(
    `insert into boli_users (user_id, has_seen_dive_intro) values ($1, true)
     on conflict (user_id) do update set has_seen_dive_intro = true, updated_at = now()`,
    [userId]
  );
}

/**
 * Testing-only: deletes today's Boli Dive play and everything it credited
 * (its game_earn/streak_chest ledger rows, its slice of the streak state,
 * its slice of the global daily budget), so the same account can roll
 * again immediately. Gated by UNLIMITED_DIVE_PLAYS_FOR_ADMINS + admin role
 * at the call site (app/actions/boliDive.ts) — this function itself does
 * no authorization, only the deletion, so it must never be reachable from
 * anywhere else. The real one-play-per-day constraint is never bypassed;
 * this works by removing the row the constraint would otherwise block on,
 * not by weakening the constraint.
 */
export async function resetTodaysPlayForTesting(userId: string): Promise<void> {
  const playDate = maleDateString(new Date());
  const db = pool();
  const client = await db.connect();
  try {
    await client.query("begin");

    const { rows } = await client.query<{ id: string; final_payout: string; chest_boli: string }>(
      `select id, final_payout, chest_boli from boli_dive_plays where user_id = $1 and play_date = $2`,
      [userId, playDate]
    );
    const play = rows[0];
    if (!play) {
      await client.query("rollback");
      return;
    }

    await client.query(`delete from boli_ledger where source_id = $1 and source_type in ('dive_play', 'streak')`, [play.id]);
    await client.query(`delete from boli_dive_plays where id = $1`, [play.id]);
    await client.query(`delete from boli_streaks where user_id = $1`, [userId]);
    await client.query(
      `update boli_users set boli_balance_cached = (select coalesce(sum(delta), 0) from boli_ledger where user_id = $1) where user_id = $1`,
      [userId]
    );
    const removed = Number(play.final_payout) + Number(play.chest_boli);
    await client.query(
      `update boli_daily_game_budget set total_boli_issued = greatest(0, total_boli_issued - $2) where play_date = $1`,
      [playDate, removed]
    );

    await client.query("commit");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function hasSeenDiveIntro(userId: string): Promise<boolean> {
  const { rows } = await pool().query<{ has_seen_dive_intro: boolean }>(
    `select has_seen_dive_intro from boli_users where user_id = $1`,
    [userId]
  );
  return Boolean(rows[0]?.has_seen_dive_intro);
}

export type StreakSnapshot = {
  currentStreak: number;
  longestStreak: number;
  lastPlayDate: string | null;
  totalPlays: number;
};

export async function getStreak(userId: string): Promise<StreakSnapshot> {
  const { rows } = await pool().query<{
    current_streak: number;
    longest_streak: number;
    last_play_date: string | null;
    total_plays: number;
  }>(`select current_streak, longest_streak, last_play_date, total_plays from boli_streaks where user_id = $1`, [userId]);
  const row = rows[0];
  return {
    currentStreak: row?.current_streak ?? 0,
    longestStreak: row?.longest_streak ?? 0,
    lastPlayDate: row?.last_play_date ?? null,
    totalPlays: row?.total_plays ?? 0,
  };
}
