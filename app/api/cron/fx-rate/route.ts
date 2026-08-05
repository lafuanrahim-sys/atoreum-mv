import crypto from "crypto";
import { NextResponse } from "next/server";
import { updateFxLatestMarketRate } from "@/lib/data/fx.server";
import { fetchLatestUsdBuyRateFromTelegram } from "@/lib/telegram/fxRate.server";

export const maxDuration = 30;

/**
 * Daily pull of the parallel-market USD buying rate from the Mystic
 * Exchange Telegram group, into fx_settings.latest_market_rate -- same
 * secret-guarded cron pattern as /api/cron/boli-expiry (no scheduled-job
 * runner in this codebase besides Vercel Cron hitting these routes).
 *
 * Sanity-bounded: a garbled parse (e.g. picking up the phone number
 * instead of the rate) is rejected rather than silently corrupting a
 * figure every exchange row's profit-vs-market compares against.
 */
const MIN_PLAUSIBLE_RATE = 10;
const MAX_PLAUSIBLE_RATE = 50;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const given = Buffer.from(authHeader);
  const wanted = Buffer.from(expected);
  const authorized = given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let result;
  try {
    result = await fetchLatestUsdBuyRateFromTelegram();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  if (!result) {
    return NextResponse.json({ updated: false, reason: "No USD buying line found in recent messages." });
  }
  if (result.rate < MIN_PLAUSIBLE_RATE || result.rate > MAX_PLAUSIBLE_RATE) {
    return NextResponse.json({
      updated: false,
      reason: `Parsed rate ${result.rate} is outside the plausible ${MIN_PLAUSIBLE_RATE}-${MAX_PLAUSIBLE_RATE} range -- skipped.`,
      raw: result.raw,
    });
  }

  const settings = await updateFxLatestMarketRate(result.rate, "Telegram auto-fetch (Mystic Exchange)");
  return NextResponse.json({
    updated: true,
    rate: settings.latestMarketRate,
    postedAt: result.postedAt.toISOString(),
  });
}
