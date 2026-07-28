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
  cached = new Pool({
    connectionString: getEnv("DATABASE_URL"),
    // `pg`'s own default (max: 10) assumes one long-lived server process
    // handling many concurrent requests through a single pool — the
    // opposite of Vercel's model, where each invocation can get its own
    // fresh serverless instance (and therefore its own fresh Pool, since
    // `cached` only survives for that instance's lifetime). A burst of N
    // concurrent cold starts each opening up to 10 connections adds up
    // fast against Supabase's connection cap (60 here) — a handful of
    // simultaneous requests were enough to occasionally exhaust it and
    // 500 an unlucky page. A serverless instance genuinely only needs a
    // couple of connections at once (this app's heaviest page does 4
    // parallel queries via Promise.all), and connecting through the
    // Session pooler (see .env.example) already multiplexes across
    // instances at the PgBouncer layer, so a small per-instance cap here
    // is the right layer to constrain — not the only one, but the
    // cheapest and most direct fix for this specific failure mode.
    max: 3,
    // Release idle connections back to the pooler quickly rather than
    // holding them open for a serverless instance that may not see
    // another request before it's recycled anyway.
    idleTimeoutMillis: 10_000,
  });
  return cached;
}
