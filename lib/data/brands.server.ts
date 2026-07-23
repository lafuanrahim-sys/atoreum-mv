import fs from "fs";
import path from "path";

/**
 * File-based brand list — the set of brands the product form's dropdown
 * offers, manageable from Dashboard → Settings.
 *
 * Same pattern as the other stores (products/orders/users): JSON-on-disk,
 * server-only, auto-seeded on first read, and deliberately contained to
 * this one module so swapping the backing store for Supabase later means
 * reimplementing ONLY the exported functions below (e.g. `supabase
 * .from("brands").select()`), with no changes anywhere else in the app.
 */

const DATA_PATH = path.join(process.cwd(), "data", "brands.json");

const SEED_BRANDS = [
  "Lebelage",
  "ANUA",
  "Beauty of Joseon",
  "COSRX",
  "THE WHOO",
  "SULWHASOO",
  "SEOUL 1998",
  "Skin 1004",
];

function readAll(): string[] {
  if (!fs.existsSync(DATA_PATH)) {
    writeAll(SEED_BRANDS);
  }
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw) as string[];
}

function writeAll(brands: string[]) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(brands, null, 2) + "\n", "utf-8");
}

export function listBrands(): string[] {
  return readAll();
}

export function addBrand(name: string): string[] | { error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Brand name is required." };
  const all = readAll();
  if (all.some((b) => b.toLowerCase() === trimmed.toLowerCase())) {
    return { error: "That brand already exists." };
  }
  const next = [...all, trimmed];
  writeAll(next);
  return next;
}

export function removeBrand(name: string): string[] {
  const next = readAll().filter((b) => b !== name);
  writeAll(next);
  return next;
}
