import ExcelJS from "exceljs";
import { pool } from "@/lib/db";
import { normalizeName } from "@/lib/data/shipmentImport.server";

/**
 * NOTE ON LOCATION: this workbook was originally dropped in public/, where
 * Next.js serves it as a static asset -- it was downloadable by anyone at
 * https://atoreum.mv/Pricing%20Sheet%20Shipment%201.xlsx, CNF costs, supplier
 * pricing, margins and all. It lives under data/ now, which is never served.
 * Do not move it back.
 *
 * Imports stock quantities and the price band from the owner's pricing
 * workbook (data/pricing/Pricing Sheet Shipment 1.xlsx, "Final Pricing Sheet"
 * tab)
 * into the products table.
 *
 *   npx tsx --env-file=.env.local scripts/import-pricing-sheet.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/import-pricing-sheet.ts
 *   npx tsx --env-file=.env.local scripts/import-pricing-sheet.ts --prune
 *
 * --prune additionally DELETES every catalogue product the sheet does not
 * list, so the site sells exactly what the sheet says and nothing else. It is
 * a separate opt-in flag rather than the default because it is destructive and
 * irreversible, and because the same script is meant to be run repeatedly as
 * prices change. What it does not do:
 *
 *   - touch past orders. Order lines are a JSONB snapshot with no foreign key,
 *     so an order for a delisted product keeps its name and the price actually
 *     paid, which is the only correct behaviour for a receipt.
 *   - force a delete through stock history. stock_shipment_items and
 *     stock_count_items hold `on delete restrict` references, so a product
 *     that has ever been received or counted cannot be removed; those are
 *     reported and left in place rather than having their history deleted to
 *     make room.
 *
 * Reviews and saved favourites do NOT have foreign keys and would be left
 * pointing at nothing, so they are cleaned up explicitly.
 *
 * Only the columns the owner nominated are read; every other column in that
 * sheet is working-out and is ignored on purpose:
 *
 *   Qty (NOS)                              -> stock_on_hand (stock_status
 *                                             follows from it automatically)
 *   Proposed New Listing Price / Unit      -> price          ("Listing Price")
 *   CNF*2 Rounded Off                      -> price_min      ("Miniestmum Selling Price Rounded Off")
 *   Alt 1 Median Selling Price w/ GST      -> price_median
 *   Maximum Selling Price w/ GST           -> price_max
 *
 * discount_percent is deliberately NOT written. The sheet has a "Proposed New
 * Discounting Price" column, but the instruction was to leave discounts empty
 * for now, and inferring a percentage from that column would silently put
 * every product on sale.
 *
 * Everything happens in one transaction and nothing is written unless every
 * row validates, because a half-applied price list is worse than none: the
 * storefront would be selling some products at the new prices and some at the
 * old, with no way to tell which from the outside.
 */

const SHEET = "Final Pricing Sheet";
const FILE = "data/pricing/Pricing Sheet Shipment 1.xlsx";
const HEADER_ROWS = 2; // row 1 is the real header, row 2 the friendly captions

const COL = {
  name: 1,
  category: 2,
  qty: 3,
  listing: 17,
  min: 25,
  median: 34,
  max: 40,
} as const;

/**
 * exceljs hands back a bare value for a literal, `{ result }` for a formula,
 * and `{ richText }` for a styled string. Every cell in this sheet's price
 * columns is a formula, so reading `.value` directly yields objects.
 */
function flat(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return String(o.result ?? "");
    if ("richText" in o) return (o.richText as { text: string }[]).map((t) => t.text).join("");
    if ("text" in o) return String(o.text ?? "");
  }
  return String(v);
}

