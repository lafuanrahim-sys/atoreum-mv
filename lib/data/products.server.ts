import fs from "fs";
import path from "path";
import type { Product, ProductInput, Category } from "@/lib/types";

/**
 * File-based product store. This is deliberately simple (a JSON file read/
 * written with `fs`) rather than a real database, matching the project's
 * current stack (no DB is configured). Server-only — importing this from a
 * "use client" file will fail the build, which is intentional: product data
 * mutations should only ever happen through Server Components/Actions.
 *
 * KNOWN LIMITATION: writing to the filesystem at runtime only works on a
 * persistent server (local dev, a VPS/Node host). It will NOT work on most
 * serverless hosts (e.g. Vercel), where the filesystem is read-only/ephemeral
 * at runtime. Swap this module for a real database before deploying to
 * serverless infra — the rest of the app only depends on the exported
 * functions below, so the swap is contained to this one file.
 */

const DATA_PATH = path.join(process.cwd(), "data", "products.json");

function readAll(): Product[] {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw) as Product[];
}

function writeAll(products: Product[]) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(products, null, 2) + "\n", "utf-8");
}

export function getAllProducts(): Product[] {
  return readAll();
}

export function getProductById(id: string): Product | null {
  return readAll().find((p) => p.id === id) ?? null;
}

export function getFeaturedProducts(limit = 6): Product[] {
  return readAll()
    .filter((p) => p.featured)
    .slice(0, limit);
}

export function getRelatedProducts(category: Category, excludeId: string, limit = 4): Product[] {
  return readAll()
    .filter((p) => p.category === category && p.id !== excludeId)
    .slice(0, limit);
}

function nextSequentialId(category: Category, existing: Product[]): string {
  const prefix = category.slice(0, 3).toLowerCase().replace(/[^a-z]/g, "");
  const usedInCategory = existing.filter((p) => p.category === category).length;
  return `${prefix}-${String(usedInCategory + 1).padStart(3, "0")}`;
}

export function createProduct(input: ProductInput): Product {
  const all = readAll();
  const now = new Date().toISOString();
  const product: Product = {
    ...input,
    id: nextSequentialId(input.category, all),
    createdAt: now,
    updatedAt: now,
  };
  all.push(product);
  writeAll(all);
  return product;
}

export function updateProduct(id: string, patch: Partial<ProductInput>): Product | null {
  const all = readAll();
  const index = all.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const updated: Product = {
    ...all[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  all[index] = updated;
  writeAll(all);
  return updated;
}

export function deleteProduct(id: string): boolean {
  const all = readAll();
  const next = all.filter((p) => p.id !== id);
  if (next.length === all.length) return false;
  writeAll(next);
  return true;
}

/**
 * Bulk-import path for going from ~30 seed products to the full ~150 SKU
 * catalog: append an array of ProductInput objects in one call. Existing
 * products are left untouched; each new entry gets its own id + timestamps.
 */
export function bulkImportProducts(inputs: ProductInput[]): Product[] {
  const all = readAll();
  const now = new Date().toISOString();
  const created: Product[] = [];

  for (const input of inputs) {
    const product: Product = {
      ...input,
      id: nextSequentialId(input.category, [...all, ...created]),
      createdAt: now,
      updatedAt: now,
    };
    created.push(product);
  }

  writeAll([...all, ...created]);
  return created;
}
