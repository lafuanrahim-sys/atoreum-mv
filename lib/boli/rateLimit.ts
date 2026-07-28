import { RATE_LIMITS } from "./config";

/**
 * In-memory sliding-window rate limiter for Boli Dive's endpoints
 * (BOLI_SPEC.md §6.5). Same single-process assumption already documented
 * elsewhere in this codebase (lib/auth/userSession.ts: "no rate limiting,
 * no token revocation list... swap for a real auth solution before going
 * live") — this resets on restart and doesn't span multiple server
 * instances. BOLI-ASSUMPTION: acceptable for the same reason the existing
 * session store is: this app runs as a single Next.js instance, and the
 * numbers here are abuse-shaping, not a hard security boundary (the real
 * security boundary is the fraud/eligibility logic in dive.server.ts,
 * which doesn't depend on this file at all).
 */

type Bucket = { windowStart: number; count: number };

const buckets = new Map<string, Bucket>();

// Sweep old buckets occasionally so this map doesn't grow forever across a
// long-running process — cheap enough to do on every call.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > 3_600_000) buckets.delete(key);
  }
}

/** Returns true if this call is allowed (and records it); false if the limit is already hit. */
export function checkRateLimit(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  sweep(now);
  const windowMs = windowSeconds * 1000;
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    buckets.set(key, { windowStart: now, count: 1 });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

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

export function checkRegistrationRateLimit(ip: string): RateLimitResult {
  const { perIp } = RATE_LIMITS.registration;
  if (!checkRateLimit(`register:ip:${ip}`, perIp.limit, perIp.windowSeconds)) {
    return { ok: false, retryAfterSeconds: perIp.windowSeconds };
  }
  return { ok: true };
}
