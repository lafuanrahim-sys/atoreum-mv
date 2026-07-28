import crypto from "crypto";
import { pool } from "@/lib/db";
import type { UserRole } from "@/lib/auth/userSession";

/**
 * Postgres-backed user store (see lib/data/schema.sql) — replaces the
 * original JSON-on-disk version, which didn't persist on Vercel's
 * read-only/ephemeral serverless filesystem. Same exported functions as
 * before (now async), including the email-verification flow added earlier.
 *
 * Passwords are hashed with scrypt (Node crypto, per-user random salt).
 * Server-only: never import from client code.
 */

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // `${saltHex}:${hashHex}`
  role: UserRole;
  /** Product ids the user has favorited. */
  favorites: string[];
  /** False until the account's email verification link is clicked. */
  emailVerified: boolean;
  /** SHA-256 hash of the current outstanding verification token, never the raw token (same posture as passwordHash). Null once verified or if none has been issued. */
  verificationTokenHash: string | null;
  verificationTokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** User shape safe to hand to pages/actions (no credential material). */
export type PublicUser = Omit<User, "passwordHash">;

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  favorites: string[];
  email_verified: boolean;
  verification_token_hash: string | null;
  verification_token_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    favorites: row.favorites,
    emailVerified: row.email_verified,
    verificationTokenHash: row.verification_token_hash,
    verificationTokenExpiresAt: row.verification_token_expires_at
      ? new Date(row.verification_token_expires_at).toISOString()
      : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function sanitize(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

function hashPassword(password: string, saltHex?: string): string {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const candidate = hashPassword(password, saltHex).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hashHex, "hex"));
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24h

/** The one account that owns the store — always the super admin. */
export const SUPER_ADMIN_EMAIL = "admin@atoreum.mv";

/**
 * First run bootstraps the store with one super-admin account so the
 * dashboard is never locked out: admin@atoreum.mv, password = ADMIN_PASSWORD
 * env var (falling back to "atoreum-admin" in dev). Change it after first
 * login. Cheap idempotent check — safe to call from every exported function
 * here, same as the old readAll()'s inline bootstrap.
 */
async function ensureSeedAdmin(): Promise<void> {
  const { rows } = await pool().query<{ count: string }>("select count(*)::text as count from users");
  if (Number(rows[0]?.count ?? 0) > 0) return;

  const now = new Date().toISOString();
  await pool().query(
    `insert into users (id, name, email, password_hash, role, favorites, email_verified, created_at, updated_at)
     values ($1, $2, $3, $4, 'superadmin', '[]', true, $5, $5)
     on conflict (email) do nothing`,
    [
      `usr-${Date.now().toString(36)}`,
      "Atoreum Admin",
      SUPER_ADMIN_EMAIL,
      hashPassword(process.env.ADMIN_PASSWORD ?? "atoreum-admin"),
      now,
    ]
  );
}

export async function listUsers(): Promise<PublicUser[]> {
  await ensureSeedAdmin();
  const { rows } = await pool().query<UserRow>("select * from users order by created_at desc");
  return rows.map(rowToUser).map(sanitize);
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  await ensureSeedAdmin();
  const { rows } = await pool().query<UserRow>("select * from users where id = $1", [id]);
  return rows[0] ? sanitize(rowToUser(rows[0])) : null;
}

export async function getUserByEmail(email: string): Promise<PublicUser | null> {
  await ensureSeedAdmin();
  const normalized = email.trim().toLowerCase();
  const { rows } = await pool().query<UserRow>("select * from users where email = $1", [normalized]);
  return rows[0] ? sanitize(rowToUser(rows[0])) : null;
}

