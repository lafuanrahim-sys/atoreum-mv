import fs from "node:fs";
import { Pool } from "pg";

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
 *   npx tsx scripts/apply-chat-schema.ts --env-file .env.production.local
 *
 * Add --check to parse and report without connecting or changing anything.
 * Delete .env.production.local afterwards; it holds every production secret.
 */

/**
 * Reads one value out of a .env file.
 *
 * Deliberately not dotenv. Vercel writes values quoted, and a Postgres
 * password routinely contains "#", which dotenv treats as the start of a
 * comment on an unquoted line -- silently truncating the connection string to
 * its scheme and leaving a DNS error about a nonexistent host to explain it.
 * This reads the line whole and strips quotes if present, which is all the
 * format actually requires.
 */
function readEnvValue(file: string, key: string): string | null {
  if (!fs.existsSync(file)) throw new Error(`No such file: ${file}`);

  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;
    if (line.slice(0, eq).trim() !== key) continue;

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  const fileFlag = argv.indexOf("--env-file");
  const envFile = fileFlag !== -1 ? argv[fileFlag + 1] : null;
  const checkOnly = argv.includes("--check");

  const url = envFile ? readEnvValue(envFile, "DATABASE_URL") : process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      envFile
        ? `DATABASE_URL not found in ${envFile}.`
        : "DATABASE_URL is not set. Pass --env-file <path>, or set it in the environment."
    );
  }

  // Parsed with URL rather than a regex: the failure this most needs to catch
  // is a malformed connection string, and a regex will happily report a
  // plausible-looking host from one. The password is never printed.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `DATABASE_URL is not a valid connection string (${url.length} chars, starts "${url.slice(0, 11)}").\n` +
        `  Expected postgresql://user:password@host:port/database`
    );
  }

  console.log(`  host:     ${parsed.hostname}`);
  console.log(`  port:     ${parsed.port || "(default)"}`);
  console.log(`  database: ${parsed.pathname.replace(/^\//, "") || "(none)"}`);
  console.log(`  user:     ${parsed.username || "(none)"}`);

  const looksLocal =
    parsed.hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname);
  if (!parsed.hostname || (!looksLocal && !parsed.hostname.includes("."))) {
    throw new Error(
      `That host does not look real. A password containing @ : / or # splits the URL in the ` +
        `wrong place; those must be percent-encoded (@ becomes %40, # becomes %23).`
    );
  }

  if (checkOnly) {
    console.log("  --check: parsed only, nothing applied.");
    return;
  }

  // Its own pool rather than lib/db's, which reads process.env at import time
  // and would need the very value this script exists to load correctly.
  const pool = new Pool({
    connectionString: url,
    ssl: looksLocal ? undefined : { rejectUnauthorized: false },
  });

  console.log("Applying lib/chat/schema.sql ...");
  await pool.query(fs.readFileSync("lib/chat/schema.sql", "utf8"));

  const { rows } = await pool.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_name like 'chat_%'
      order by table_name`
  );
  const { rows: fns } = await pool.query(
    `select routine_name from information_schema.routines
      where routine_schema = 'public' and routine_name like 'chat_%'
      order by routine_name`
  );

  console.log(`  tables:    ${rows.map((r) => r.table_name).join(", ") || "(none)"}`);
  console.log(`  functions: ${fns.map((r) => r.routine_name).join(", ") || "(none)"}`);
  await pool.end();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
