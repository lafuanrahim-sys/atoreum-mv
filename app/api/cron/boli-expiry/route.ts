import crypto from "crypto";
import { NextResponse } from "next/server";
import { listAllBoliUserIds, expireUser } from "@/lib/boli/ledger.server";

/**
 * Daily Boli expiry sweep (BOLI_SPEC.md §4.4). No cron/scheduled-job runner
 * exists anywhere else in this codebase, so this is a plain API route
 * guarded by a shared secret — point an external scheduler (Vercel Cron,
 * a hosting-provider cron, or a simple `curl` in a system crontab) at it
 * once daily. Never exposed unauthenticated: BOLI_CRON_SECRET must be set
 * and match, or this 401s.
 *
 * Each user's sweep is independent and idempotent (boli_expire_user() only
 * ever writes an 'expired' entry once per credit lot), so a retried or
 * overlapping run is always safe.
 */
export async function GET(request: Request) {
  const secret = process.env.BOLI_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "BOLI_CRON_SECRET is not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const given = Buffer.from(authHeader);
  const wanted = Buffer.from(expected);
  const authorized = given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userIds = await listAllBoliUserIds();
  let lotsExpired = 0;
  let usersWithExpiry = 0;
  const failures: { userId: string; error: string }[] = [];

  for (const userId of userIds) {
    try {
      const count = await expireUser(userId);
      if (count > 0) {
        lotsExpired += count;
        usersWithExpiry++;
      }
    } catch (err) {
      failures.push({ userId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({
    usersChecked: userIds.length,
    usersWithExpiry,
    lotsExpired,
    failures,
  });
}
