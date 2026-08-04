import { pool } from "@/lib/db";

async function main() {
  const rows = await pool().query(`
    select p.oid, pg_get_function_identity_arguments(p.oid) as args, p.proconfig
    from pg_proc p
    where p.proname = 'boli_dive_play'
  `);
  for (const r of rows.rows) {
    console.log(`oid=${r.oid}`);
    console.log(`  args: ${r.args}`);
    console.log(`  config: ${JSON.stringify(r.proconfig)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
