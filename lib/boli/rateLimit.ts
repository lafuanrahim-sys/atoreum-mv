import { RATE_LIMITS } from "./config";
import { checkRateLimit, type RateLimitResult } from "@/lib/rateLimit";

/**
 * Boli Dive's own rate limits (BOLI_SPEC.md §6.5), built on the shared
 * sliding-window primitive in lib/rateLimit.ts. BOLI-ASSUMPTION: the
 * numbers here are abuse-shaping, not a hard security boundary — the real
 * security boundary is the fraud/eligibility logic in dive.server.ts, which
 * doesn't depend on this file at all.
 */

/** Checks both the per-user and per-IP limits for the Boli Dive play endpoint; either breach blocks the request. */
export function checkPlayRateLimit(userId: string, ip: string): RateLimitResult {
  const { perUser, perIp } = RATE_LIMITS.play;
  if (!checkRateLimit(`play:user:${userId}`, perUser.limit, perUser.windowSeconds)) {
    return { ok: false, retryAfterSeconds: perUser.windowSeconds };
  }
  if (!checkRateLimit(`play:ip:${ip}`, perIp.limit, perIp.windowSeconds)) {
    return { ok: false, retryAfterSeconds: perIp.windowSeconds };
  }
  return { ok: true };
}

export function checkRedemptionPreviewRateLimit(userId: string): RateLimitResult {
  const { perUser } = RATE_LIMITS.redemptionPreview;
  if (!checkRateLimit(`redeem-preview:user:${userId}`, perUser.limit, perUser.windowSeconds)) {
    return { ok: false, retryAfterSeconds: perUser.windowSeconds };
  }
  return { ok: true };
}