export async function createUser(params: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: PublicUser; verificationToken: string } | { error: string }> {
  await ensureSeedAdmin();
  const email = params.email.trim().toLowerCase();

  const verificationToken = generateVerificationToken();
  const id = `usr-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;

  try {
    const { rows } = await pool().query<UserRow>(
      `insert into users
        (id, name, email, password_hash, role, favorites, email_verified, verification_token_hash, verification_token_expires_at)
       values ($1, $2, $3, $4, 'customer', '[]', false, $5, $6)
       returning *`,
      [
        id,
        params.name.trim(),
        email,
        hashPassword(params.password),
        hashToken(verificationToken),
        new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS).toISOString(),
      ]
    );
    return { user: sanitize(rowToUser(rows[0])), verificationToken };
  } catch (err) {
    // 23505 = unique_violation, on the email column.
    if (err && typeof err === "object" && "code" in err && err.code === "23505") {
      return { error: "An account with this email already exists." };
    }
    throw err;
  }
}

/** Marks the account matching this raw token as verified. Consumes the token — a second click with the same link fails. */
export async function verifyEmailToken(token: string): Promise<PublicUser | { error: string }> {
  await ensureSeedAdmin();
  const hash = hashToken(token);
  const { rows } = await pool().query<UserRow>(
    `update users
     set email_verified = true, verification_token_hash = null, verification_token_expires_at = null, updated_at = now()
     where verification_token_hash = $1 and verification_token_expires_at > now()
     returning *`,
    [hash]
  );
  if (rows[0]) return sanitize(rowToUser(rows[0]));

  // Distinguish "no such token" from "token existed but expired" for a clearer message.
  const { rows: expiredRows } = await pool().query<{ id: string }>(
    "select id from users where verification_token_hash = $1",
    [hash]
  );
  if (expiredRows[0]) return { error: "This verification link has expired. Request a new one." };
  return { error: "This verification link is invalid or has already been used." };
}

/** Issues a fresh verification token for an unverified account (e.g. the original link expired or was lost) — the caller is responsible for emailing it. */
export async function issueVerificationToken(
  email: string
): Promise<{ user: PublicUser; verificationToken: string } | { error: string }> {
  await ensureSeedAdmin();
  const normalized = email.trim().toLowerCase();
  const existing = await getUserByEmail(normalized);
  if (!existing) return { error: "No account found with this email." };
  if (existing.emailVerified) return { error: "This account is already verified." };

  const verificationToken = generateVerificationToken();
  const { rows } = await pool().query<UserRow>(
    `update users
     set verification_token_hash = $2, verification_token_expires_at = $3, updated_at = now()
     where email = $1
     returning *`,
    [normalized, hashToken(verificationToken), new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS).toISOString()]
  );
  return { user: sanitize(rowToUser(rows[0])), verificationToken };
}

export async function verifyCredentials(email: string, password: string): Promise<PublicUser | null> {
  await ensureSeedAdmin();
  const normalized = email.trim().toLowerCase();
  const { rows } = await pool().query<UserRow>("select * from users where email = $1", [normalized]);
  const row = rows[0];
  if (!row) return null;
  return verifyPassword(password, row.password_hash) ? sanitize(rowToUser(row)) : null;
}

export async function updateUserName(id: string, name: string): Promise<PublicUser | null> {
  const { rows } = await pool().query<UserRow>(
    "update users set name = $2, updated_at = now() where id = $1 returning *",
    [id, name.trim()]
  );
  return rows[0] ? sanitize(rowToUser(rows[0])) : null;
}

export async function changeUserPassword(
  id: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { error: string }> {
  const { rows } = await pool().query<UserRow>("select * from users where id = $1", [id]);
  const row = rows[0];
  if (!row) return { error: "Account not found." };
  if (!verifyPassword(currentPassword, row.password_hash)) {
    return { error: "Current password is incorrect." };
  }
  await pool().query("update users set password_hash = $2, updated_at = now() where id = $1", [
    id,
    hashPassword(newPassword),
  ]);
  return { ok: true };
}

export async function setUserRole(id: string, role: UserRole): Promise<PublicUser | null> {
  // The owner account's role is pinned — nothing may promote another user to
  // superadmin or demote the existing one.
  const { rows } = await pool().query<UserRow>(
    `update users set role = $2, updated_at = now()
     where id = $1 and role <> 'superadmin' and $2 <> 'superadmin'
     returning *`,
    [id, role]
  );
  return rows[0] ? sanitize(rowToUser(rows[0])) : null;
}

export async function deleteUser(id: string): Promise<boolean> {
  // The super admin account can never be deleted.
  const { rowCount } = await pool().query("delete from users where id = $1 and role <> 'superadmin'", [id]);
  return (rowCount ?? 0) > 0;
}

export async function toggleUserFavorite(id: string, productId: string): Promise<string[] | null> {
  const { rows } = await pool().query<{ favorites: string[] }>("select favorites from users where id = $1", [id]);
  const row = rows[0];
  if (!row) return null;

  const favorites = row.favorites.includes(productId)
    ? row.favorites.filter((f) => f !== productId)
    : [...row.favorites, productId];

  await pool().query("update users set favorites = $2, updated_at = now() where id = $1", [
    id,
    JSON.stringify(favorites),
  ]);
  return favorites;
}
