import { pool } from "./db";
import {
  TIER_MULTIPLIER,
  TIER_THRESHOLD_LIFETIME_EARNED,
  type BoliTier,
  PURCHASE_EARN_BOLI,
  PURCHASE_EARN_PER_MVR,
  PURCHASE_BOLI_EXPIRY_DAYS,
  MIN_REDEMPTION_BOLI,
  MAX_REDEMPTION_SUBTOTAL_FRACTION,
  REDEMPTION_BOLI_PER_MVR,
} from "./config";

/**
 * The Boli ledger service. Every balance-affecting write goes through one of
 * the exported functions below, which call the Postgres functions in
 * lib/boli/schema.sql via a direct connection (see lib/boli/db.ts) — never
 * insert into boli_ledger directly from anywhere else in the app. Those
 * Postgres functions hold the row lock, assign the hash-chain link, and
 * update the cached balance atomically; this file is a thin, typed wrapper
 * plus the Boli-specific business rules (earn formula, tier lookup,
 * redemption pre-checks) that don't need to live in SQL.
 */

export type BoliLedgerReason =
  | "purchase_earn"
  | "game_earn"
  | "streak_chest"
  | "redemption"
  | "redemption_reversal"
  | "refund_clawback"
  | "expired"
  | "admin_adjustment";

export type BoliSourceType = "order" | "dive_play" | "streak" | "redemption" | "expiry" | "admin";

export type BoliLedgerEntry = {
  id: string;
  user_id: string;
  delta: string; // bigint (int8) columns come back as numeric strings from `pg` by default — never lossy-converted to a JS number
  reason: BoliLedgerReason;
  source_type: BoliSourceType;
  source_id: string | null;
  idempotency_key: string;
  sequence: string;
  prev_hash: string;
  entry_hash: string;
  expires_at: string | null;
  created_by_admin_id: string | null;
  admin_reason: string | null;
  created_at: string;
};

export type BoliBalanceSnapshot = {
  userId: string;
  /** The real figure — may be negative while an account is under fraud review (spec §6.2). Never shown to the user directly. */
  trueBalance: bigint;
  /** max(0, trueBalance) — what the UI displays. */
  displayBalance: bigint;
  lifetimeEarned: bigint;
  tier: BoliTier;
  hasDeliveredOrder: boolean;
  gameAccessSuspended: boolean;
};

function toBigInt(v: string | number | bigint | null | undefined): bigint {
  if (v === null || v === undefined) return BigInt(0);
  if (typeof v === "bigint") return v;
  return BigInt(Math.trunc(Number(v)) === Number(v) ? v : Math.trunc(Number(v)));
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Postgres RAISE EXCEPTION messages arrive prefixed with context (e.g. the calling function's name) — strip it so the user-facing error is just the message boli_redeem() actually wrote. */
function cleanPgErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/^.*boli_redeem:\s*/i, "");
}

/** Highest tier whose lifetime-earned threshold the user has cleared. */
export function getTier(lifetimeEarned: bigint): BoliTier {
  const order: BoliTier[] = ["thari", "kandu", "vilu", "faru"];
  for (const t of order) {
    if (lifetimeEarned >= BigInt(TIER_THRESHOLD_LIFETIME_EARNED[t])) return t;
  }
  return "faru";
}

/** The exact formula creditPurchaseEarn() applies, exposed standalone so the account page can show "Pending" orders their expected Boli before they're actually credited (BOLI_SPEC.md §4.2). Pure math, no I/O — the real credit still only ever happens through creditPurchaseEarn(). */
export function estimatePurchaseEarn(orderSubtotalMvr: number, boliDiscountMvr: number, tier: BoliTier): number {
  const eligibleMvr = Math.max(0, orderSubtotalMvr - boliDiscountMvr);
  const baseBoli = Math.floor(eligibleMvr / PURCHASE_EARN_PER_MVR) * PURCHASE_EARN_BOLI;
  return Math.floor(baseBoli * TIER_MULTIPLIER[tier]);
}

/**
 * Parse a raw, untrusted redemption-amount input (form field, JSON body...)
 * into a positive integer bigint, or null if it's anything else — not a
 * digit string, zero, negative, fractional, or too large to be a sane Boli
 * amount. Spec §6.4: "Reject non-integers, negatives and overflow explicitly."
 */
export function parseBoliAmount(raw: unknown): bigint | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const str = String(raw).trim();
  if (!/^[0-9]+$/.test(str)) return null;
  try {
    const n = BigInt(str);
    if (n <= BigInt(0)) return null;
    if (n > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return n;
  } catch {
    return null;
  }
}

