/**
 * Minimal admin auth: a single shared password (ADMIN_PASSWORD env var)
 * grants a signed, expiring session cookie. No user accounts, no
 * roles/permissions, no rate limiting, no password hashing library.
 *
 * ⚠️ JUDGMENT CALL — FLAGGED FOR REVIEW: this is intentionally the simplest
 * thing that works, per the brief ("basic login... flag that a more robust
 * auth system should replace this before going live"). Before this admin
 * panel touches real orders/payment data in production, replace this with
 * a real auth solution (e.g. Auth.js/NextAuth, Clerk, or at minimum
 * per-admin hashed credentials + rate limiting on the login route).
 *
 * Uses the Web Crypto API (globalThis.crypto.subtle) rather than Node's
 * `crypto` module because this file is imported by middleware.ts, which
 * runs on the Edge Runtime — Node's `crypto` module throws there.
 */

const COOKIE_NAME = "atoreum_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "ADMIN_SESSION_SECRET is not set. Add it to .env.local (any long random string)."
    );
  }
  return secret;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(value: string): Promise<string> {
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bufferToHex(sig);
}

/** Build a signed cookie value: `<expiryEpochMs>.<hmac>`. */
export async function createSessionToken(): Promise<string> {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = String(expiry);
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = await sign(payload);
  if (!timingSafeEqualStr(signature, expected)) return false;

  const expiry = Number(payload);
  return Number.isFinite(expiry) && Date.now() < expiry;
}

export function verifyPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("ADMIN_PASSWORD is not set. Add it to .env.local.");
  }
  return timingSafeEqualStr(candidate, expected);
}

export const ADMIN_SESSION_COOKIE = COOKIE_NAME;
export const ADMIN_SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;
