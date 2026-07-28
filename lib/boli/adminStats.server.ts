import { pool } from "./db";
import { getUserById } from "@/lib/data/users.server";
import { getEffectiveCaps } from "./runtimeConfig.server";
import {
  ALERT_GLOBAL_BUDGET_PCT,
  ALERT_WEEKLY_CAP_PCT,
  ALERT_REDEMPTION_SPIKE_MULTIPLIER,
  ALERT_DEVICE_COLLISION_COUNT,
  BOLI_TO_MVR,
} from "./config";
import { maleDateString } from "./diveEngine";

/**
 * Aggregation queries for the admin Boli dashboard (BOLI_SPEC.md §8).
 * Everything here is a read — mutations (resolving a fraud flag, adjusting
 * a balance) live in lib/boli/fraud.server.ts / ledger.server.ts and
 * app/actions/boliAdmin.ts.
 */

function maleMidnightUtcIso(maleDate: string): string {
  // Asia/Male is a fixed UTC+5 offset (no DST) — the same assumption
  // diveEngine.ts's maleDateString() relies on.
  return `${maleDate}T00:00:00+05:00`;
}

function weekStartMaleDate(now: Date): string {
  const todayStr = maleDateString(now);
  const d = new Date(`${todayStr}T00:00:00Z`);
  const isoDay = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (isoDay - 1));
  return d.toISOString().slice(0, 10);
}

function monthStartMaleDate(now: Date): string {
  const todayStr = maleDateString(now);
  return `${todayStr.slice(0, 7)}-01`;
}

export type BoliOverview = {
  circulating: number;
  circulatingMvr: number;
  totalEverIssued: number;
  totalEverRedeemed: number;
  totalEverExpired: number;
  totalClawedBack: number;
  issuanceThisWeek: { purchase: number; game: number };
  issuanceThisMonth: { purchase: number; game: number };
  redemptionThisWeek: number;
  redemptionThisMonth: number;
  redemptionRateThisMonth: number;
};

export async function getBoliOverview(): Promise<BoliOverview> {
  const db = pool();
  const now = new Date();
  const weekStartIso = maleMidnightUtcIso(weekStartMaleDate(now));
  const monthStartIso = maleMidnightUtcIso(monthStartMaleDate(now));

  const [supplyRes, issuanceWeekRes, issuanceMonthRes, redemptionWeekRes, redemptionMonthRes] = await Promise.all([
    db.query<{
      total_ever_issued: string;
      total_ever_redeemed: string;
      total_ever_expired: string;
      total_clawed_back: string;
      circulating: string;
    }>(`select * from boli_supply`),
    db.query<{ purchase: string; game: string }>(
      `select coalesce(sum(delta) filter (where reason = 'purchase_earn'), 0) as purchase,
              coalesce(sum(delta) filter (where reason in ('game_earn', 'streak_chest')), 0) as game
       from boli_ledger where delta > 0 and created_at >= $1`,
      [weekStartIso]
    ),
    db.query<{ purchase: string; game: string }>(
      `select coalesce(sum(delta) filter (where reason = 'purchase_earn'), 0) as purchase,
              coalesce(sum(delta) filter (where reason in ('game_earn', 'streak_chest')), 0) as game
       from boli_ledger where delta > 0 and created_at >= $1`,
      [monthStartIso]
    ),
    db.query<{ total: string }>(
      `select coalesce(sum(-delta), 0) as total from boli_ledger where reason = 'redemption' and created_at >= $1`,
      [weekStartIso]
    ),
    db.query<{ total: string }>(
      `select coalesce(sum(-delta), 0) as total from boli_ledger where reason = 'redemption' and created_at >= $1`,
      [monthStartIso]
    ),
  ]);

  const supply = supplyRes.rows[0];
  const circulating = Number(supply?.circulating ?? 0);
  const issuanceThisMonth = {
    purchase: Number(issuanceMonthRes.rows[0]?.purchase ?? 0),
    game: Number(issuanceMonthRes.rows[0]?.game ?? 0),
  };
  const redemptionThisMonth = Number(redemptionMonthRes.rows[0]?.total ?? 0);
  const monthIssuanceTotal = issuanceThisMonth.purchase + issuanceThisMonth.game;

  return {
    circulating,
    circulatingMvr: circulating * BOLI_TO_MVR,
    totalEverIssued: Number(supply?.total_ever_issued ?? 0),
    totalEverRedeemed: Number(supply?.total_ever_redeemed ?? 0),
    totalEverExpired: Number(supply?.total_ever_expired ?? 0),
    totalClawedBack: Number(supply?.total_clawed_back ?? 0),
    issuanceThisWeek: {
      purchase: Number(issuanceWeekRes.rows[0]?.purchase ?? 0),
      game: Number(issuanceWeekRes.rows[0]?.game ?? 0),
    },
    issuanceThisMonth,
    redemptionThisWeek: Number(redemptionWeekRes.rows[0]?.total ?? 0),
    redemptionThisMonth,
    redemptionRateThisMonth: monthIssuanceTotal > 0 ? (redemptionThisMonth / monthIssuanceTotal) * 100 : 0,
  };
}

