import { Pool } from "pg";

/**
 * Server-only Postgres connection pool for the Boli ledger — the only part
 * of this codebase backed by a real database (everything else is
 * JSON-on-disk, see lib/data/*.server.ts). Connects directly via the
 * Postgres wire protocol (the `pg` driver) rather than through Supabase's
 * PostgREST layer. DATABASE_URL works identically whether it points at a
 * local Postgres instance or a hosted Supabase project's own Postgres
 * connection string (Supabase Dashboard -> Project Settings -> Database ->
 * Connection string, "Direct connection" or "Session pooler") — Supabase
 * IS Postgres underneath, and connecting to it directly is a normal,
 * supported way to use it for exactly this kind of transactional,
 * lock-heavy backend logic.
 *
 * Never import this from a "use client" file — DATABASE_URL carries full
 * database credentials and must never reach the browser.
 */

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Boli needs a Postgres database — see docs/BOLI_SPEC.md and .env.example for setup.`
    );
  }
  return value;
}

let cached: Pool | null = null;

export function pool(): Pool {
  if (cached) return cached;
  cached = new Pool({ connectionString: getEnv("DATABASE_URL") });
  return cached;
}
