/**
 * Client-safe re-exports. Actual product data now lives in data/products.json
 * and is read/written via lib/data/products.server.ts (server-only — it uses
 * `fs`, so it can only be imported from Server Components/Actions/Route
 * Handlers). This file just re-exports the shared types so existing imports
 * like `import type { Product } from "@/lib/products"` keep working.
 */
export type { Product, ProductInput, Category, StockStatus, Currency, SortOption } from "@/lib/types";
export { CATEGORIES } from "@/lib/types";
