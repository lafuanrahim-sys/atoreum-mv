import { pool } from "@/lib/db";
import type { Order, OrderCustomer, OrderItem, OrderStatus, PaymentMethod } from "@/lib/types";
import { recordMovement } from "@/lib/data/stock.server";

/**
 * Postgres-backed order store (see lib/data/schema.sql) — replaces the
 * original JSON-on-disk version, which didn't persist on Vercel's
 * read-only/ephemeral serverless filesystem. Same exported functions as
 * before, so every caller elsewhere in the app is unchanged (beyond now
 * needing `await`, since every query here is inherently async).
 */

type OrderRow = {
  id: string;
  order_number: string;
  invoice_seq: string | number | null;
  items: OrderItem[];
  user_id: string | null;
  subtotal: string;
  currency: string;
  customer: OrderCustomer;
  payment_method: string | null;
  payment_proof_path: string | null;
  status: string;
  boli_redeemed: string | null;
  boli_discount_amount: string | null;
  moves_stock: boolean;
  voucher_code: string | null;
  voucher_boli: string | null;
  voucher_discount_amount: string | null;
  created_at: string;
  updated_at: string;
};

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    invoiceSeq: Number(row.invoice_seq ?? 0),
    items: row.items,
    ...(row.user_id ? { userId: row.user_id } : {}),
    subtotal: Number(row.subtotal),
    currency: row.currency as Order["currency"],
    customer: row.customer,
    ...(row.payment_method ? { paymentMethod: row.payment_method as PaymentMethod } : {}),
    paymentProofPath: row.payment_proof_path,
    status: row.status as OrderStatus,
    ...(row.boli_redeemed !== null
      ? { boliRedeemed: Number(row.boli_redeemed), boliDiscountAmount: Number(row.boli_discount_amount) }
      : {}),
    movesStock: row.moves_stock ?? true,
    ...(row.voucher_code
      ? {
          voucherCode: row.voucher_code,
          voucherBoli: Number(row.voucher_boli ?? 0),
          voucherDiscountAmount: Number(row.voucher_discount_amount ?? 0),
        }
      : {}),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function getAllOrders(): Promise<Order[]> {
  const { rows } = await pool().query<OrderRow>("select * from orders order by created_at desc");
  return rows.map(rowToOrder);
}

export async function getOrderById(id: string): Promise<Order | null> {
  const { rows } = await pool().query<OrderRow>("select * from orders where id = $1", [id]);
  return rows[0] ? rowToOrder(rows[0]) : null;
}

async function nextOrderNumber(): Promise<string> {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
  const { rows } = await pool().query<{ count: string }>(
    "select count(*)::text as count from orders where order_number like $1",
    [`%${datePart}%`]
  );
  const todayCount = Number(rows[0]?.count ?? 0);
  return `ATM-${datePart}-${String(todayCount + 1).padStart(4, "0")}`;
}

/** Statuses at which an order's items are treated as a committed sale —
 * stock has been (or should be) deducted for them. Everything else
 * ("Pending Verification", the pre-Confirmed state for bank transfers) has
 * not yet touched stock. */
const STOCK_COMMITTED_STATUSES: ReadonlySet<OrderStatus> = new Set(["Confirmed", "Shipped", "Completed"]);

/**
 * Adjusts stock_on_hand for every line item in one order, atomically (all
 * items or none). `direction` is -1 to deduct (a sale becoming committed)
 * or +1 to restore (a committed order being cancelled) — greatest(0, ...)
 * on the deduct path is a defensive floor, not a substitute for checking
 * availability before accepting the order (checkout doesn't currently do
 * that at all; a race between two simultaneous confirmations could still
 * oversell before either deduction lands).
 */
