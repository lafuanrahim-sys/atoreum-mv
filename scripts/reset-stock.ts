import { pool } from "@/lib/db";

/**
 * One-off: zero out every product's on-hand count and flip its status to
 * out-of-stock, so Add to Cart actually disables everywhere (stockStatus,
 * not stockOnHand, is what AddToCartButton checks) rather than just
 * showing a stale "0" in the admin dashboard while the storefront still
 * lets people buy. Run once per environment via:
 *   npx tsx --env-file=.env.local scripts/reset-stock.ts
 *   npx tsx --env-file=.env.production.local scripts/reset-stock.ts
 */
async function main() {
  const db = pool();
  const before = await db.query<{ id: string; name: string; stock_on_hand: number; stock_status: string }>(
    "select id, name, stock_on_hand, stock_status from products order by id"
  );

  const result = await db.query(
    "update products set stock_status = 'out-of-stock', stock_on_hand = 0, updated_at = now()"
  );

  console.log(`Updated ${result.rowCount} product(s).`);
  console.log("\nBefore:");
  for (const row of before.rows) {
    console.log(`  ${row.id.padEnd(10)} ${row.stock_status.padEnd(14)} on_hand=${row.stock_on_hand}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
