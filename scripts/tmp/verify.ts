import { pool } from "@/lib/db";
async function main() {
  const o = (await pool().query(
    `select id, order_number, invoice_seq, status, subtotal, customer->>'name' name from orders order by created_at desc limit 3`)).rows;
  console.log("orders on production:"); console.table(o);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
