import { Pool } from "pg";

/**
 * Shared server-only Postgres connection pool — used by both lib/data/*
 * .server.ts (the storefront's own tables, see lib/data/schema.sql) and
 * lib/boli/db.ts (which re-exports this for its existing call sites,
 * see lib/boli/schema.sql). One pool, one DATABASE_URL, two schemas in the
 * same database. Connects directly via the Postgres wire protocol (the `pg`
 * driver) rather than through Supabase's PostgREST layer — DATABASE_URL
 * works identically whether it points at a local Postgres instance or a
 * hosted Supabase project's own connection string (Supabase Dashboard ->
 * Project Settings -> Database -> Connection string).
 *
 * Never import this from a "use client" file — DATABASE_URL carries full
 * database credentials and must never reach the browser.
 */

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. See .env.example for setup.`);
  }
  return value;
}

let cached: Pool | null = null;

export function pool(): Pool {
  if (cached) return cached;
  cached = new Pool({ connectionString: getEnv("DATABASE_URL") });
  return cached;
}
