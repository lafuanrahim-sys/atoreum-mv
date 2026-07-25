import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { UserRole } from "@/lib/auth/userSession";

/**
 * File-based user store — same approach and limitations as the products and
 * orders stores (JSON-on-disk, persistent-server only). Contains credential
 * hashes and PII, so data/users.json is gitignored and must never be served
 * from a public route.
 *
 * Passwords are hashed with scrypt (Node crypto, per-user random salt).
 * Server-only: never import from client code.
 */

const DATA_PATH = path.join(process.cwd(), "data", "users.json");

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // `${saltHex}:${hashHex}`
  role: UserRole;
  /** Product ids the user has favorited. */
  favorites: string[];
  createdAt: string;
  updatedAt: string;
};

/** User shape safe to hand to pages/actions (no credential material). */
export type PublicUser = Omit<User, "passwordHash">;

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

function sanitize(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

/** The one account that owns the store — always the super admin. */
export const SUPER_ADMIN_EMAIL = "admin@atoreum.mv";

/**
 * First run bootstraps the store with one super-admin account so the
 * dashboard is never locked out: admin@atoreum.mv, password = ADMIN_PASSWORD
 * env var (falling back to "atoreum-admin" in dev). Change it after first
 * login.
 */
function readAll(): User[] {
  if (!fs.existsSync(DATA_PATH)) {
    const now = new Date().toISOString();
    const seedAdmin: User = {
      id: `usr-${Date.now().toString(36)}`,
      name: "Atoreum Admin",
      email: SUPER_ADMIN_EMAIL,
      passwordHash: hashPassword(process.env.ADMIN_PASSWORD ?? "atoreum-admin"),
      role: "superadmin",
      favorites: [],
      createdAt: now,
      updatedAt: now,
    };
    writeAll([seedAdmin]);
  }
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  const users = JSON.parse(raw) as User[];
  // Stores created before the superadmin role: pin the owner account to it.
  return users.map((u) =>
    u.email === SUPER_ADMIN_EMAIL && u.role !== "superadmin" ? { ...u, role: "superadmin" } : u
  );
}

function writeAll(users: User[]) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(users, null, 2) + "\n", "utf-8");
}

export function listUsers(): PublicUser[] {
  return readAll()
    .map(sanitize)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getUserById(id: string): PublicUser | null {
  const user = readAll().find((u) => u.id === id);
  return user ? sanitize(user) : null;
}

export function getUserByEmail(email: string): PublicUser | null {
  const normalized = email.trim().toLowerCase();
  const user = readAll().find((u) => u.email === normalized);
  return user ? sanitize(user) : null;
}

export function createUser(params: {
  name: string;
  email: string;
  password: string;
}): PublicUser | { error: string } {
  const all = readAll();
  const email = params.email.trim().toLowerCase();
  if (all.some((u) => u.email === email)) {
    return { error: "An account with this email already exists." };
  }
  const now = new Date().toISOString();
  const user: User = {
    id: `usr-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`,
    name: params.name.trim(),
    email,
    passwordHash: hashPassword(params.password),
    role: "customer",
    favorites: [],
    createdAt: now,
    updatedAt: now,
  };
  all.push(user);
  writeAll(all);
  return sanitize(user);
}

export function verifyCredentials(email: string, password: string): PublicUser | null {
  const normalized = email.trim().toLowerCase();
  const user = readAll().find((u) => u.email === normalized);
  if (!user) return null;
  return verifyPassword(password, user.passwordHash) ? sanitize(user) : null;
}

export function updateUserName(id: string, name: string): PublicUser | null {
  const all = readAll();
  const index = all.findIndex((u) => u.id === id);
  if (index === -1) return null;
  all[index] = { ...all[index], name: name.trim(), updatedAt: new Date().toISOString() };
  writeAll(all);
  return sanitize(all[index]);
}

export function changeUserPassword(
  id: string,
  currentPassword: string,
  newPassword: string
): { ok: true } | { error: string } {
  const all = readAll();
  const index = all.findIndex((u) => u.id === id);
  if (index === -1) return { error: "Account not found." };
  if (!verifyPassword(currentPassword, all[index].passwordHash)) {
    return { error: "Current password is incorrect." };
  }
  all[index] = {
    ...all[index],
    passwordHash: hashPassword(newPassword),
    updatedAt: new Date().toISOString(),
  };
  writeAll(all);
  return { ok: true };
}

export function setUserRole(id: string, role: UserRole): PublicUser | null {
  const all = readAll();
  const index = all.findIndex((u) => u.id === id);
  if (index === -1) return null;
  // The owner account's role is pinned — nothing may promote another user to
  // superadmin or demote the existing one.
  if (all[index].role === "superadmin" || role === "superadmin") return null;
  all[index] = { ...all[index], role, updatedAt: new Date().toISOString() };
  writeAll(all);
  return sanitize(all[index]);
}

export function deleteUser(id: string): boolean {
  const all = readAll();
  const target = all.find((u) => u.id === id);
  // The super admin account can never be deleted.
  if (!target || target.role === "superadmin") return false;
  writeAll(all.filter((u) => u.id !== id));
  return true;
}

export function toggleUserFavorite(id: string, productId: string): string[] | null {
  const all = readAll();
  const index = all.findIndex((u) => u.id === id);
  if (index === -1) return null;
  const favorites = all[index].favorites.includes(productId)
    ? all[index].favorites.filter((f) => f !== productId)
    : [...all[index].favorites, productId];
  all[index] = { ...all[index], favorites, updatedAt: new Date().toISOString() };
  writeAll(all);
  return favorites;
}
