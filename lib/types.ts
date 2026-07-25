/**
 * Shared types for the catalog/cart/checkout/admin system. Pure types only
 * (no runtime imports) so this file is safe to import from both client and
 * server code.
 */

export const CATEGORIES = [
  "Ampoule",
  "Cream",
  "Foam",
  "Sun Care",
  "Toner",
  "Mask Pack",
  "Foam Pack 2in1",
  "Toner Pad",
  "Lotion",
  "Make-up",
  "Eye Cream",
  "Soothing Gel",
  "Emulsion",
  "Essence",
  "Serum",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type StockStatus = "in-stock" | "low-stock" | "out-of-stock";

export type Currency = "MVR" | "USD";

export type Product = {
  id: string;
  sku: string;
  name: string;
  /** Volume/weight (e.g. "200ml", "25g x 10pcs") — kept out of `name` so it can render small/separate. */
  size: string;
  brand: string;
  category: Category;
  price: number;
  currency: Currency;
  /** Short summary shown on cards and near the top of the detail page. */
  description: string;
  /** Three alternate marketing headlines, rotated on the detail page. */
  headlines: [string, string, string];
  /** Ingredient copy — full INCI list where verified, hero ingredient otherwise. */
  ingredients: string;
  /** Usage steps. */
  howToUse: string;
  /** At least one image; first is the primary/thumbnail. */
  images: string[];
  stockStatus: StockStatus;
  /** Units physically on hand — shown in the admin products table. */
  stockOnHand: number;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Shape accepted when creating a product — server assigns id/timestamps. */
export type ProductInput = Omit<Product, "id" | "createdAt" | "updatedAt">;

export type OrderStatus =
  | "Pending Verification"
  | "Confirmed"
  | "Shipped"
  | "Completed"
  | "Cancelled";

export type PaymentMethod = "cash" | "transfer";

export type OrderItem = {
  productId: string;
  name: string;
  price: number;
  currency: Currency;
  quantity: number;
  image: string | null;
};

export type OrderCustomer = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  currency: Currency;
  customer: OrderCustomer;
  /** How the customer pays. Orders predating this field are bank transfers. */
  paymentMethod?: PaymentMethod;
  /** Public path under /uploads to the receipt/screenshot, once uploaded. */
  paymentProofPath: string | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

export type SortOption = "featured" | "newest" | "price-asc" | "price-desc";
