import { pool } from "@/lib/db";

const TABLES = [
  "products", "orders", "users", "reviews", "brands", "messages", "store_settings",
  "boli_users", "boli_ledger", "boli_dive_plays", "boli_daily_game_budget",
  "boli_streaks", "boli_redemptions", "boli_fraud_flags", "boli_runtime_config",
];

async function main() {
  const rows = await pool().query(
    `select relname, relrowsecurity from pg_class where relname = any($1) order by relname`,
    [TABLES]
  );
  const missing = TABLES.filter((t) => !rows.rows.some((r) => r.relname === t));
  for (const r of rows.rows) {
    console.log(`${r.relname.padEnd(28)} rls=${r.relrowsecurity}`);
  }
  if (missing.length) console.log("NOT FOUND (table missing?):", missing);

  const views = await pool().query(
    `select c.relname, opt.option_name, opt.option_value
     from pg_class c
     cross join lateral pg_options_to_table(c.reloptions) opt
     where c.relname in ('boli_supply', 'boli_supply_by_source')`
  );
  console.log("\nView options:", views.rows);

  const funcs = await pool().query(
    `select p.proname, p.proconfig
     from pg_proc p
     where p.proname in ('boli_ledger_write','boli_spendable_lots','boli_redeem','boli_expire_user','boli_dive_play')
     order by p.proname`
  );
  console.log("\nFunction search_path config:");
  for (const f of funcs.rows) console.log(` ${f.proname}: ${JSON.stringify(f.proconfig)}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
