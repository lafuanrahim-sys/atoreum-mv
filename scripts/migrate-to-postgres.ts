import fs from "fs";
import path from "path";
import { Pool } from "pg";

/**
 * One-time migration: applies lib/data/schema.sql, then copies every
 * existing data/*.json record into the new tables. Idempotent (safe to
 * re-run against the same database) — every insert is ON CONFLICT DO
 * NOTHING keyed on the record's existing id/email/name, so re-running just
 * skips whatever's already there rather than duplicating or erroring.
 *
 * Run against a target database via DATABASE_URL, e.g.:
 *   DATABASE_URL="postgresql://...supabase..." npx tsx scripts/migrate-to-postgres.ts
 *
 * Meant to be run once per target (local dev Postgres AND the production
 * Supabase database each need their own run, pointed at each in turn) —
 * not part of the app's normal runtime.
 */

const DATA_DIR = path.join(process.cwd(), "data");

function readJson<T>(filename: string, fallback: T): T {
  const p = path.join(DATA_DIR, filename);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DATABASE_URL to the target database before running this script.");
  }
  const pool = new Pool({ connectionString });

  console.log(`Target: ${connectionString.replace(/:[^:@]+@/, ":***@")}`);

  console.log("\n1. Applying lib/data/schema.sql...");
  const schemaSql = fs.readFileSync(path.join(process.cwd(), "lib", "data", "schema.sql"), "utf-8");
  await pool.query(schemaSql);
  console.log("   done.");

  // --- products -------------------------------------------------------
  type JsonProduct = {
    id: string; sku: string; name: string; size: string; brand: string; category: string;
    price: number; currency: string; description: string; headlines: [string, string, string];
    ingredients: string; howToUse: string; images: string[]; stockStatus: string;
    stockOnHand?: number; featured: boolean; createdAt: string; updatedAt: string;
  };
  const products = readJson<JsonProduct[]>("products.json", []);
  console.log(`\n2. Migrating ${products.length} products...`);
  for (const p of products) {
    await pool.query(
      `insert into products (id, sku, name, size, brand, category, price, currency, description, headlines, ingredients, how_to_use, images, stock_status, stock_on_hand, featured, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       on conflict (id) do nothing`,
      [
        p.id, p.sku, p.name, p.size, p.brand, p.category, p.price, p.currency, p.description,
        JSON.stringify(p.headlines), p.ingredients, p.howToUse, JSON.stringify(p.images), p.stockStatus,
        p.stockOnHand ?? 0, p.featured, p.createdAt, p.updatedAt,
      ]
    );
  }
  console.log("   done.");

  // --- users ------------------------------------------------------------
  type JsonUser = {
    id: string; name: string; email: string; passwordHash: string; role: string; favorites: string[];
    emailVerified?: boolean; verificationTokenHash?: string | null; verificationTokenExpiresAt?: string | null;
    createdAt: string; updatedAt: string;
  };
  const users = readJson<JsonUser[]>("users.json", []);
  console.log(`\n3. Migrating ${users.length} users...`);
  for (const u of users) {
    await pool.query(
      `insert into users (id, name, email, password_hash, role, favorites, email_verified, verification_token_hash, verification_token_expires_at, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (id) do nothing`,
      [
        u.id, u.name, u.email, u.passwordHash, u.role, JSON.stringify(u.favorites ?? []),
        u.emailVerified ?? true, u.verificationTokenHash ?? null, u.verificationTokenExpiresAt ?? null,
        u.createdAt, u.updatedAt,
      ]
    );
  }
  console.log("   done.");

  // --- orders -------------------------------------------------------------
  type JsonOrder = {
    id: string; orderNumber: string; items: unknown[]; userId?: string; subtotal: number; currency: string;
    customer: unknown; paymentMethod?: string; paymentProofPath: string | null; status: string;
    boliRedeemed?: number; boliDiscountAmount?: number; createdAt: string; updatedAt: string;
  };
  const orders = readJson<JsonOrder[]>("orders.json", []);
  console.log(`\n4. Migrating ${orders.length} orders...`);
  for (const o of orders) {
    await pool.query(
      `insert into orders (id, order_number, items, user_id, subtotal, currency, customer, payment_method, payment_proof_path, status, boli_redeemed, boli_discount_amount, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       on conflict (id) do nothing`,
      [
        o.id, o.orderNumber, JSON.stringify(o.items), o.userId ?? null, o.subtotal, o.currency,
        JSON.stringify(o.customer), o.paymentMethod ?? null, o.paymentProofPath, o.status,
        o.boliRedeemed ?? null, o.boliRedeemed ? (o.boliDiscountAmount ?? null) : null, o.createdAt, o.updatedAt,
      ]
    );
  }
  console.log("   done.");

  // --- reviews --------------------------------------------------------
  type JsonReview = {
    id: string; productId: string; userId: string; userName: string; rating: number; text: string;
    status: string; createdAt: string;
  };
  const reviews = readJson<JsonReview[]>("reviews.json", []);
  console.log(`\n5. Migrating ${reviews.length} reviews...`);
  for (const r of reviews) {
    await pool.query(
      `insert into reviews (id, product_id, user_id, user_name, rating, text, status, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (id) do nothing`,
      [r.id, r.productId, r.userId, r.userName, r.rating, r.text, r.status, r.createdAt]
    );
  }
  console.log("   done.");

  // --- brands -----------------------------------------------------------
  const brands = readJson<string[]>("brands.json", []);
  console.log(`\n6. Migrating ${brands.length} brands...`);
  for (const name of brands) {
    await pool.query("insert into brands (name) values ($1) on conflict (name) do nothing", [name]);
  }
  console.log("   done.");

  // --- messages -----------------------------------------------------
  type JsonMessage = { id: string; name: string; phone: string; message: string; status: string; createdAt: string };
  const messages = readJson<JsonMessage[]>("messages.json", []);
  console.log(`\n7. Migrating ${messages.length} messages...`);
  for (const m of messages) {
    await pool.query(
      `insert into messages (id, name, phone, message, status, created_at)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (id) do nothing`,
      [m.id, m.name, m.phone, m.message, m.status, m.createdAt]
    );
  }
  console.log("   done.");

  // --- settings (singleton) ------------------------------------------
  type JsonSettings = { bankName: string; accountName: string; accountNumber: string; swift: string };
  const settingsPath = path.join(DATA_DIR, "settings.json");
  if (fs.existsSync(settingsPath)) {
    const s = JSON.parse(fs.readFileSync(settingsPath, "utf-8")) as JsonSettings;
    console.log("\n8. Migrating store settings...");
    await pool.query(
      `insert into store_settings (id, bank_name, account_name, account_number, swift)
       values (true, $1, $2, $3, $4)
       on conflict (id) do nothing`,
      [s.bankName, s.accountName, s.accountNumber, s.swift]
    );
    console.log("   done.");
  } else {
    console.log("\n8. No settings.json found, skipping (getSettings() will seed a default on first read).");
  }

  const counts = await pool.query<{ table_name: string; count: string }>(
    `select 'products' as table_name, count(*)::text from products
     union all select 'users', count(*)::text from users
     union all select 'orders', count(*)::text from orders
     union all select 'reviews', count(*)::text from reviews
     union all select 'brands', count(*)::text from brands
     union all select 'messages', count(*)::text from messages
     union all select 'store_settings', count(*)::text from store_settings`
  );
  console.log("\nFinal row counts in target database:");
  for (const row of counts.rows) console.log(`  ${row.table_name}: ${row.count}`);

  await pool.end();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
