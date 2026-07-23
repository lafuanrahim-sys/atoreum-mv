/**
 * Unified session for customers AND admins — one signed cookie, with the
 * user's id and role in the payload, replacing the old shared-password
 * admin-only session (lib/auth/adminSession.ts, now removed).
 *
 * Same constraints as before: this file is imported by middleware.ts, which
 * runs on the Edge Runtime, so it uses the Web Crypto API only (no Node
 * `crypto`, no fs) — password hashing and user lookup live separately in
 * lib/data/users.server.ts, which is Node-only.
 *
 * ⚠️ Same production caveat as the store it replaces: no rate limiting, no
 * token revocation list. Swap for a real auth solution before going live.
 */

const COOKIE_NAME = "atoreum_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export type UserRole = "customer" | "admin";

export type SessionPayload = {
  userId: string;
  role: UserRole;
};

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

/** Build a signed cookie value: `<userId>:<role>:<expiryEpochMs>.<hmac>`. */
export async function createUserSessionToken(userId: string, role: UserRole): Promise<string> {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}:${role}:${expiry}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyUserSessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const payload = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  if (!payload || !signature) return null;

  const expected = await sign(payload);
  if (!timingSafeEqualStr(signature, expected)) return null;

  const [userId, role, expiryStr] = payload.split(":");
  const expiry = Number(expiryStr);
  if (!userId || (role !== "customer" && role !== "admin")) return null;
  if (!Number.isFinite(expiry) || Date.now() >= expiry) return null;

  return { userId, role };
}

export const USER_SESSION_COOKIE = COOKIE_NAME;
export const USER_SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;
