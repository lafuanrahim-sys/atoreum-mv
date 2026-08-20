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
  /** Listing price — what the site shows and what an order is priced from. */
  price: number;
  /** Floor. The listing price can never be saved below this (DB-enforced). */
  priceMin: number;
  /** Intended shelf price. Advisory reference only — nothing is charged from it. */
  priceMedian: number | null;
  /** Ceiling. Advisory reference only. */
  priceMax: number | null;
  /** Percent off the listing price; 0 when not on offer. */
  discountPercent: number;
  /**
   * Flat sum off the listing price, in this product's currency; 0 when not on
   * offer. Mutually exclusive with discountPercent -- the database refuses
   * both at once (see products_discount_single_kind in lib/data/schema.sql).
   */
  discountAmount: number;
  /**
   * What the customer actually pays. Read-only here because it is a Postgres
   * generated column (`round(price * (1 - discount_percent / 100), 2)`) — the
   * discounted price has exactly one definition and the database owns it, so
   * the card, the cart and the order total cannot drift apart. Never send it
   * on a write; Postgres rejects that outright.
   */
  priceEffective: number;
  currency: Currency;
  /**
   * True when images[0] is a photo with its own background rather than a
   * cutout on transparency. Drives whether the card centres the shot or
   * fills the frame with it -- see components/products/ProductCard.tsx.
   */
  imageHasBackground: boolean;
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
  /**
   * Derived by the database from stockOnHand (0 -> out, 1-2 -> low, 3+ -> in).
   * Read-only: it is a generated column, so Postgres rejects any write that
   * supplies it. Change stockOnHand instead.
   */
  stockStatus: StockStatus;
  /** Units physically on hand — shown in the admin products table. */
  stockOnHand: number;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Shape accepted when creating a product — server assigns id/timestamps.
 * `priceEffective` is omitted as well: it is a generated column, and Postgres
 * refuses any statement that supplies a value for one, so leaving it in the
 * input type would only invite a write that fails at runtime.
 *
 * `imageHasBackground` is omitted for the same reason in spirit: it is
 * measured from the image itself, not decided by whoever fills in the form
 * (see scripts/detect-image-backgrounds.ts).
 */
export type ProductInput = Omit<
  Product,
  "id" | "createdAt" | "updatedAt" | "priceEffective" | "stockStatus" | "imageHasBackground"
>;

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
  /** Price actually charged, per unit — the discounted price where one applied. */
  price: number;
  /**
   * Undiscounted listing price at the time of sale, and the percentage taken
   * off it. Snapshotted onto the line rather than looked up later: a receipt
   * has to keep saying what it said, and the product's price will move.
   * Absent on orders placed before this existed, and on anything sold at full
   * price — the invoice simply shows no discount for those.
   */
  listPrice?: number;
  discountPercent?: number;
  currency: Currency;
  quantity: number;
  image: string | null;
};

