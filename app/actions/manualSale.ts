"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import { createOrder, updateOrderStatus } from "@/lib/data/orders.server";
import { getProductById } from "@/lib/data/products.server";
import type { OrderItem, PaymentMethod } from "@/lib/types";
import { ORDER_CHANNELS, type OrderChannel } from "@/lib/data/orderChannels";

/**
 * An order taken by hand: an Instagram message, a phone call, someone asking
 * in the shop.
 *
 * It goes through createOrder like any other, deliberately. A sale entered
 * here deducts the same stock, takes the next order number, enters the same
 * invoice run and appears in the same totals at the end of the month. The only
 * thing that distinguishes it is `source: "manual"`, which exists so the shop
 * can answer "how much does Instagram actually bring in" without having to
 * remember which orders were which.
 *
 * PRICES ARE NOT TAKEN FROM THE FORM. The browser sends product ids and
 * quantities; every price is read from the catalogue here. That is the same
 * rule the customer-facing checkout follows, and it matters as much for an
 * admin form: a mistyped price would flow into the tax invoice and the
 * month's figures, and nobody would notice until they disagreed.
 */

export type ManualSaleResult = { ok: true; orderId: string } | { ok: false; error: string };

/** A line as the form sends it: what, and how many. Nothing about money. */
type LineInput = { productId: string; quantity: number };

function parseLines(raw: FormDataEntryValue | null): LineInput[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((l) => ({
        productId: String((l as LineInput)?.productId ?? "").trim(),
        quantity: Math.trunc(Number((l as LineInput)?.quantity ?? 0)),
      }))
      .filter((l) => l.productId && l.quantity > 0 && l.quantity <= 999);
  } catch {
    return [];
  }
}

export async function createManualSaleAction(formData: FormData): Promise<ManualSaleResult> {
  const admin = await getCurrentUser();
  if (!admin || !isAdminRole(admin.role)) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const channelRaw = String(formData.get("channel") ?? "");
  const methodRaw = String(formData.get("paymentMethod") ?? "");
  const markPaid = formData.get("markPaid") === "on";

  if (!name || !phone || !address) {
    return { ok: false, error: "Name, phone and address are all needed." };
  }
  if (methodRaw !== "cash" && methodRaw !== "transfer") {
    return { ok: false, error: "Choose how they are paying." };
  }
  const paymentMethod: PaymentMethod = methodRaw;

  // Validated against the shared list rather than trusted, because it goes
  // into a checked column and a value the constraint refuses would fail the
  // insert after the stock had already been reasoned about.
  const channel = ORDER_CHANNELS.find((c) => c.value === channelRaw)?.value as OrderChannel | undefined;
  if (!channel) {
    return { ok: false, error: "Choose where this order came from." };
  }

  const lines = parseLines(formData.get("lines"));
  if (lines.length === 0) {
    return { ok: false, error: "Add at least one product." };
  }

  // Priced from the catalogue, never from the form. Also the only place an
  // unknown or out-of-stock product is caught.
  const items: OrderItem[] = [];
  for (const line of lines) {
    const product = await getProductById(line.productId);
    if (!product) {
      return { ok: false, error: `No product with the id "${line.productId}".` };
    }
    if (product.stockStatus === "out-of-stock") {
      return { ok: false, error: `${product.name} is out of stock.` };
    }
    items.push({
      productId: product.id,
      name: product.name,
      price: product.priceEffective,
      // The saving is snapshotted the same way checkout does it, so a manual
      // sale's invoice shows the discount rather than a quietly lower price.
      ...(product.discountPercent > 0 || product.discountAmount > 0
        ? {
            listPrice: product.price,
            ...(product.discountPercent > 0 ? { discountPercent: product.discountPercent } : {}),
          }
        : {}),
      currency: product.currency,
      quantity: line.quantity,
      image: product.images[0] ?? null,
    });
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const order = await createOrder({
    id: `ord-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`,
    items,
    subtotal,
    currency: items[0].currency,
    customer: { name, email, phone, address, ...(notes ? { notes } : {}) },
    paymentMethod,
    paymentProofPath: null,
    source: channel,
  });

  /**
   * Confirming, when the money is already in.
   *
   * An Instagram sale is usually paid before it is entered -- the transfer
   * came in, then someone typed it up. Left at Pending Verification it would
   * sit in the dashboard waiting for a verification that already happened, and
   * no invoice would be issued for a sale that is complete.
   *
   * Routed through updateOrderStatus rather than inserting as Confirmed, so it
   * takes the same path as the Confirm button: the invoice number is issued,
   * stock moves, and the Sangu and voucher hooks see the transition.
   */
  if (markPaid && order.status !== "Confirmed") {
    await updateOrderStatus(order.id, "Confirmed");
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  return { ok: true, orderId: order.id };
}
