import fs from "fs";
import path from "path";
import type { Order, OrderCustomer, OrderItem, OrderStatus } from "@/lib/types";

/**
 * File-based order store — same approach and same limitation as
 * lib/data/products.server.ts (JSON-on-disk, not safe for serverless
 * deployment as-is). Orders additionally contain customer PII, so treat this
 * file (and any real DB it's replaced with) as sensitive: it must never be
 * served from a public route or committed with real customer data.
 */

const DATA_PATH = path.join(process.cwd(), "data", "orders.json");

function readAll(): Order[] {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw) as Order[];
}

function writeAll(orders: Order[]) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(orders, null, 2) + "\n", "utf-8");
}

export function getAllOrders(): Order[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getOrderById(id: string): Order | null {
  return readAll().find((o) => o.id === id) ?? null;
}

function nextOrderNumber(existing: Order[]): string {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
  const todayCount = existing.filter((o) => o.orderNumber.includes(datePart)).length;
  return `ATM-${datePart}-${String(todayCount + 1).padStart(4, "0")}`;
}

export function createOrder(params: {
  items: OrderItem[];
  subtotal: number;
  currency: Order["currency"];
  customer: OrderCustomer;
  paymentProofPath: string | null;
}): Order {
  const all = readAll();
  const now = new Date().toISOString();
  const order: Order = {
    id: `ord-${Date.now().toString(36)}`,
    orderNumber: nextOrderNumber(all),
    items: params.items,
    subtotal: params.subtotal,
    currency: params.currency,
    customer: params.customer,
    paymentProofPath: params.paymentProofPath,
    status: "Pending Verification",
    createdAt: now,
    updatedAt: now,
  };
  all.push(order);
  writeAll(all);
  return order;
}

export function updateOrderStatus(id: string, status: OrderStatus): Order | null {
  const all = readAll();
  const index = all.findIndex((o) => o.id === id);
  if (index === -1) return null;

  all[index] = { ...all[index], status, updatedAt: new Date().toISOString() };
  writeAll(all);
  return all[index];
}
