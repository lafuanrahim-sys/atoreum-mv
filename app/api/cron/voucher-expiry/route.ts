import crypto from "crypto";
import { NextResponse } from "next/server";
import { listExpirableVouchers, expireVoucher } from "@/lib/vouchers/vouchers.server";

/**
 * Daily gift voucher expiry sweep.
 *
 * A voucher that reaches its expiry date is closed and whatever is left on it
 * is returned to whoever paid for it, as Sangu. Without this the money simply
 * sits in a dead code: the recipient can no longer spend it and the buyer
 * never gets it back, which is the shop quietly keeping cash for nothing.
 *
 * Guarded by the same shared secret as the Boli sweep, checked with a
 * timing-safe comparison so the header cannot be probed a byte at a time.
 *
 * Every step is idempotent. voucher_expire() only acts on a voucher that is
 * still open, and the Sangu credit it writes carries the idempotency key
 * 'voucher_remainder:<id>', so a retried or overlapping run pays once.
 */
export async function GET(request: Request) {
  const secret = process.env.BOLI_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "BOLI_CRON_SECRET is not configured." }, { status: 500 });
  }

  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  const authorized = given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const due = await listExpirableVouchers();
  let closed = 0;
  let returnedBoli = 0;
  const failures: { code: string; error: string }[] = [];

  for (const voucher of due) {
    try {
      // One at a time, each in its own transaction: a voucher that fails must
      // not stop the rest of the sweep, and half a sweep is fine because the
      // next run picks up whatever is still open.
      const remainder = await expireVoucher(voucher.id);
      closed++;
      returnedBoli += remainder;
    } catch (err) {
      failures.push({ code: voucher.code, error: (err as Error).message.slice(0, 200) });
      console.error(`[voucher-expiry] ${voucher.code} failed:`, err);
    }
  }

  if (closed > 0 || failures.length > 0) {
    console.log(
      `[voucher-expiry] closed ${closed} voucher(s), returned ${returnedBoli} Sangu to purchasers` +
        (failures.length ? `, ${failures.length} failed` : "")
    );
  }

  return NextResponse.json({
    due: due.length,
    closed,
    returnedBoli,
    returnedMvr: Math.round(returnedBoli * 0.01 * 100) / 100,
    failures,
  });
}
