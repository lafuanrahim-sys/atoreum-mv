/**
 * In-memory sliding-window rate limiter, shared by any feature that needs
 * simple abuse-shaping (login, registration, Boli Dive, ...). Single-process
 * only — resets on restart, doesn't span multiple serverless instances (see
 * lib/auth/userSession.ts's own caveat on the same limitation). Acceptable
 * here because every caller treats this as abuse-shaping, not a hard
 * security boundary — the real boundaries (password hashing, server-side
 * eligibility checks, etc.) don't depend on this file at all.
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
