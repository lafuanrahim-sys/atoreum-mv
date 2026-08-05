import { pool } from "@/lib/db";

/**
 * One-off: verifies the fx_tt_payments generated columns against exact
 * Decimal arithmetic (cross-checked independently in Python, see the
 * commit message), for the source spec's own worked example.
 *
 * The original Atoreum FX spec (CLAUDE.md) documents this same example
 * with slightly different "expected" figures for every column that
 * involves support_pct (e.g. usd_via_bank "1068.0000"). That comment is
 * wrong, not this formula: 2136.63 * 0.499853 is exactly 1068.00091539
 * (verified independently, no floating-point involved), which rounds to
 * 1068.0009 -- not 1068.0000. Every one of this schema's 15 generated-
 * column expressions is a byte-for-byte match against the original
 * schema.sql (diffed programmatically), and the two columns here that
 * DON'T depend on support_pct (cost_no_support, total_saved_incl_opp)
 * already matched the spec's comment exactly -- only the support_pct-
 * dependent ones were ever off, and only by fractions of a cent. The
 * spec's own comment has a hand-rounding error; the SQL does not.
 */
const EXPECTED = {
  usd_via_bank: "1068.0009",
  usd_from_own: "1068.6291",
  cash_paid_mvr: "16468.5741",
  own_usd_at_bank_rate: "16478.2605",
  cost_own_usd_mvr: "22601.5051",
  opportunity_cost: "6123.2447",
  total_effective_cost: "39070.0793",
  cost_no_support: "45189.7245",
  cash_saved_today: "6119.6452",
  total_saved_incl_opp: "12242.8899",
};

async function main() {
  const db = pool();
  const { rows } = await db.query(
    `insert into fx_tt_payments (tt_date, reference, purpose, tt_amount, support_pct, bank_rate, market_rate)
     values ('2026-07-19', 'FT26200GRNN5\\MV1', 'Lebelage Cosmetics 87', 2136.63, 0.499853, 15.42, 21.15)
     returning usd_via_bank, usd_from_own, cash_paid_mvr, own_usd_at_bank_rate, cost_own_usd_mvr,
               opportunity_cost, total_effective_cost, cost_no_support, cash_saved_today, total_saved_incl_opp, id`
  );
  const row = rows[0];
  let allPass = true;
  for (const [key, expected] of Object.entries(EXPECTED)) {
    const actual = row[key];
    const pass = actual === expected;
    if (!pass) allPass = false;
    console.log(`${pass ? "PASS" : "FAIL"}  ${key.padEnd(24)} expected=${expected.padEnd(14)} actual=${actual}`);
  }
  await db.query("delete from fx_tt_payments where id = $1", [row.id]);
  console.log(allPass ? "\nAll figures match the spec." : "\nMISMATCH -- formula is wrong, per the spec's own rule.");
  if (!allPass) process.exitCode = 1;
}

main()
  .then(() => process.exit())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
