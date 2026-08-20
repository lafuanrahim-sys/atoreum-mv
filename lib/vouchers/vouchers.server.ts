import { pool } from "@/lib/db";
import { BOLI_TO_MVR } from "@/lib/boli/config";
import { generateVoucherCode } from "@/lib/vouchers/code";

/**
 * Gift vouchers — the TypeScript side of lib/vouchers/schema.sql.
 *
 * Every function here is a thin call into a Postgres function. Nothing in this
 * file decides whether a redemption is allowed, what the balance is, or
 * whether a code has expired; the database owns all of that, because a
 * bearer instrument needs exactly one authority and this file is not it.
 */

export type Voucher = {
  id: string;
  code: string;
  purchaserUserId: string;
  orderId: string;
  faceValueBoli: number;
  balanceBoli: number;
  status: "pending" | "active" | "exhausted" | "expired" | "void";
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  code: string;
  purchaser_user_id: string;
  order_id: string;
  face_value_boli: string;
  balance_boli: string;
  status: Voucher["status"];
  activated_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
};

function toVoucher(r: Row): Voucher {
  return {
    id: r.id,
    code: r.code,
    purchaserUserId: r.purchaser_user_id,
    orderId: r.order_id,
    faceValueBoli: Number(r.face_value_boli),
    balanceBoli: Number(r.balance_boli),
    status: r.status,
    activatedAt: r.activated_at?.toISOString() ?? null,
    expiresAt: r.expires_at?.toISOString() ?? null,
    createdAt: r.created_at.toISOString(),
  };
}

/** Sangu to rufiyaa, the one conversion in the system. */
export function boliToMvr(boli: number): number {
  return Math.round(boli * BOLI_TO_MVR * 100) / 100;
}

/** What a gift of this many Sangu costs to buy: face value, at par. */
export function voucherPriceMvr(faceValueBoli: number): number {
  return boliToMvr(faceValueBoli);
}

/** The denominations offered. Each is priced at exactly its face value —
 * a voucher is prepaid credit, not a discount, so buying one is never a way
 * to obtain Sangu more cheaply than the shop sells it. */
export const VOUCHER_DENOMINATIONS_BOLI = [1_000, 2_000, 5_000, 10_000] as const;

/**
 * Create the voucher that an order is buying, in the 'pending' state.
 *
 * Pending means paid-for-but-unconfirmed: the code exists, the buyer can see
 * it, and it will not spend a single Sangu until the order reaches Confirmed.
 * Retried on a code collision, which at 80 bits will not happen, but a
 * unique-constraint failure should not lose someone's purchase.
 */
export async function createPendingVoucher(params: {
  purchaserUserId: string;
  orderId: string;
  faceValueBoli: number;
}): Promise<Voucher> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateVoucherCode();
    try {
      const { rows } = await pool().query<Row>(
        `insert into gift_vouchers (code, purchaser_user_id, order_id, face_value_boli, balance_boli)
         values ($1, $2, $3, $4, $4)
         returning *`,
        [code, params.purchaserUserId, params.orderId, params.faceValueBoli]
      );
      return toVoucher(rows[0]);
    } catch (err) {
      const code23505 = (err as { code?: string }).code === "23505";
      const onOrder = String((err as { constraint?: string }).constraint ?? "").includes("order");
      // Same order twice: the voucher already exists, return it rather than
      // minting a second against one payment.
      if (code23505 && onOrder) {
        const existing = await getVoucherByOrder(params.orderId);
        if (existing) return existing;
      }
      if (!code23505 || attempt === 4) throw err;
    }
  }
  throw new Error("Could not allocate a voucher code.");
}

/** Called when the purchase order is confirmed. Idempotent. */
export async function activateVoucherForOrder(orderId: string): Promise<Voucher | null> {
  const { rows } = await pool().query<Row>("select * from voucher_activate($1)", [orderId]);
  return rows[0]?.id ? toVoucher(rows[0]) : null;
}

/**
 * Spend against a code. Returns the Sangu actually taken, which may be less
 * than asked for when the balance is smaller — the caller states what the
 * order could absorb and takes what is there.
 *
 * Throws with the database's own message when the voucher cannot be spent
 * (not yet active, expired, empty, unknown). Those messages are written to be
 * shown to a customer.
 */
export async function redeemVoucher(params: {
  code: string;
  orderId: string;
  wantBoli: number;
  redeemer: { name: string; email: string; phone: string };
}): Promise<number> {
  const { rows } = await pool().query<{ voucher_redeem: string }>(
    "select voucher_redeem($1, $2, $3, $4)",
    [params.code, params.orderId, params.wantBoli, JSON.stringify(params.redeemer)]
  );
  return Number(rows[0].voucher_redeem);
}

