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
  /**
   * The signed-in account that placed this order, if any — set once at
   * checkout from the session, independent of whatever contact email was
   * typed into the shipping form. Account linkage (My Orders, Boli
   * earning) should always prefer this over matching `customer.email`,
   * which is just delivery contact info and may legitimately differ from
   * the account's login email. Absent on guest checkouts and on every
   * order placed before this field existed.
   */
  userId?: string;
  /** Cart subtotal BEFORE any Boli discount — this is the base the 30%-of-subtotal redemption cap and the purchase-Boli earn rate are both computed against. Orders predating Boli have no discount and this is the full charged amount. */
  subtotal: number;
  currency: Currency;
  customer: OrderCustomer;
  /** How the customer pays. Orders predating this field are bank transfers. */
  paymentMethod?: PaymentMethod;
  /** Public path under /uploads to the receipt/screenshot, once uploaded. */
  paymentProofPath: string | null;
  status: OrderStatus;
  /**
   * Boli redemption applied at checkout, if any — a receipt of what the
   * Boli ledger (Supabase) already recorded, not itself a balance. The
   * amount actually charged is `subtotal - boliDiscountAmount`. Absent on
   * orders that redeemed nothing (including every order placed before Boli
   * existed).
   */
  boliRedeemed?: number;
  /** MVR value of `boliRedeemed`, at REDEMPTION_BOLI_PER_MVR — kept alongside it so this receipt is readable without re-deriving the conversion rate later if that rate ever changes. */
  boliDiscountAmount?: number;
  createdAt: string;
  updatedAt: string;
};

export type SortOption = "featured" | "newest" | "price-asc" | "price-desc";