async function ledgerWrite(params: {
  userId: string;
  delta: bigint;
  reason: BoliLedgerReason;
  sourceType: BoliSourceType;
  sourceId?: string | null;
  idempotencyKey: string;
  expiresAt?: Date | null;
  createdByAdminId?: string | null;
  adminReason?: string | null;
}): Promise<BoliLedgerEntry> {
  const { rows } = await pool().query<BoliLedgerEntry>(
    `select * from boli_ledger_write($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      params.userId,
      params.delta.toString(),
      params.reason,
      params.sourceType,
      params.sourceId ?? null,
      params.idempotencyKey,
      params.expiresAt ? params.expiresAt.toISOString() : null,
      params.createdByAdminId ?? null,
      params.adminReason ?? null,
    ]
  );
  if (rows.length === 0) throw new Error(`boli ledgerWrite(${params.reason}) returned no row`);
  return rows[0];
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getBalance(userId: string): Promise<BoliBalanceSnapshot> {
  const { rows } = await pool().query(`select * from boli_users where user_id = $1`, [userId]);
  const data = rows[0];
  if (!data) {
    return {
      userId,
      trueBalance: BigInt(0),
      displayBalance: BigInt(0),
      lifetimeEarned: BigInt(0),
      tier: "faru",
      hasDeliveredOrder: false,
      gameAccessSuspended: false,
    };
  }
  const trueBalance = toBigInt(data.boli_balance_cached);
  const lifetimeEarned = toBigInt(data.boli_lifetime_earned);
  return {
    userId,
    trueBalance,
    displayBalance: trueBalance < BigInt(0) ? BigInt(0) : trueBalance,
    lifetimeEarned,
    tier: getTier(lifetimeEarned),
    hasDeliveredOrder: Boolean(data.has_delivered_order),
    gameAccessSuspended: Boolean(data.game_access_suspended),
  };
}

export type BoliLedgerPage = { entries: BoliLedgerEntry[]; hasMore: boolean };

export async function listLedger(userId: string, opts: { limit?: number; offset?: number } = {}): Promise<BoliLedgerPage> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  // Fetch one extra row to detect "hasMore" without a separate count query.
  const { rows } = await pool().query<BoliLedgerEntry>(
    `select * from boli_ledger where user_id = $1 order by sequence desc limit $2 offset $3`,
    [userId, limit + 1, offset]
  );
  return { entries: rows.slice(0, limit), hasMore: rows.length > limit };
}

/** Boli currently within EXPIRY_WARNING_WINDOW_DAYS of expiring — sum of `remaining` from still-live lots whose expiry falls in that window. */
export async function getExpiringSoon(userId: string, withinDays: number): Promise<bigint> {
  const cutoff = addDays(new Date(), withinDays).toISOString();
  const { rows } = await pool().query<{ ledger_id: string; remaining: string; expires_at: string | null }>(
    `select * from boli_spendable_lots($1)`,
    [userId]
  );
  const now = new Date().toISOString();
  return rows
    .filter((r) => r.expires_at && r.expires_at > now && r.expires_at <= cutoff)
    .reduce((sum, r) => sum + toBigInt(r.remaining), BigInt(0));
}

// ---------------------------------------------------------------------------
// Writes — purchase credit / clawback (BOLI_SPEC.md §4.2, §6.2)
// ---------------------------------------------------------------------------

/**
 * Credits the Boli an order earned, once — safe to call more than once for
 * the same order (idempotency key is `order:{orderId}:delivered`; a retried
 * call is a no-op). `orderSubtotal` and `boliDiscountAmount` are both in
 * MVR; earning excludes shipping (never in `subtotal` to begin with) and
 * excludes the discounted portion per spec §4.2.
 */
export async function creditPurchaseEarn(params: {
  userId: string;
  orderId: string;
  orderSubtotalMvr: number;
  boliDiscountMvr: number;
}): Promise<BoliLedgerEntry | null> {
  const { lifetimeEarned } = await getBalance(params.userId);
  const tier = getTier(lifetimeEarned);
  const finalBoli = estimatePurchaseEarn(params.orderSubtotalMvr, params.boliDiscountMvr, tier);
  if (finalBoli <= 0) return null;

  return ledgerWrite({
    userId: params.userId,
    delta: BigInt(finalBoli),
    reason: "purchase_earn",
    sourceType: "order",
    sourceId: params.orderId,
    idempotencyKey: `order:${params.orderId}:delivered`,
    expiresAt: addDays(new Date(), PURCHASE_BOLI_EXPIRY_DAYS),
  });
}

/**
 * Reverses everything a single order did to the ledger, on cancellation or
 * refund (spec §6.2): claws back Boli it earned, and returns Boli it spent.
 * Both halves are independently idempotent and safe to call even if only
 * one of them ever happened for this order.
 */
export async function reverseOrder(params: { userId: string; orderId: string }): Promise<{
  clawback: BoliLedgerEntry | null;
  reversal: BoliLedgerEntry | null;
}> {
  const db = pool();

  const { rows: earnRows } = await db.query<BoliLedgerEntry>(
    `select * from boli_ledger where source_type = 'order' and source_id = $1 and reason = 'purchase_earn' limit 1`,
    [params.orderId]
  );

  let clawback: BoliLedgerEntry | null = null;
  const originalEarn = earnRows[0];
  if (originalEarn) {
    const amount = toBigInt(originalEarn.delta);
    if (amount > BigInt(0)) {
      clawback = await ledgerWrite({
        userId: params.userId,
        delta: -amount,
        reason: "refund_clawback",
        sourceType: "order",
        sourceId: params.orderId,
        idempotencyKey: `clawback:${params.orderId}`,
        expiresAt: null,
      });
    }
  }

  const { rows: redemptionRows } = await db.query<BoliLedgerEntry>(
    `select * from boli_ledger where source_type = 'redemption' and source_id = $1 and reason = 'redemption' limit 1`,
    [params.orderId]
  );

  let reversal: BoliLedgerEntry | null = null;
  const originalRedemption = redemptionRows[0];
  if (originalRedemption) {
    const amount = toBigInt(originalRedemption.delta); // negative
    if (amount < BigInt(0)) {
      reversal = await ledgerWrite({
        userId: params.userId,
        delta: -amount, // flip back to positive — the boli are returned
        reason: "redemption_reversal",
        sourceType: "redemption",
        sourceId: params.orderId,
        idempotencyKey: `reversal:${params.orderId}`,
        expiresAt: null,
      });
    }
  }

  return { clawback, reversal };
}

// ---------------------------------------------------------------------------
// Writes — redemption (BOLI_SPEC.md §4.3, §6.1, §6.3, §6.4)
// ---------------------------------------------------------------------------

export type RedeemResult = { ok: true; entry: BoliLedgerEntry; mvrValue: number } | { ok: false; error: string };

/**
 * Validates and applies a checkout redemption. The tunable caps (min
 * redemption, 30% of subtotal) are checked here in TypeScript so they stay
 * in lib/boli/config.ts, never in a migration; the invariant safety
 * checks that must never be bypassed (delivered-order eligibility,
 * non-negative true balance, sufficient spendable balance) are re-checked
 * inside boli_redeem() itself, inside the same locked transaction — this
 * function's own checks are the first line of defense, not the only one.
 */
export async function redeemForOrder(params: {
  userId: string;
  orderId: string;
  boliAmount: bigint;
  orderSubtotalMvr: number;
}): Promise<RedeemResult> {
  if (params.boliAmount <= BigInt(0)) return { ok: false, error: "Redemption amount must be a positive whole number of Boli." };

  if (params.boliAmount < BigInt(MIN_REDEMPTION_BOLI)) {
    return { ok: false, error: `Minimum redemption is ${MIN_REDEMPTION_BOLI.toLocaleString()} Boli.` };
  }

  const maxAllowedBoli = Math.floor(params.orderSubtotalMvr * MAX_REDEMPTION_SUBTOTAL_FRACTION * REDEMPTION_BOLI_PER_MVR);
  if (params.boliAmount > BigInt(maxAllowedBoli)) {
    return {
      ok: false,
      error: `You can redeem at most ${Math.round(MAX_REDEMPTION_SUBTOTAL_FRACTION * 100)}% of this order's subtotal in Boli (${maxAllowedBoli.toLocaleString()} Boli max).`,
    };
  }

  const mvrValue = Number(params.boliAmount) / REDEMPTION_BOLI_PER_MVR;

  try {
    const { rows } = await pool().query<BoliLedgerEntry>(`select * from boli_redeem($1,$2,$3,$4)`, [
      params.userId,
      params.orderId,
      params.boliAmount.toString(),
      mvrValue,
    ]);
    return { ok: true, entry: rows[0], mvrValue };
  } catch (err) {
    // boli_redeem() raises a descriptive message for every real rejection
    // (ineligible / under review / insufficient balance) — surface it as-is
    // rather than a generic failure.
    return { ok: false, error: cleanPgErrorMessage(err) };
  }
}

