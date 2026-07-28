import { pool } from "@/lib/db";
import type { Order, OrderCustomer, OrderItem, OrderStatus, PaymentMethod } from "@/lib/types";

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
  created_at: string;
  updated_at: string;
};

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
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

export async function createOrder(params: {
  items: OrderItem[];
  subtotal: number;
  currency: Order["currency"];
  customer: OrderCustomer;
  paymentMethod: PaymentMethod;
  paymentProofPath: string | null;
  /** The signed-in account placing this order, if any — see the field comment on Order.userId in lib/types.ts. */
  userId?: string;
  /** Already-validated-and-applied Boli redemption receipt (see app/actions/checkout.ts) — omit for orders that redeemed nothing. */
  boliRedeemed?: number;
  boliDiscountAmount?: number;
  /**
   * Pre-generated id, when the caller needs to know the order id before the
   * order itself is durably created — checkout.ts does this so it can pass
   * the same id to the Boli ledger's redemption idempotency key
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
      (id, order_number, items, user_id, subtotal, currency, customer, payment_method, payment_proof_path, status, boli_redeemed, boli_discount_amount)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
    ]
  );
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

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null> {
  const { rows } = await pool().query<OrderRow>(
    "update orders set status = $2, updated_at = now() where id = $1 returning *",
    [id, status]
  );
  return rows[0] ? rowToOrder(rows[0]) : null;
}
