import { checkRateLimit, type RateLimitResult } from "@/lib/rateLimit";

/**
 * Abuse-shaping for the auth flows in app/actions/auth.ts. Same in-memory,
 * single-process caveat as lib/boli/rateLimit.ts — these are throttles, not
 * a hard security boundary (scrypt password hashing is the real cost on the
 * login path; this just keeps a sustained guess/spam loop from being free).
 */

/** Checks both per-email and per-IP limits for a login attempt; either breach blocks it. Keyed on the *attempted* email (not a real account id) so a bad guess still counts against that target. */
export function checkLoginRateLimit(email: string, ip: string): RateLimitResult {
  if (!checkRateLimit(`login:email:${email.toLowerCase()}`, 8, 300)) {
    return { ok: false, retryAfterSeconds: 300 };
  }
  if (!checkRateLimit(`login:ip:${ip}`, 30, 900)) {
    return { ok: false, retryAfterSeconds: 900 };
  }
  return { ok: true };
}

export function checkRegistrationRateLimit(ip: string): RateLimitResult {
  if (!checkRateLimit(`register:ip:${ip}`, 5, 3600)) {
    return { ok: false, retryAfterSeconds: 3600 };
  }
  return { ok: true };
}

/** Verification-email resend can be spammed at an arbitrary victim's inbox with no auth and no other throttle — cap it per target email regardless of who's requesting it. */
export function checkResendVerificationRateLimit(email: string): RateLimitResult {
  if (!checkRateLimit(`resend-verify:email:${email.toLowerCase()}`, 3, 600)) {
    return { ok: false, retryAfterSeconds: 600 };
  }
  return { ok: true };
}
