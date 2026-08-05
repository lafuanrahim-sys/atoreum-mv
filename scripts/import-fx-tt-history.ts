import { pool } from "@/lib/db";

/**
 * One-off: imports the one real TT payment from
 * Atoreum_Dollar_FX_Tracker.xlsx's "TT Bank Support Log" sheet (row 5) --
 * its own Notes column called it an "Example row", but confirmed with the
 * store owner that it's a real transfer (FT26200GRNN5\MV1, Lebelage
 * Cosmetics 87), not synthetic test data. The note isn't carried over into
 * the real ledger since it would misleadingly suggest this row is fake.
 *
 * Same generated-column figures already verified twice this session
 * (against the spec's own worked example, and independently in Python's
 * Decimal): usd_via_bank 1068.0009, cash_paid_mvr 16468.5741,
 * total_saved_incl_opp 12242.8899.
 */
const CREATED_BY = "Imported from Atoreum_Dollar_FX_Tracker.xlsx";

async function main() {
  const db = pool();

  const existing = await db.query("select count(*) from fx_tt_payments where created_by = $1", [CREATED_BY]);
  if (Number(existing.rows[0].count) > 0) {
    console.log(`Already imported (${existing.rows[0].count} row(s) with this created_by tag) -- skipping.`);
    return;
  }

  const { rows } = await db.query(
    `insert into fx_tt_payments
       (tt_date, reference, purpose, tt_amount, support_pct, bank_rate, market_rate, notes, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    ["2026-07-19", "FT26200GRNN5\\MV1", "Lebelage Cosmetics 87", 2136.63, 0.499853, 15.42, 21.15, "", CREATED_BY]
  );
  const row = rows[0];
  console.log("Inserted TT payment:", row.reference);

  const expected = {
    usd_via_bank: "1068.0009",
    usd_from_own: "1068.6291",
    cash_paid_mvr: "16468.5741",
    total_saved_incl_opp: "12242.8899",
  };
  let allPass = true;
  for (const [key, exp] of Object.entries(expected)) {
    const actual = row[key];
    const pass = actual === exp;
    if (!pass) allPass = false;
    console.log(`${pass ? "PASS" : "FAIL"}  ${key.padEnd(22)} expected=${exp.padEnd(12)} actual=${actual}`);
  }
  if (!allPass) {
    console.log("\nMISMATCH -- investigate before trusting this import.");
    process.exitCode = 1;
  } else {
    console.log("\nMatches the verified figures exactly.");
  }
}

main()
  .then(() => process.exit())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
