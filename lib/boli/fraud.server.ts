import { pool } from "./db";
import { DEVICE_HASH_FLAG_THRESHOLD, REFUND_FLAG_COUNT, REFUND_FLAG_WINDOW_DAYS } from "./config";

/**
 * Fraud-flag writes (BOLI_SPEC.md §6.1, §6.2) — flag-for-review only, never
 * an automatic hard block except where the spec explicitly calls for one
 * (refund-pattern suspension of game access). IP is deliberately never
 * used here (§6.1 item 5: "Never hard-block on IP" — and this codebase has
 * no reliable server-side IP capture path either, so it isn't wired in at
 * all rather than half-built against a value that's usually just the CDN's
 * address).
 */

/**
 * Device-hash collision (BOLI_SPEC.md §6.1 item 4): once a device hash has
 * been used by DEVICE_HASH_FLAG_THRESHOLD or more distinct accounts to play
 * Boli Dive, flag it for admin review. Idempotent-ish: skips if an open
 * flag for this exact device hash already exists, so repeat plays from the
 * same cluster of accounts don't spam the review queue.
 */
export async function flagDeviceHashCollisionIfNeeded(deviceHash: string | null | undefined): Promise<void> {
  if (!deviceHash) return;
  const db = pool();

  const { rows: countRows } = await db.query<{ distinct_users: string }>(
    `select count(distinct user_id) as distinct_users from boli_dive_plays where device_hash = $1`,
    [deviceHash]
  );
  const distinctUsers = Number(countRows[0]?.distinct_users ?? 0);
  if (distinctUsers < DEVICE_HASH_FLAG_THRESHOLD) return;

  const { rows: openRows } = await db.query(
    `select 1 from boli_fraud_flags where flag_type = 'device_collision' and status = 'open' and detail ->> 'deviceHash' = $1`,
    [deviceHash]
  );
  if (openRows.length > 0) return;

  const { rows: userRows } = await db.query<{ user_id: string }>(
    `select distinct user_id from boli_dive_plays where device_hash = $1`,
    [deviceHash]
  );

  await db.query(
    `insert into boli_fraud_flags (user_id, flag_type, detail) values ($1, 'device_collision', $2)`,
    [
      userRows[0]?.user_id ?? "unknown",
      JSON.stringify({ deviceHash, accountCount: distinctUsers, userIds: userRows.map((r) => r.user_id) }),
    ]
  );
}

/**
 * Refund-pattern suspension (BOLI_SPEC.md §6.2): 3+ refunds within a
 * trailing 90-day window flags the account AND suspends its game access
 * pending review — this is the one place a fraud signal here does more
 * than flag. Idempotent per distinct refunded order (COUNT(DISTINCT
 * source_id) so a clawback retried under the ledger's own idempotency key
 * never inflates the count).
 */
export async function flagRefundPatternIfNeeded(userId: string): Promise<boolean> {
  const db = pool();
  const windowStart = new Date(Date.now() - REFUND_FLAG_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { rows: countRows } = await db.query<{ refund_count: string }>(
    `select count(distinct source_id) as refund_count from boli_ledger
     where user_id = $1 and reason = 'refund_clawback' and created_at >= $2`,
    [userId, windowStart]
  );
  const refundCount = Number(countRows[0]?.refund_count ?? 0);
  if (refundCount < REFUND_FLAG_COUNT) return false;

  const { rows: openRows } = await db.query(
    `select 1 from boli_fraud_flags where user_id = $1 and flag_type = 'refund_pattern' and status = 'open'`,
    [userId]
  );
  if (openRows.length === 0) {
    await db.query(
      `insert into boli_fraud_flags (user_id, flag_type, detail) values ($1, 'refund_pattern', $2)`,
      [userId, JSON.stringify({ refundCount, windowDays: REFUND_FLAG_WINDOW_DAYS })]
    );
  }

  await db.query(`update boli_users set game_access_suspended = true, updated_at = now() where user_id = $1`, [userId]);
  return true;
}

/**
 * Admin review action on a fraud flag (BOLI_SPEC.md §8: "Open fraud flags
 * with a resolve action"). Resolving a refund_pattern flag does NOT
 * automatically lift game_access_suspended — that's a separate, deliberate
 * admin decision (see unsuspendGameAccess below) so clearing the flag
 * can't silently reopen the account.
 */
export async function resolveFraudFlag(params: {
  flagId: string;
  adminId: string;
  status: "resolved" | "dismissed";
}): Promise<void> {
  await pool().query(
    `update boli_fraud_flags set status = $2, resolved_at = now(), resolved_by = $3 where id = $1`,
    [params.flagId, params.status, params.adminId]
  );
}

export async function unsuspendGameAccess(userId: string): Promise<void> {
  await pool().query(`update boli_users set game_access_suspended = false, updated_at = now() where user_id = $1`, [userId]);
}
