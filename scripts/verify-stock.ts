import { pool } from "@/lib/db";

async function main() {
  const byStatus = await pool().query("select stock_status, count(*) from products group by stock_status");
  console.log("By status:", byStatus.rows);
  const nonzero = await pool().query("select count(*) from products where stock_on_hand <> 0");
  console.log("Nonzero on_hand count:", nonzero.rows[0].count);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
