import fs from "fs";
import { after } from "next/server";
import path from "path";
import type { Order } from "@/lib/types";
import { buildInvoice, formatMoney } from "@/lib/invoice";
import { escapeTelegramHtml, sendTelegramMessage } from "@/lib/telegram";

/**
 * Order notification hook for the store owner: a Telegram message, plus a
 * console line and an append to data/notifications.log as a local trail.
 *
 * The file write is best-effort and stays that way — Vercel's filesystem is
 * read-only, so in production it simply fails and is ignored while the
 * Telegram send does the real work.
 */

/** The message the owner actually reads, at a glance, on their phone. */
export function renderOrderTelegramMessage(order: Order): string {
  const invoice = buildInvoice(order);
  const esc = escapeTelegramHtml;
  const lines = order.items
    .map((i) => `• ${esc(i.name)} × ${i.quantity}`)
    .join("\n");

  // Deliberately includes the GST split. The owner files these, and knowing
  // the tax on a sale at the moment it lands is more useful than knowing it
  // at the end of the month.
  return [
    `🧾 <b>New order ${esc(order.orderNumber)}</b>`,
    "",
    lines,
    "",
    `Subtotal: ${esc(formatMoney(invoice.grossSubtotal, invoice.currency))}`,
    invoice.discount > 0 ? `Sangu: −${esc(formatMoney(invoice.discount, invoice.currency))}` : null,
    invoice.voucherApplied > 0 ? `Gift voucher: −${esc(formatMoney(invoice.voucherApplied, invoice.currency))}` : null,
    `GST 8%: ${esc(formatMoney(invoice.gstTotal, invoice.currency))}`,
    `<b>Total: ${esc(formatMoney(invoice.grossTotal, invoice.currency))}</b>`,
    "",
    `👤 ${esc(order.customer.name)}`,
    `📞 ${esc(order.customer.phone)}`,
    `📍 ${esc(order.customer.address)}`,
    `💳 ${order.paymentMethod === "cash" ? "Cash on delivery" : "Bank transfer"}`,
    order.customer.notes ? `
📝 <b>Note:</b> ${esc(order.customer.notes)}` : null,
    "",
    `Awaiting confirmation in the dashboard.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function notifyNewOrder(order: Order) {
  const line = `[${order.createdAt}] New order ${order.orderNumber} · ${order.customer.name} (${order.customer.email}, ${order.customer.phone}) · ${order.currency} ${order.subtotal.toLocaleString("en-US")} · ${order.items.length} item(s)`;

  console.log(line);

  // after(), not a bare floating promise. The customer should not wait on
  // Telegram to see their confirmation, but on serverless a promise left
  // running when the response is sent can be killed with the function --
  // "fire and forget" quietly becomes "fire and maybe never happen", and the
  // owner silently stops being told about orders. after() hands the work to
  // the platform, which keeps the invocation alive until it finishes.
  //
  // Wrapped, because after() throws outside a request scope and this is also
  // reachable from scripts and tests.
  const send = () => sendTelegramMessage(renderOrderTelegramMessage(order));
  try {
    after(send);
  } catch {
    void send();
  }

  try {
    const logPath = path.join(process.cwd(), "data", "notifications.log");
    fs.appendFileSync(logPath, line + "\n", "utf-8");
  } catch {
    // Non-fatal — the order itself is already saved; a missed log line
    // shouldn't fail checkout.
  }
}