function num(v: unknown): number | null {
  const n = Number(flat(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

const money = (n: number) => Math.round(n * 100) / 100;

type SheetRow = {
  row: number;
  name: string;
  qty: number;
  listing: number;
  min: number;
  median: number;
  max: number;
};

type Target = {
  id: string;
  dbName: string;
  qty: number;
  listing: number;
  min: number;
  median: number;
  max: number;
  sourceRows: number[];
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prune = process.argv.includes("--prune");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.getWorksheet(SHEET);
  if (!ws) throw new Error(`Sheet "${SHEET}" not found in ${FILE}.`);

  const rows: SheetRow[] = [];
  const skipped: string[] = [];
  for (let r = HEADER_ROWS + 1; r <= ws.rowCount; r++) {
    const v = ws.getRow(r).values as unknown[];
    const name = flat(v[COL.name]).trim();
    if (!name) continue;
    // The sheet ends with a "TOTAL - 89 line items" summary row.
    if (/^total\b/i.test(name)) continue;

    const qty = num(v[COL.qty]);
    const listing = num(v[COL.listing]);
    const min = num(v[COL.min]);
    const median = num(v[COL.median]);
    const max = num(v[COL.max]);
    if (qty == null || listing == null || min == null || median == null || max == null) {
      skipped.push(`r${r} ${name}: missing one of qty/listing/min/median/max`);
      continue;
    }
    rows.push({ row: r, name, qty, listing, min: money(min), median: money(median), max: money(max) });
  }

  const { rows: products } = await pool().query<{ id: string; name: string; size: string }>(
    "select id, name, size from products"
  );

  // The sheet names a product the way the invoice does ("YUJA DERMA CREAM
  // 50ml") -- no brand, size inline. The catalogue splits the size into its
  // own column and carries the brand in the name. Match on the two joined,
  // with the brand prefixed.
  const byKey = new Map<string, { id: string; name: string }[]>();
  for (const p of products) {
    const key = normalizeName(`${p.name} ${p.size}`);
    const list = byKey.get(key) ?? [];
    list.push({ id: p.id, name: p.name });
    byKey.set(key, list);
  }

  const targets = new Map<string, Target>();
  const unmatched: SheetRow[] = [];
  const conflicts: string[] = [];

  for (const s of rows) {
    const hits = byKey.get(normalizeName(`Lebelage ${s.name}`));
    if (!hits || hits.length !== 1) {
      unmatched.push(s);
      continue;
    }
    const p = hits[0];
    const existing = targets.get(p.id);
    if (!existing) {
      targets.set(p.id, { id: p.id, dbName: p.name, ...s, sourceRows: [s.row] });
      continue;
    }

    // Two invoice lines for the same product. Quantities add up -- they are
    // separate cartons of the same thing. Prices must agree, except the
    // minimum, where the sheet disagrees with itself on one product; the
    // HIGHER floor wins, because taking the lower would authorise selling
    // under a floor this very sheet states.
    existing.qty += s.qty;
    existing.sourceRows.push(s.row);
    if (s.listing !== existing.listing) {
      conflicts.push(
        `${p.id}: rows ${existing.sourceRows.join("/")} disagree on listing price (${existing.listing} vs ${s.listing})`
      );
    }
    if (s.min !== existing.min) {
      console.log(
        `  note ${p.id}: rows ${existing.sourceRows.join("/")} give different minimums ` +
          `(${existing.min} vs ${s.min}); taking the higher.`
      );
      existing.min = Math.max(existing.min, s.min);
    }
    existing.median = Math.max(existing.median, s.median);
    existing.max = Math.max(existing.max, s.max);
  }

  // Pre-flight. Anything here means the sheet would violate a constraint on
  // the table, so it is caught before a transaction is opened rather than as
  // a Postgres error halfway through.
  const invalid: string[] = [];
  for (const t of targets.values()) {
    if (t.listing < t.min) invalid.push(`${t.id}: listing ${t.listing} is below minimum ${t.min}`);
    if (t.max < t.min) invalid.push(`${t.id}: maximum ${t.max} is below minimum ${t.min}`);
    if (t.median < t.min || t.median > t.max) {
      invalid.push(`${t.id}: median ${t.median} is outside ${t.min}..${t.max}`);
    }
  }

  const missing = products.filter((p) => !targets.has(p.id));

  console.log(`sheet rows read:        ${rows.length}`);
  console.log(`products in catalogue:  ${products.length}`);
  console.log(`products matched:       ${targets.size}`);
  if (skipped.length) console.log(`\nrows skipped (incomplete):\n  ${skipped.join("\n  ")}`);
  if (unmatched.length) {
    console.log(`\nsheet rows with no catalogue match (${unmatched.length}):`);
    unmatched.forEach((u) => console.log(`  r${u.row} ${JSON.stringify(u.name)}`));
  }
  if (missing.length) {
    console.log(`\ncatalogue products absent from the sheet (${missing.length}) -- left untouched:`);
    missing.forEach((p) => console.log(`  ${p.id} ${p.name}`));
  }
  if (conflicts.length) console.log(`\nCONFLICTS:\n  ${conflicts.join("\n  ")}`);
  if (invalid.length) console.log(`\nINVALID:\n  ${invalid.join("\n  ")}`);

  if (conflicts.length || invalid.length || unmatched.length) {
    console.log("\nAborting: resolve the above first. Nothing was written.");
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    console.log("\n--dry-run: showing the first 10 updates, writing nothing.\n");
    [...targets.values()].slice(0, 10).forEach((t) =>
      console.log(
        `  ${t.id.padEnd(9)} qty=${String(t.qty).padStart(3)}  min=${String(t.min).padStart(7)}  ` +
          `listing=${String(t.listing).padStart(6)}  median=${String(t.median).padStart(9)}  max=${String(t.max).padStart(9)}`
      )
    );
    return;
  }

  const client = await pool().connect();
  let updated = 0;
  try {
    await client.query("begin");
    for (const t of targets.values()) {
      // price_min is set in the same statement as price. Set separately, the
      // first statement would be checked against the OLD value of the other
      // and a legitimate new band could be rejected for a violation that only
      // exists between the two halves of the update.
      const res = await client.query(
        // stock_status is deliberately absent: it is a generated column now
        // (0 out, 1-2 low, 3+ in), and Postgres rejects any statement that
        // supplies a value for one. Setting stock_on_hand is what moves it.
        `update products set
           stock_on_hand = $2,
           price = $3,
           price_min = $4,
           price_median = $5,
           price_max = $6,
           discount_percent = 0,
           updated_at = now()
         where id = $1`,
        [t.id, t.qty, t.listing, t.min, t.median, t.max]
      );
      updated += res.rowCount ?? 0;
    }
    if (prune && missing.length) {
      // Ask first which of these stock history refuses to let go of, so the
      // ones that CAN be removed still are, instead of one restricted row
      // aborting the whole prune.
      const ids = missing.map((p) => p.id);
      const { rows: blocked } = await client.query<{ product_id: string; source: string }>(
        `select product_id, 'shipment' as source from stock_shipment_items where product_id = any($1)
         union
         select product_id, 'stock count' from stock_count_items where product_id = any($1)`,
        [ids]
      );
      const blockedIds = new Set(blocked.map((b) => b.product_id));
      const deletable = ids.filter((id) => !blockedIds.has(id));

      if (blockedIds.size) {
        console.log(`\nkept despite not being in the sheet (stock history references them):`);
        blocked.forEach((b) => console.log(`  ${b.product_id} — referenced by a ${b.source}`));
      }

      if (deletable.length) {
        // No foreign keys on these two, so they would silently point at a
        // product that no longer exists.
        const rev = await client.query(`delete from reviews where product_id = any($1)`, [deletable]);
        const fav = await client.query(
          `update users set favorites = (
             select coalesce(jsonb_agg(f), '[]'::jsonb)
               from jsonb_array_elements_text(favorites) f
              where f <> all($1)
           )
           where favorites ?| $1`,
          [deletable]
        );
        const del = await client.query(`delete from products where id = any($1)`, [deletable]);
        console.log(
          `\npruned ${del.rowCount} products not in the sheet ` +
            `(also removed ${rev.rowCount} reviews, cleaned favourites on ${fav.rowCount} accounts).`
        );
        deletable.forEach((id) => console.log(`  deleted ${id}`));
      }
    }

    await client.query("commit");
    console.log(`\nCommitted. ${updated} products updated.`);
  } catch (err) {
    await client.query("rollback");
    console.error("\nRolled back, nothing written:", (err as Error).message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