export type OrderCustomer = {
  name: string;
  email: string;
  phone: string;
  address: string;
  /**
   * Whatever the customer wanted us to know — delivery instructions, a
   * landmark, a preferred time. Optional, and absent on orders placed before
   * the field existed.
   */
  notes?: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  /**
   * Monotonic invoice counter, assigned by the database at insert. Separate
   * from orderNumber because that one resets daily and a tax invoice number
   * must never repeat. Renders as ATO-INV-0001 -- see lib/invoice.ts.
   */
  /**
   * Null until the order is confirmed. A tax invoice documents a sale that
   * happened, so an unpaid or unverified order has nothing to number -- see
   * lib/data/invoicing.sql. Anything rendering an invoice must handle null.
   */
  invoiceSeq: number | null;
  items: OrderItem[];
  /**
   * The signed-in account that placed this order, if any — set once at
   * checkout from the session, independent of whatever contact email was
   * typed into the shipping form. Account linkage (My Orders, Sangu
   * earning) should always prefer this over matching `customer.email`,
   * which is just delivery contact info and may legitimately differ from
   * the account's login email. Absent on guest checkouts and on every
   * order placed before this field existed.
   */
  userId?: string;
  /**
   * Shop-assigned reference for an order placed without an account, e.g.
   * "Guest-ATO-001". Null on account orders, which have an account to be
   * identified by. Assigned by the database, so unlike the name on the
   * shipping form it cannot be spoofed by typing.
   */
  guestRef?: string | null;
  /** Cart subtotal BEFORE any Sangu discount — this is the base the 30%-of-subtotal redemption cap and the purchase-Sangu earn rate are both computed against. Orders predating Sangu have no discount and this is the full charged amount. */
  subtotal: number;
  currency: Currency;
  customer: OrderCustomer;
  /** How the customer pays. Orders predating this field are bank transfers. */
  paymentMethod?: PaymentMethod;
  /** Public path under /uploads to the receipt/screenshot, once uploaded. */
  paymentProofPath: string | null;
  status: OrderStatus;
  /**
   * Sangu redemption applied at checkout, if any — a receipt of what the
   * Sangu ledger (Supabase) already recorded, not itself a balance. The
   * amount actually charged is `subtotal - boliDiscountAmount`. Absent on
   * orders that redeemed nothing (including every order placed before Sangu
   * existed).
   */
  boliRedeemed?: number;
  /** MVR value of `boliRedeemed`, at REDEMPTION_BOLI_PER_MVR — kept alongside it so this receipt is readable without re-deriving the conversion rate later if that rate ever changes. */
  boliDiscountAmount?: number;
  /**
   * Which run of invoice numbers this order belongs to. Goods and gift
   * vouchers are numbered separately — see lib/data/schema.sql.
   */
  invoiceSeries: "INV" | "GVINV";
  /** False when the order's lines are not stockable goods (a gift voucher). */
  movesStock: boolean;
  /** Gift voucher applied to this order, if one was. */
  voucherCode?: string;
  voucherBoli?: number;
  voucherDiscountAmount?: number;
  createdAt: string;
  updatedAt: string;
};

export type SortOption = "featured" | "newest" | "price-asc" | "price-desc";

/* -----------------------------------------------------------------------
 * Dollar exchange tracker (Dashboard -> Dollar Exchange). Ported from the
 * standalone Atoreum FX app -- see lib/data/schema.sql's fx_* tables for
 * the generated-column formulas these mirror. Every derived field here is
 * read back from the database, never recomputed in TypeScript.
 * --------------------------------------------------------------------- */

export type FxSettings = {
  ceilingRate: number;
  bankTtRate: number;
  latestMarketRate: number;
  updatedAt: string;
  updatedBy: string | null;
};

/** USD bought on the parallel market. */
export type FxExchange = {
  id: string;
  tradeDate: string;
  counterparty: string;
  usdAmount: number;
  buyRate: number;
  marketRate: number;
  /** Snapshotted at the time of purchase -- changing fxSettings later doesn't retroactively alter past rows. */
  ceilingRate: number;
  /** Set once this USD is resold -- null while still held. */
  sellRate: number | null;
  notes: string;
  createdAt: string;
  createdBy: string | null;

  mvrPaid: number;
  costAtCeiling: number;
  profitVsCeiling: number;
  unrealizedVsMarket: number;
  /** Null until sellRate is set. */
  realizedProfit: number | null;
};

/** A TT (telegraphic transfer) paid with partial Bank of Maldives dollar support. */
export type FxTtPayment = {
  id: string;
  ttDate: string;
  reference: string;
  purpose: string;
  ttAmount: number;
  /** Share of the TT the bank supplies at its own rate, as a fraction (0.499853, not 49.9853). */
  supportPct: number;
  bankRate: number;
  marketRate: number;
  notes: string;
  createdAt: string;
  createdBy: string | null;

  usdViaBank: number;
  usdFromOwn: number;
  cashPaidMvr: number;
  ownUsdAtBankRate: number;
  costOwnUsdMvr: number;
  opportunityCost: number;
  totalEffectiveCost: number;
  costNoSupport: number;
  cashSavedToday: number;
  totalSavedInclOpp: number;
};

/** Summary figures from the fx_dashboard view -- see its own comment in schema.sql for the usd_used/usd_balance fix inherited from the source spreadsheet. */
export type FxDashboardSummary = {
  usdBought: number;
  usdUsed: number;
  usdBalance: number;
  avgBuyRate: number | null;
  mvrPaid: number;
  profitVsCeiling: number;
  profitVsMarket: number;
  realizedProfit: number;
  ttTotal: number;
  cashPaid: number;
  costNoSupport: number;
  cashSaved: number;
  savedInclOpp: number;
  totalValueCreated: number;
};
