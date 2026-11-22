/**
 * Prices the Lebelage sheet-mask range as two SKUs each: the existing SKU
 * becomes the 10-sheet pack, and a new "-S" SKU is created for a single
 * sheet.
 *
 *   pack    MVR 230, 10% off  ->  MVR 207 charged
 *   single  MVR 25,  no offer
 *
 * The two are told apart by `size` ("25g x 10pcs" vs "25g x 1pc"), not by
 * the name -- that field exists so the storefront can render it small and
 * separate from the product title, which keeps both cards reading as the
 * same product in two formats rather than two near-identical listings.
 *
 * Only the five solution masks are touched. LBL-MSK-006/007 are Hydrogel
 * Eye Patches (90g / 60 sheets) and are priced on their own terms.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/price-mask-packs.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/price-mask-packs.ts --apply  # write
 */

import { pool } from "@/lib/db";
import { getAllProducts, createProduct, updateProduct } from "@/lib/data/products.server";
import type { Product, ProductInput } from "@/lib/types";

const PACK_SKUS = ["LBL-MSK-001", "LBL-MSK-002", "LBL-MSK-003", "LBL-MSK-004", "LBL-MSK-005"];

const PACK_PRICE = 230;
const PACK_DISCOUNT_PERCENT = 10; // 230 -> 207 exactly
const SINGLE_PRICE = 25;
const PACK_SIZE = "25g x 10pcs";
const SINGLE_SIZE = "25g x 1pc";
const SINGLE_SUFFIX = "-S";

const apply = process.argv.includes("--apply");

/**
 * The pack's fields that a single sheet inherits unchanged — the copy the
 * customer reads, the photos, and the catalog placement. Listed one by one
 * rather than spread from the pack, so adding a column to Product forces a
 * decision here instead of silently carrying a pack-shaped value onto a
 * single-sheet listing.
 */
function inheritedFromPack(pack: Product): ProductInput {
  return {
    sku: pack.sku,
    name: pack.name,
    size: pack.size,
    brand: pack.brand,
    category: pack.category,
    price: pack.price,
    priceMin: pack.priceMin,
    priceMedian: pack.priceMedian,
    priceMax: pack.priceMax,
    discountPercent: pack.discountPercent,
    discountAmount: pack.discountAmount,
    currency: pack.currency,
    description: pack.description,
    headlines: pack.headlines,
    ingredients: pack.ingredients,
    howToUse: pack.howToUse,
    images: pack.images,
    stockOnHand: pack.stockOnHand,
    featured: pack.featured,
  };
}

async function main() {
  const all = await getAllProducts();
  const bySku = new Map(all.map((p) => [p.sku, p]));

  const plan: string[] = [];
  let packsUpdated = 0;
  let singlesCreated = 0;
  let singlesUpdated = 0;

  for (const sku of PACK_SKUS) {
    const pack = bySku.get(sku);
    if (!pack) {
      plan.push(`SKIP   ${sku} — not in the catalog`);
      continue;
    }

    // --- the pack ---
    const packNeedsWrite =
      pack.price !== PACK_PRICE ||
      pack.discountPercent !== PACK_DISCOUNT_PERCENT ||
      pack.discountAmount !== 0 ||
      pack.size !== PACK_SIZE;

    if (packNeedsWrite) {
      plan.push(
        `PACK   ${sku}  ${pack.name}\n` +
          `         price ${pack.price} -> ${PACK_PRICE}, ` +
          `discount ${pack.discountPercent}% -> ${PACK_DISCOUNT_PERCENT}% (charged ${
            PACK_PRICE * (1 - PACK_DISCOUNT_PERCENT / 100)
          }), size "${pack.size}" -> "${PACK_SIZE}"`,
      );
      if (apply) {
        await updateProduct(pack.id, {
          price: PACK_PRICE,
          discountPercent: PACK_DISCOUNT_PERCENT,
          // Both discount columns are always written together: the database
          // refuses a row carrying a percentage and a flat amount at once
          // (products_discount_single_kind).
          discountAmount: 0,
          size: PACK_SIZE,
        });
      }
      packsUpdated += 1;
    } else {
      plan.push(`PACK   ${sku} — already correct`);
    }

    // --- the single ---
    const singleSku = `${sku}${SINGLE_SUFFIX}`;
    const existingSingle = bySku.get(singleSku);

    if (existingSingle) {
      const singleNeedsWrite =
        existingSingle.price !== SINGLE_PRICE ||
        existingSingle.discountPercent !== 0 ||
        existingSingle.discountAmount !== 0 ||
        existingSingle.size !== SINGLE_SIZE;
      if (singleNeedsWrite) {
        plan.push(
          `SINGLE ${singleSku} — exists, repricing ${existingSingle.price} -> ${SINGLE_PRICE}`,
        );
        if (apply) {
          await updateProduct(existingSingle.id, {
            price: SINGLE_PRICE,
            discountPercent: 0,
            discountAmount: 0,
            size: SINGLE_SIZE,
          });
        }
        singlesUpdated += 1;
      } else {
        plan.push(`SINGLE ${singleSku} — already correct`);
      }
      continue;
    }

    const single: ProductInput = {
      ...inheritedFromPack(pack),
      sku: singleSku,
      size: SINGLE_SIZE,
      price: SINGLE_PRICE,
      // priceMin is the floor the listing may never go under, and it is
      // DB-enforced (price >= price_min). The pack's floor is a floor for
      // ten sheets, so carrying it over would make a 25-rufiyaa single
      // illegal to save. A tenth of it keeps the same intent at the
      // single's scale, capped at the single's own price so the row can
      // always be written.
      priceMin: Math.min(Math.round((pack.priceMin / 10) * 100) / 100, SINGLE_PRICE),
      priceMedian: null,
      priceMax: null,
      discountPercent: 0,
      discountAmount: 0,
      // Deliberately zero. The singles come out of the same physical boxes
      // as the packs, so seeding them with a count would have the same
      // sheets on hand twice. Set the real split in Dashboard -> Products
      // once it's decided how many boxes get broken.
      stockOnHand: 0,
      featured: false,
    };

    plan.push(
      `SINGLE ${singleSku}  ${pack.name}\n` +
        `         NEW — price ${SINGLE_PRICE}, size "${SINGLE_SIZE}", stock 0, floor ${single.priceMin}`,
    );
    if (apply) await createProduct(single);
    singlesCreated += 1;
  }

  console.log(`\n${apply ? "APPLIED" : "DRY RUN — nothing written"}\n`);
  console.log(plan.join("\n"));
  console.log(
    `\npacks updated: ${packsUpdated}   singles created: ${singlesCreated}   singles repriced: ${singlesUpdated}`,
  );
  if (!apply) console.log(`\nRe-run with --apply to write these changes.\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool().end());
