import fs from "node:fs";
import { pool } from "@/lib/db";

/**
 * Applies ONLY lib/chat/schema.sql.
 *
 * scripts/apply-schema.ts re-applies every schema file in the project, which
 * is the right tool locally and the wrong one to point at production: it
 * touches orders, Sangu and vouchers to install a feature that needs none of
 * them. This applies the chat tables and nothing else, so the blast radius
 * matches the intent.
 *
 * Idempotent -- create table if not exists, create or replace function,
 * add column if not exists -- so running it twice is harmless.
 *
 *   npx vercel env pull .env.production.local --environment=production
 *   npx tsx -r dotenv/config scripts/apply-chat-schema.ts dotenv_config_path=.env.production.local
 *
 * Delete .env.production.local afterwards; it holds every production secret.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See the comment above for how to load it.");

  // Say which database is about to be changed. Applying the wrong schema to
  // the wrong database is the kind of mistake that is obvious only afterwards.
  const host = url.replace(/^.*@/, "").replace(/[:/].*$/, "");
  console.log(`Applying lib/chat/schema.sql to ${host} ...`);

  await pool().query(fs.readFileSync("lib/chat/schema.sql", "utf8"));

  const { rows } = await pool().query(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_name like 'chat_%'
      order by table_name`
  );
  console.log(`  done. chat tables present: ${rows.map((r) => r.table_name).join(", ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