export type TopGameEarner = {
  userId: string;
  name: string;
  email: string;
  gameBoli: number;
  deviceCollisionCount: number;
};

export async function getTopGameEarners(limit = 20): Promise<TopGameEarner[]> {
  const { rows } = await pool().query<{ user_id: string; game_boli: string; collision_count: string }>(
    `with top_earners as (
       select user_id, sum(delta) as game_boli
       from boli_ledger
       where reason in ('game_earn', 'streak_chest') and delta > 0
       group by user_id
       order by sum(delta) desc
       limit $1
     ),
     primary_device as (
       select distinct on (user_id) user_id, device_hash
       from (
         select user_id, device_hash, count(*) as plays
         from boli_dive_plays
         where device_hash is not null
         group by user_id, device_hash
       ) counted
       order by user_id, plays desc
     ),
     collisions as (
       select pd.user_id, count(distinct p2.user_id) - 1 as collision_count
       from primary_device pd
       join boli_dive_plays p2 on p2.device_hash = pd.device_hash
       group by pd.user_id
     )
     select te.user_id, te.game_boli, coalesce(c.collision_count, 0) as collision_count
     from top_earners te
     left join collisions c on c.user_id = te.user_id
     order by te.game_boli desc`,
    [limit]
  );

  return Promise.all(
    rows.map(async (row) => {
      const user = await getUserById(row.user_id);
      return {
        userId: row.user_id,
        name: user?.name ?? "Unknown",
        email: user?.email ?? row.user_id,
        gameBoli: Number(row.game_boli),
        deviceCollisionCount: Number(row.collision_count),
      };
    })
  );
}

export type FraudFlagRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  flagType: "device_collision" | "ip_collision" | "refund_pattern" | "manual";
  detail: Record<string, unknown>;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  createdAt: string;
};

export async function getOpenFraudFlags(): Promise<FraudFlagRow[]> {
  const { rows } = await pool().query<{
    id: string;
    user_id: string;
    flag_type: FraudFlagRow["flagType"];
    detail: Record<string, unknown>;
    status: FraudFlagRow["status"];
    created_at: string;
  }>(`select id, user_id, flag_type, detail, status, created_at from boli_fraud_flags where status = 'open' order by created_at desc`);

  return Promise.all(
    rows.map(async (row) => {
      const user = await getUserById(row.user_id);
      return {
        id: row.id,
        userId: row.user_id,
        userName: user?.name ?? "Unknown",
        userEmail: user?.email ?? row.user_id,
        flagType: row.flag_type,
        detail: row.detail,
        status: row.status,
        createdAt: row.created_at,
      };
    })
  );
}

export type BoliAlert = { severity: "warning" | "critical"; message: string };