// ---------------------------------------------------------------------------
// Writes — expiry sweep (BOLI_SPEC.md §4.4) and admin adjustments (§6.6)
// ---------------------------------------------------------------------------

export async function listAllBoliUserIds(): Promise<string[]> {
  const { rows } = await pool().query<{ user_id: string }>(`select user_id from boli_users`);
  return rows.map((r) => r.user_id);
}

/** Sweeps every stale credit lot for one user; returns how many lots it expired. Safe to call repeatedly (each lot's expiry is written at most once). */
export async function expireUser(userId: string): Promise<number> {
  const { rows } = await pool().query<{ boli_expire_user: number }>(`select boli_expire_user($1)`, [userId]);
  return Number(rows[0]?.boli_expire_user ?? 0);
}

/** Manual balance adjustment. Always attributed and always requires a reason (spec §6.6) — there is no unattributed-adjustment code path. */
export async function adminAdjustment(params: {
  userId: string;
  delta: bigint;
  adminId: string;
  reason: string;
  idempotencyKey?: string;
}): Promise<BoliLedgerEntry> {
  const reason = params.reason.trim();
  if (!reason) throw new Error("adminAdjustment: a reason is required.");
  if (!params.adminId) throw new Error("adminAdjustment: an acting admin id is required.");

  return ledgerWrite({
    userId: params.userId,
    delta: params.delta,
    reason: "admin_adjustment",
    sourceType: "admin",
    sourceId: null,
    idempotencyKey: params.idempotencyKey ?? `admin:${params.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    expiresAt: null,
    createdByAdminId: params.adminId,
    adminReason: reason,
  });
}
