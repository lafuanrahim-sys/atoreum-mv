import fs from "fs";
import path from "path";
import type { Order } from "@/lib/types";

/**
 * Order notification hook for the store owner. No email service is
 * configured in this project, so this logs to the console and appends a
 * line to data/notifications.log — swap the body of this function for a
 * real email/SMS send (e.g. Resend, SendGrid) once one is wired up; nothing
 * else in the app needs to change since callers only depend on this one
 * function.
 */
export function notifyNewOrder(order: Order) {
  const line = `[${order.createdAt}] New order ${order.orderNumber} · ${order.customer.name} (${order.customer.email}, ${order.customer.phone}) · ${order.currency} ${order.subtotal.toLocaleString("en-US")} · ${order.items.length} item(s)`;

  console.log(line);

  try {
    const logPath = path.join(process.cwd(), "data", "notifications.log");
    fs.appendFileSync(logPath, line + "\n", "utf-8");
  } catch {
    // Non-fatal — the order itself is already saved; a missed log line
    // shouldn't fail checkout.
  }
}