/**
 * Alert conditions from BOLI_SPEC.md §8. This codebase has no outbound
 * email/notification channel (checked — no mailer, no Slack webhook,
 * nothing), so these surface as in-dashboard banners rather than sent
 * notifications. BOLI-ASSUMPTION: same documented-gap pattern as the
 * SMS-OTP and Turnstile flags in config.ts — the condition is real and
 * computed live, just not pushed anywhere yet.
 */
export async function getBoliAlerts(): Promise<BoliAlert[]> {
  const db = pool();
  const now = new Date();
  const today = maleDateString(now);
  const alerts: BoliAlert[] = [];

  const caps = await getEffectiveCaps();

  const { rows: budgetRows } = await db.query<{ total_boli_issued: string }>(
    `select total_boli_issued from boli_daily_game_budget where play_date = $1`,
    [today]
  );
  const globalUsed = Number(budgetRows[0]?.total_boli_issued ?? 0);
  if (caps.globalDailyBudget > 0 && globalUsed / caps.globalDailyBudget >= ALERT_GLOBAL_BUDGET_PCT) {
    alerts.push({
      severity: globalUsed >= caps.globalDailyBudget ? "critical" : "warning",
      message: `Global daily Boli Dive budget at ${Math.round((globalUsed / caps.globalDailyBudget) * 100)}% (${globalUsed.toLocaleString()} / ${caps.globalDailyBudget.toLocaleString()}) today.`,
    });
  }

  const weekStart = weekStartMaleDate(now);
  const weekEnd = new Date(`${weekStart}T00:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const { rows: weeklyRows } = await db.query<{ user_id: string; weekly_used: string }>(
    `select user_id, sum(final_payout + chest_boli) as weekly_used
     from boli_dive_plays
     where play_date >= $1 and play_date <= $2
     group by user_id
     having sum(final_payout + chest_boli) >= $3`,
    [weekStart, weekEnd.toISOString().slice(0, 10), Math.floor(caps.weeklyCap * ALERT_WEEKLY_CAP_PCT)]
  );
  if (weeklyRows.length > 0) {
    alerts.push({
      severity: "warning",
      message: `${weeklyRows.length} account(s) at ${Math.round(ALERT_WEEKLY_CAP_PCT * 100)}%+ of the weekly Boli Dive cap this week.`,
    });
  }

  const todayStartIso = maleMidnightUtcIso(today);
  const trailingStartIso = new Date(new Date(todayStartIso).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ rows: todayRedRows }, { rows: trailingRedRows }] = await Promise.all([
    db.query<{ total: string }>(
      `select coalesce(sum(-delta), 0) as total from boli_ledger where reason = 'redemption' and created_at >= $1`,
      [todayStartIso]
    ),
    db.query<{ total: string }>(
      `select coalesce(sum(-delta), 0) as total from boli_ledger where reason = 'redemption' and created_at >= $1 and created_at < $2`,
      [trailingStartIso, todayStartIso]
    ),
  ]);
  const todayRedeemed = Number(todayRedRows[0]?.total ?? 0);
  const trailingAvgDaily = Number(trailingRedRows[0]?.total ?? 0) / 30;
  if (trailingAvgDaily > 0 && todayRedeemed >= trailingAvgDaily * ALERT_REDEMPTION_SPIKE_MULTIPLIER) {
    alerts.push({
      severity: "warning",
      message: `Redemption today (${todayRedeemed.toLocaleString()} Boli) is ${(todayRedeemed / trailingAvgDaily).toFixed(1)}x the trailing 30-day daily average.`,
    });
  }

  const { rows: collisionRows } = await db.query<{ device_hash: string; accounts: string }>(
    `select device_hash, count(distinct user_id) as accounts
     from boli_dive_plays
     where device_hash is not null
     group by device_hash
     having count(distinct user_id) >= $1`,
    [ALERT_DEVICE_COLLISION_COUNT]
  );
  if (collisionRows.length > 0) {
    alerts.push({
      severity: "warning",
      message: `${collisionRows.length} device(s) shared by ${ALERT_DEVICE_COLLISION_COUNT}+ accounts — review the fraud queue.`,
    });
  }

  return alerts;
}
