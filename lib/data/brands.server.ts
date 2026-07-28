import { pool } from "@/lib/db";

/**
 * Postgres-backed brand list (see lib/data/schema.sql) — replaces the
 * original JSON-on-disk version, which didn't persist on Vercel's
 * read-only/ephemeral serverless filesystem. Same exported functions as
 * before (now async).
 *
 * The set of brands the product form's dropdown offers, manageable from
 * Dashboard → Settings.
 */

const SEED_BRANDS = [
  "Lebelage",
  "ANUA",
  "Beauty of Joseon",
  "COSRX",
  "THE WHOO",
  "SULWHASOO",
  "SEOUL 1998",
  "Skin 1004",
];

async function ensureSeeded(): Promise<void> {
  const { rows } = await pool().query<{ count: string }>("select count(*)::text as count from brands");
  if (Number(rows[0]?.count ?? 0) > 0) return;
  for (const name of SEED_BRANDS) {
    await pool().query("insert into brands (name) values ($1) on conflict (name) do nothing", [name]);
  }
}

export async function listBrands(): Promise<string[]> {
  await ensureSeeded();
  const { rows } = await pool().query<{ name: string }>("select name from brands order by name asc");
  return rows.map((r) => r.name);
}

export async function addBrand(name: string): Promise<string[] | { error: string }> {
  await ensureSeeded();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Brand name is required." };
  // Case-insensitive check (matches the original JSON-store behavior) — the
  // `name` primary key alone is case-sensitive, so "COSRX" and "cosrx"
  // wouldn't collide on the constraint alone.
  const { rows } = await pool().query<{ exists: boolean }>(
    "select exists(select 1 from brands where lower(name) = lower($1)) as exists",
    [trimmed]
  );
  if (rows[0]?.exists) return { error: "That brand already exists." };
  await pool().query("insert into brands (name) values ($1)", [trimmed]);
  return listBrands();
}

export async function removeBrand(name: string): Promise<string[]> {
  await pool().query("delete from brands where name = $1", [name]);
  return listBrands();
}
