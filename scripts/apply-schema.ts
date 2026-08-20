import fs from "node:fs";
import { pool } from "@/lib/db";

/**
 * Re-applies both schema files. Idempotent (create-or-replace / if-not-exists
 * / enable row level security all tolerate re-running), so this is safe to
 * use any time the schema files change, not just once.
 */
async function main() {
  const db = pool();
  // Vouchers last: voucher_expire() calls boli_ledger_write(), so the Boli
  // schema has to exist first.
  // chat last: it stands alone, depending on nothing above it.
  for (const file of ["lib/data/schema.sql", "lib/boli/schema.sql", "lib/vouchers/schema.sql", "lib/chat/schema.sql", "lib/data/invoicing.sql"]) {
    console.log(`Applying ${file}...`);
    await db.query(fs.readFileSync(file, "utf8"));
    console.log(`  done.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
