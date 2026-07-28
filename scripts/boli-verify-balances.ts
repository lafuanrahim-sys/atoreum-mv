import "./boli-env";
import { pool } from "../lib/boli/db";

/**
 * Asserts boli_users.boli_balance_cached === SUM(boli_ledger.delta) for
 * every user — the cache is only ever a materialized view of the ledger,
 * so any drift here means something wrote a balance outside the ledger
 * service (or a real bug). Run with `npm run boli:verify-balances`.
 */
async function main() {
  const db = pool();

  const { rows: users } = await db.query<{ user_id: string; boli_balance_cached: string }>(
    `select user_id, boli_balance_cached from boli_users`
  );

  let mismatches = 0;

  for (const u of users) {
    const { rows: ledgerRows } = await db.query<{ delta: string }>(
      `select delta from boli_ledger where user_id = $1`,
      [u.user_id]
    );

    const sum = ledgerRows.reduce((acc, r) => acc + BigInt(r.delta), BigInt(0));
    const cached = BigInt(u.boli_balance_cached);

    if (sum !== cached) {
      mismatches++;
      console.error(`MISMATCH user=${u.user_id} cached=${cached} sumLedger=${sum} diff=${sum - cached}`);
    }
  }

  console.log(`Checked ${users.length} user(s), ${mismatches} mismatch(es).`);
  if (mismatches > 0) process.exitCode = 1;
  await db.end();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await pool().end();
});
