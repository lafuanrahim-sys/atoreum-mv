import { pool } from "@/lib/db";
import type { Product, ProductInput, Category } from "@/lib/types";

/**
 * Postgres-backed product store (see lib/data/schema.sql) — replaces the
 * original JSON-on-disk version, which didn't persist on Vercel's
 * read-only/ephemeral serverless filesystem. Same exported functions as
 * before, so every caller elsewhere in the app is unchanged.
 */

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  size: string;
  brand: string;
  category: string;
  price: string; // numeric columns come back as strings from `pg`
  currency: string;
  description: string;
  headlines: [string, string, string];
  ingredients: string;
  how_to_use: string;
  images: string[];
  stock_status: string;
  stock_on_hand: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
};

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    size: row.size,
    brand: row.brand,
    category: row.category as Category,
    price: Number(row.price),
    currency: row.currency as Product["currency"],
    description: row.description,
    headlines: row.headlines,
    ingredients: row.ingredients,
    howToUse: row.how_to_use,
    images: row.images,
    stockStatus: row.stock_status as Product["stockStatus"],
    stockOnHand: row.stock_on_hand,
    featured: row.featured,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function getAllProducts(): Promise<Product[]> {
  const { rows } = await pool().query<ProductRow>("select * from products order by created_at desc");
  return rows.map(rowToProduct);
}

export async function getProductById(id: string): Promise<Product | null> {
  const { rows } = await pool().query<ProductRow>("select * from products where id = $1", [id]);
  return rows[0] ? rowToProduct(rows[0]) : null;
}

export async function getFeaturedProducts(limit = 6): Promise<Product[]> {
  const { rows } = await pool().query<ProductRow>(
    "select * from products where featured order by created_at desc limit $1",
    [limit]
  );
  return rows.map(rowToProduct);
}

export async function getRelatedProducts(category: Category, excludeId: string, limit = 4): Promise<Product[]> {
  const { rows } = await pool().query<ProductRow>(
    "select * from products where category = $1 and id <> $2 order by created_at desc limit $3",
    [category, excludeId, limit]
  );
  return rows.map(rowToProduct);
}

async function nextSequentialId(category: Category): Promise<string> {
  const prefix = category.slice(0, 3).toLowerCase().replace(/[^a-z]/g, "");
  const { rows } = await pool().query<{ count: string }>(
    "select count(*)::text as count from products where category = $1",
    [category]
  );
  const usedInCategory = Number(rows[0]?.count ?? 0);
  return `${prefix}-${String(usedInCategory + 1).padStart(3, "0")}`;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const id = await nextSequentialId(input.category);
  const { rows } = await pool().query<ProductRow>(
    `insert into products
      (id, sku, name, size, brand, category, price, currency, description, headlines, ingredients, how_to_use, images, stock_status, stock_on_hand, featured)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     returning *`,
    [
      id,
      input.sku,
      input.name,
      input.size,
      input.brand,
      input.category,
      input.price,
      input.currency,
      input.description,
      JSON.stringify(input.headlines),
      input.ingredients,
      input.howToUse,
      JSON.stringify(input.images),
      input.stockStatus,
      input.stockOnHand,
      input.featured,
    ]
  );
  return rowToProduct(rows[0]);
}

export async function updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product | null> {
  const existing = await getProductById(id);
  if (!existing) return null;

  const merged: ProductInput = { ...existing, ...patch };
  const { rows } = await pool().query<ProductRow>(
    `update products set
      sku = $2, name = $3, size = $4, brand = $5, category = $6, price = $7, currency = $8,
      description = $9, headlines = $10, ingredients = $11, how_to_use = $12, images = $13,
      stock_status = $14, stock_on_hand = $15, featured = $16, updated_at = now()
     where id = $1
     returning *`,
    [
      id,
      merged.sku,
      merged.name,
      merged.size,
      merged.brand,
      merged.category,
      merged.price,
      merged.currency,
      merged.description,
      JSON.stringify(merged.headlines),
      merged.ingredients,
      merged.howToUse,
      JSON.stringify(merged.images),
      merged.stockStatus,
      merged.stockOnHand,
      merged.featured,
    ]
  );
  return rows[0] ? rowToProduct(rows[0]) : null;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const { rowCount } = await pool().query("delete from products where id = $1", [id]);
  return (rowCount ?? 0) > 0;
}

/**
 * Bulk-import path for going from ~30 seed products to the full ~150 SKU
 * catalog: insert an array of ProductInput objects in one call. Existing
 * products are left untouched; each new entry gets its own id + timestamps.
 */
export async function bulkImportProducts(inputs: ProductInput[]): Promise<Product[]> {
  const created: Product[] = [];
  // Sequential, not Promise.all: nextSequentialId's count-based numbering
  // needs each insert to land before the next one counts, exactly like the
  // original's in-memory `[...all, ...created]` accumulator did.
  for (const input of inputs) {
    created.push(await createProduct(input));
  }
  return created;
}
