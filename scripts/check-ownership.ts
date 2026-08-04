import { pool } from "@/lib/db";

async function main() {
  const me = await pool().query("select current_user, session_user");
  console.log("Connected as:", me.rows[0]);

  const owners = await pool().query(`
    select tablename, tableowner
    from pg_tables
    where schemaname = 'public'
    order by tablename
  `);
  console.log("\nTable owners:");
  for (const row of owners.rows) {
    console.log(`  ${row.tablename.padEnd(28)} owner=${row.tableowner}`);
  }

  const bypass = await pool().query(`
    select rolname, rolbypassrls, rolsuper
    from pg_roles
    where rolname = current_user
  `);
  console.log("\nRole flags:", bypass.rows[0]);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
