import { pool } from "@/lib/db";

/**
 * One-off: imports the real purchase history from
 * public/Atoreum_Dollar_FX_Tracker.xlsx's "Dollar Exchange Log" sheet
 * (rows 5-19, the sheet's own TOTALS row confirms 6,110.75 USD / 121,515
 * MVR across all 15 -- matches exactly). The TT sheet's one row is
 * explicitly marked in its own Notes column "Example row -- overwrite or
 * delete before real use", so it's deliberately NOT imported here -- it
 * isn't a real transaction, the workbook itself says so.
 *
 * Only the actual input columns are inserted; mvr_paid, profit_vs_ceiling,
 * etc. are Postgres generated columns, computed the same way this script
 * verifies them below (should exactly match the workbook's own formula
 * results in every row).
 */
const ROWS: {
  tradeDate: string;
  counterparty: string;
  usdAmount: number;
  buyRate: number;
  marketRate: number;
  ceilingRate: number;
  notes: string;
}[] = [
  { tradeDate: "2026-06-28", counterparty: "Aishath Shauraan Ibrahim", usdAmount: 500, buyRate: 19, marketRate: 20.5, ceilingRate: 20, notes: "SOLD" },
  { tradeDate: "2026-06-30", counterparty: "Mohamed Janaan Ahmed", usdAmount: 350, buyRate: 20, marketRate: 20.5, ceilingRate: 20, notes: "" },
  { tradeDate: "2026-07-01", counterparty: "Ahmed Zayan", usdAmount: 500, buyRate: 20, marketRate: 20.5, ceilingRate: 20, notes: "" },
  { tradeDate: "2026-07-01", counterparty: "Mariyam Nadha Naeem", usdAmount: 1500, buyRate: 20, marketRate: 20.5, ceilingRate: 20, notes: "" },
  { tradeDate: "2026-07-02", counterparty: "Ibrahim Naufal", usdAmount: 130, buyRate: 20, marketRate: 20.5, ceilingRate: 20, notes: "" },
  { tradeDate: "2026-07-04", counterparty: "Athif Ali", usdAmount: 200, buyRate: 19, marketRate: 20.5, ceilingRate: 20, notes: "" },
  { tradeDate: "2026-07-05", counterparty: "Athif Ali", usdAmount: 400, buyRate: 20, marketRate: 20.55, ceilingRate: 20, notes: "" },
  { tradeDate: "2026-07-08", counterparty: "Mohamed Janaan Ahmed", usdAmount: 500, buyRate: 20, marketRate: 20.7, ceilingRate: 20, notes: "" },
  { tradeDate: "2026-07-16", counterparty: "Ahmed Zayan", usdAmount: 100, buyRate: 20, marketRate: 21, ceilingRate: 20, notes: "" },
  { tradeDate: "2026-07-20", counterparty: "Ahmed Zayan", usdAmount: 300, buyRate: 20, marketRate: 21.2, ceilingRate: 20, notes: "" },
  { tradeDate: "2026-08-01", counterparty: "Ahmed Zayan", usdAmount: 100, buyRate: 20, marketRate: 21.55, ceilingRate: 20, notes: "" },
  { tradeDate: "2026-08-01", counterparty: "Ahmed Zayan", usdAmount: 200, buyRate: 20, marketRate: 21.55, ceilingRate: 20, notes: "" },
  { tradeDate: "2026-08-01", counterparty: "Ibrahim Naufal", usdAmount: 30.75, buyRate: 20, marketRate: 21.55, ceilingRate: 20, notes: "" },
  { tradeDate: "2026-08-02", counterparty: "Mohamed Janaan Ahmed", usdAmount: 1000, buyRate: 20, marketRate: 21.55, ceilingRate: 20, notes: "" },
  { tradeDate: "2026-08-03", counterparty: "Aishath Shauraan Ibrahim", usdAmount: 300, buyRate: 20, marketRate: 21.6, ceilingRate: 20, notes: "" },
];

// The workbook's own TOTALS row, for a before/after sanity check.
const EXPECTED_TOTALS = { usdBought: 6110.75, mvrPaid: 121515, profitVsCeiling: 700, profitVsMarket: 5862.6625 };

const CREATED_BY = "Imported from Atoreum_Dollar_FX_Tracker.xlsx";

async function main() {
  const db = pool();

  const existing = await db.query("select count(*) from fx_exchanges where created_by = $1", [CREATED_BY]);
  if (Number(existing.rows[0].count) > 0) {
    console.log(`Already imported (${existing.rows[0].count} rows with this created_by tag) -- skipping to avoid duplicates.`);
    return;
  }

  for (const row of ROWS) {
    await db.query(
      `insert into fx_exchanges
         (trade_date, counterparty, usd_amount, buy_rate, market_rate, ceiling_rate, notes, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [row.tradeDate, row.counterparty, row.usdAmount, row.buyRate, row.marketRate, row.ceilingRate, row.notes, CREATED_BY]
    );
  }
  console.log(`Inserted ${ROWS.length} exchange rows.`);

  const totals = await db.query(
    `select
       coalesce(sum(usd_amount), 0) as usd_bought,
       coalesce(sum(mvr_paid), 0) as mvr_paid,
       coalesce(sum(profit_vs_ceiling), 0) as profit_vs_ceiling,
       coalesce(sum(unrealized_vs_market), 0) as profit_vs_market
     from fx_exchanges where created_by = $1`,
    [CREATED_BY]
  );
  const t = totals.rows[0];
  console.log("\nComputed totals vs. the workbook's own TOTALS row:");
  console.log(`  USD bought:        ${t.usd_bought} (expected ${EXPECTED_TOTALS.usdBought})`);
  console.log(`  MVR paid:          ${t.mvr_paid} (expected ${EXPECTED_TOTALS.mvrPaid})`);
  console.log(`  Profit vs ceiling: ${t.profit_vs_ceiling} (expected ${EXPECTED_TOTALS.profitVsCeiling})`);
  console.log(`  Profit vs market:  ${t.profit_vs_market} (expected ${EXPECTED_TOTALS.profitVsMarket})`);

  const mismatch =
    Number(t.usd_bought) !== EXPECTED_TOTALS.usdBought ||
    Number(t.mvr_paid) !== EXPECTED_TOTALS.mvrPaid ||
    Number(t.profit_vs_ceiling) !== EXPECTED_TOTALS.profitVsCeiling ||
    Math.abs(Number(t.profit_vs_market) - EXPECTED_TOTALS.profitVsMarket) > 0.01;
  if (mismatch) {
    console.log("\nMISMATCH against the workbook's own totals -- investigate before trusting this import.");
    process.exitCode = 1;
  } else {
    console.log("\nMatches the workbook exactly.");
  }
}

main()
  .then(() => process.exit())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
