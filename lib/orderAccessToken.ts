import crypto from "crypto";

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not set. Add it to .env.local (any long random string).");
  }
  return secret;
}

/**
 * Unguessable per-order access token for the post-checkout confirmation page
 * (app/order-confirmation/[id]/page.tsx) -- lets a guest (no account) view
 * the order they just placed via the redirect URL, without the order id
 * itself (also its DB primary key -- short, sequential-ish, never meant to
 * be secret) functioning as a bearer credential. Derived deterministically
 * via HMAC rather than stored, domain-separated (the "order-access:" prefix)
 * from the session-cookie signing in lib/auth/userSession.ts, which reuses
 * the same base secret for a different purpose.
 */
export function orderAccessToken(orderId: string): string {
  return crypto.createHmac("sha256", getSecret()).update(`order-access:${orderId}`).digest("hex").slice(0, 32);
}

export function verifyOrderAccessToken(orderId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expectedBuf = Buffer.from(orderAccessToken(orderId));
  const givenBuf = Buffer.from(token);
  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}