/**
 * Undo an order's voucher spend. Returns the amount that could NOT be put
 * back on the voucher (because it had since expired or been voided) and is
 * therefore owed to the purchaser instead — 0 in the ordinary case.
 */
export async function reverseVoucherForOrder(orderId: string): Promise<number> {
  const { rows } = await pool().query<{ voucher_reverse: string }>("select voucher_reverse($1)", [orderId]);
  return Number(rows[0].voucher_reverse);
}

export async function getVoucherByOrder(orderId: string): Promise<Voucher | null> {
  const { rows } = await pool().query<Row>("select * from gift_vouchers where order_id = $1", [orderId]);
  return rows[0] ? toVoucher(rows[0]) : null;
}

/** For the account tab. Only ever called with the signed-in user's own id. */
export async function listVouchersForPurchaser(userId: string): Promise<Voucher[]> {
  const { rows } = await pool().query<Row>(
    "select * from gift_vouchers where purchaser_user_id = $1 order by created_at desc",
    [userId]
  );
  return rows.map(toVoucher);
}

/**
 * What a code is worth right now, for the checkout preview.
 *
 * Deliberately returns the same shape for "no such code" and "not spendable":
 * a stranger probing codes learns only that this one is not usable, never
 * whether it exists, who owns it, or what it once held.
 */
export async function previewVoucher(code: string): Promise<{ balanceBoli: number } | null> {
  const { rows } = await pool().query<{ balance_boli: string; status: string; expires_at: Date | null }>(
    "select balance_boli, status, expires_at from gift_vouchers where code = $1",
    [code]
  );
  const v = rows[0];
  if (!v) return null;
  if (v.status !== "active" && v.status !== "exhausted") return null;
  if (v.expires_at && v.expires_at.getTime() <= Date.now()) return null;
  if (Number(v.balance_boli) <= 0) return null;
  return { balanceBoli: Number(v.balance_boli) };
}

/** Vouchers past their expiry date, for the expiry job. */
export async function listExpirableVouchers(): Promise<Voucher[]> {
  const { rows } = await pool().query<Row>(
    `select * from gift_vouchers
      where status in ('active', 'exhausted')
        and expires_at is not null and expires_at <= now()`
  );
  return rows.map(toVoucher);
}

/** Closes a voucher and returns its remainder to the purchaser as Sangu. */
export async function expireVoucher(voucherId: string): Promise<number> {
  const { rows } = await pool().query<{ voucher_expire: string }>("select voucher_expire($1)", [voucherId]);
  return Number(rows[0].voucher_expire);
}

/** Every voucher, newest first, with who bought it and what it has done.
 * Admin-only: the code is masked by the caller, never shown in full. */
export async function listAllVouchers(): Promise<
  (Voucher & { purchaserName: string; purchaserEmail: string; redemptions: number; orderNumber: string })[]
> {
  const { rows } = await pool().query<
    Row & { purchaser_name: string | null; purchaser_email: string | null; redemptions: string; order_number: string | null }
  >(
    `select gv.*,
            u.name  as purchaser_name,
            u.email as purchaser_email,
            o.order_number,
            (select count(*) from gift_voucher_events e
              where e.voucher_id = gv.id and e.kind = 'redeemed')::text as redemptions
       from gift_vouchers gv
       left join users u on u.id = gv.purchaser_user_id
       left join orders o on o.id = gv.order_id
      order by gv.created_at desc`
  );
  return rows.map((r) => ({
    ...toVoucher(r),
    purchaserName: r.purchaser_name ?? "(account removed)",
    purchaserEmail: r.purchaser_email ?? "",
    orderNumber: r.order_number ?? "(order removed)",
    redemptions: Number(r.redemptions),
  }));
}

/** What a single voucher has done, for the admin detail view. */
export async function listVoucherEvents(voucherId: string): Promise<
  { kind: string; deltaBoli: number; orderId: string | null; redeemer: { name?: string; email?: string; phone?: string } | null; note: string; createdAt: string }[]
> {
  const { rows } = await pool().query<{
    kind: string; delta_boli: string; order_id: string | null;
    redeemer: { name?: string; email?: string; phone?: string } | null; note: string; created_at: Date;
  }>(
    "select kind, delta_boli, order_id, redeemer, note, created_at from gift_voucher_events where voucher_id = $1 order by created_at",
    [voucherId]
  );
  return rows.map((r) => ({
    kind: r.kind,
    deltaBoli: Number(r.delta_boli),
    orderId: r.order_id,
    redeemer: r.redeemer,
    note: r.note,
    createdAt: r.created_at.toISOString(),
  }));
}