async function adjustStockForItems(items: OrderItem[], direction: 1 | -1, orderId?: string): Promise<void> {
  if (items.length === 0) return;
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    for (const item of items) {
      // Goes through the stock movement ledger rather than updating
      // stock_on_hand directly (recordMovement does both, in this same
      // transaction). Sales are the largest source of stock change, so
      // leaving them out would make the ledger unable to explain the
      // on-hand number it's supposed to be the record of -- see the stock_*
      // tables in lib/data/schema.sql.
      await recordMovement(client, {
        productId: item.productId,
        delta: direction * item.quantity,
        reason: direction === -1 ? "sale" : "sale_reversal",
        sourceType: "order",
        sourceId: orderId ?? "",
        note: item.name,
      });
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * The order a given checkout attempt already created, if it did.
 *
 * Checkout calls this before doing any work, so a resubmitted form returns
 * the original order instead of creating a twin. Two orders four seconds
 * apart, each with its own uploaded receipt, is what this exists to prevent.
 */
export async function getOrderByIdempotencyKey(key: string): Promise<Order | null> {
  const { rows } = await pool().query<OrderRow>(
    "select * from orders where idempotency_key = $1",
    [key]
  );
  return rows[0] ? rowToOrder(rows[0]) : null;
}

export async function createOrder(params: {
  items: OrderItem[];
  subtotal: number;
  currency: Order["currency"];
  customer: OrderCustomer;
  paymentMethod: PaymentMethod;
  paymentProofPath: string | null;
  /** The signed-in account placing this order, if any — see the field comment on Order.userId in lib/types.ts. */
  userId?: string;
  /** Already-validated-and-applied Sangu redemption receipt (see app/actions/checkout.ts) — omit for orders that redeemed nothing. */
  boliRedeemed?: number;
  boliDiscountAmount?: number;
  /** One per checkout attempt — see the unique index in lib/data/schema.sql. */
  idempotencyKey?: string | null;
  /**
   * False for orders whose lines are not stockable goods — a gift voucher is
   * the only such case today. Stock moves through stock_movements, whose
   * product_id is a foreign key, so a line that is not a catalogue product
   * would fail the insert rather than quietly skip it. Explicit here rather
   * than inferred, so the one order type that means it has to say so.
   */
  movesStock?: boolean;
  /** Gift voucher applied at checkout, if any. */
  voucherCode?: string | null;
  voucherBoli?: number | null;
  voucherDiscountAmount?: number | null;
  /**
   * Pre-generated id, when the caller needs to know the order id before the
   * order itself is durably created — checkout.ts does this so it can pass
   * the same id to the Sangu ledger's redemption idempotency key
   * (`redeem:{orderId}`) BEFORE the order row exists. Falls back to the
   * usual auto-generated id when omitted.
   */
  id?: string;
}): Promise<Order> {
  const id = params.id ?? `ord-${Date.now().toString(36)}`;
  const orderNumber = await nextOrderNumber();
  // Cash orders have no transfer to verify — they're confirmed on the spot
  // and settle on delivery. Transfers wait for the proof to be checked.
  const status: OrderStatus = params.paymentMethod === "cash" ? "Confirmed" : "Pending Verification";

  const { rows } = await pool().query<OrderRow>(
    `insert into orders
      (id, order_number, items, user_id, subtotal, currency, customer, payment_method, payment_proof_path, status, boli_redeemed, boli_discount_amount, idempotency_key,
       voucher_code, voucher_boli, voucher_discount_amount, moves_stock)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     returning *`,
    [
      id,
      orderNumber,
      JSON.stringify(params.items),
      params.userId ?? null,
      params.subtotal,
      params.currency,
      JSON.stringify(params.customer),
      params.paymentMethod,
      params.paymentProofPath,
      status,
      params.boliRedeemed ?? null,
      params.boliRedeemed ? (params.boliDiscountAmount ?? null) : null,
      params.idempotencyKey ?? null,
      params.voucherCode ?? null,
      params.voucherBoli ?? null,
      params.voucherDiscountAmount ?? null,
      params.movesStock !== false,
    ]
  );
  // Cash orders land straight on "Confirmed" (see the status assignment
  // above) -- there's no separate admin action that would otherwise cause
  // this deduction, so it has to happen here. Bank-transfer orders start
  // at "Pending Verification" and get deducted later, in
  // updateOrderStatus, when an admin actually confirms them.
  if (status === "Confirmed" && params.movesStock !== false) {
    await adjustStockForItems(params.items, -1, rows[0].id);
  }
  return rowToOrder(rows[0]);
}

/**
 * True when this email has a COMPLETED order containing the product —
 * the bar a customer must clear before they may review it.
 */
export async function hasCompletedPurchase(email: string, productId: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const { rows } = await pool().query<{ exists: boolean }>(
    `select exists(
       select 1 from orders
       where status = 'Completed'
         and lower(customer ->> 'email') = $1
         and items @> jsonb_build_array(jsonb_build_object('productId', $2::text))
     ) as exists`,
    [normalized, productId]
  );
  return rows[0]?.exists ?? false;
}

/**
 * Removes an order permanently.
 *
 * Only the row: reverting the order's EFFECTS (stock back on the shelf, Sangu
 * clawed back) is done by the caller through the ordinary Cancelled
 * transition before this runs -- see deleteOrderAction. Doing it that way
 * means deletion reuses the reversal logic that is already exercised every
 * time a real order is cancelled, rather than growing a second, less-trodden
 * path that has to be kept in step with it.
 *
 * The order's stock_movements go with it (`on delete cascade` on the product
 * reference does not apply here, so they are removed explicitly): once the
 * order is gone the ledger entries reference nothing, and a movement whose
 * source cannot be inspected is worse than no movement at all.
 */
export async function deleteOrder(id: string): Promise<boolean> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query("delete from stock_movements where source_type = 'order' and source_id = $1", [id]);
    const { rowCount } = await client.query("delete from orders where id = $1", [id]);
    await client.query("COMMIT");
    return (rowCount ?? 0) > 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null> {
  // Needs the order's *previous* status to know whether this transition
  // crosses into or out of "stock committed" territory -- e.g. a bank
  // transfer order moving Pending Verification -> Confirmed should deduct
  // now (createOrder only deducts cash orders, which are Confirmed from
  // the start); a Confirmed/Shipped/Completed order moving to Cancelled
  // should give its stock back, or it's gone for good with no order to
  // account for it.
  const before = await getOrderById(id);
  if (!before) return null;

  const { rows } = await pool().query<OrderRow>(
    "update orders set status = $2, updated_at = now() where id = $1 returning *",
    [id, status]
  );
  if (!rows[0]) return null;

  const wasCommitted = STOCK_COMMITTED_STATUSES.has(before.status);
  const isCommitted = STOCK_COMMITTED_STATUSES.has(status);
  // A gift voucher order has no shelf to take anything off. Its lines are not
  // catalogue products, and stock_movements.product_id is a foreign key, so
  // this is not a no-op if attempted -- it fails the whole status change.
  if (!before.movesStock) {
    // nothing to move either way
  } else if (!wasCommitted && isCommitted) {
    await adjustStockForItems(before.items, -1, before.id);
  } else if (wasCommitted && status === "Cancelled") {
    // Only give back what was actually taken. Orders placed before the stock
    // movement ledger existed are Confirmed/Completed but never debited
    // anything, and restoring them invented stock that had never left the
    // shelf -- observed for real: cancelling three legacy orders pushed the
    // catalogue 16 units above its true count. The ledger is the record of
    // what happened, so it is what decides whether there is anything to
    // reverse.
    const { rows: deducted } = await pool().query<{ n: string }>(
      `select count(*) as n from stock_movements
        where source_type = 'order' and source_id = $1 and reason = 'sale'`,
      [before.id]
    );
    if (Number(deducted[0]?.n ?? 0) > 0) {
      await adjustStockForItems(before.items, 1, before.id);
    }
  }

  return rowToOrder(rows[0]);
}
