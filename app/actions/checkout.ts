"use server";

import path from "path";
import crypto from "crypto";
import { headers } from "next/headers";
import { createOrder, getOrderByIdempotencyKey } from "@/lib/data/orders.server";
import { getProductById } from "@/lib/data/products.server";
import { notifyNewOrder } from "@/lib/notify";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { parseBoliAmount, redeemForOrder } from "@/lib/boli/ledger.server";
import { BOLI_TO_MVR } from "@/lib/boli/config";
import { uploadPublicFile, PAYMENT_PROOFS_BUCKET } from "@/lib/storage";
import { orderAccessToken } from "@/lib/orderAccessToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { normalizeVoucherCode } from "@/lib/vouchers/code";
import { redeemVoucher, reverseVoucherForOrder } from "@/lib/vouchers/vouchers.server";
import { VOUCHERS_ENABLED } from "@/lib/vouchers/feature";
import type { Order, OrderItem, PaymentMethod } from "@/lib/types";

export type CheckoutResult =
  | { ok: true; orderId: string; accessToken: string }
  | { ok: false; error: string };

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
// HEIC/HEIF included for iPhone camera photos; some browsers report an empty
// MIME type for them, so the extension check below is the real gate.
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
const ALLOWED_EXT = /\.(jpe?g|png|webp|heic|heif|pdf)$/i;

async function clientIp(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function submitOrder(formData: FormData): Promise<CheckoutResult> {
  // Guest checkout allowed, so this can only be keyed on IP -- bounds
  // automated order/upload spam without limiting a real shopper placing a
  // normal handful of orders.
  if (!checkRateLimit(`checkout:ip:${await clientIp()}`, 8, 600)) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  // Capped rather than rejected: a customer pasting an essay should still get
  // their order through, and 2000 characters is far more than any real
  // delivery instruction while still bounding what reaches the database, the
  // notification and the invoice.
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000);
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim().slice(0, 100) || null;
  const itemsRaw = String(formData.get("items") ?? "[]");

  if (!name || !email || !phone || !address) {
    return { ok: false, error: "Please fill in all shipping/contact fields." };
  }

  let items: OrderItem[];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { ok: false, error: "Your cart data couldn't be read. Please try again." };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  // A second submission of the same checkout is the same order, not a new one.
  //
  // This has happened for real: two orders four seconds apart, same customer,
  // each with its own uploaded transfer receipt. The button had already been
  // re-enabled while the browser was still navigating away, so a second click
  // landed here and was honoured. The client no longer re-enables it, but a
  // double-submit can also come from a retried request or an impatient
  // refresh, and only the server can settle it. Checked before the upload and
  // before any Sangu is moved, so a repeat costs nothing.
  if (idempotencyKey) {
    const existing = await getOrderByIdempotencyKey(idempotencyKey);
    if (existing) {
      return { ok: true, orderId: existing.id, accessToken: orderAccessToken(existing.id) };
    }
  }

  // Re-price every line from the database before anything is totalled.
  //
  // What arrives here is cart JSON the browser posted, `price` included, and
  // until now the subtotal was computed straight from it — so a customer who
  // edited the payload paid whatever they typed. Adding discounts made that
  // impossible to leave alone: "the discounted price is what we charge" can
  // only be true if the server decides the price, and the only authority on
  // the discounted price is products.price_effective, a generated column.
  //
  // Quantities still come from the client (they are the customer's to choose);
  // prices, names and currency no longer do.
  const priced: OrderItem[] = [];
  for (const item of items) {
    const quantity = Math.floor(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) {
      return { ok: false, error: "That quantity isn't valid. Please review your cart." };
    }
    const product = await getProductById(String(item.productId ?? ""));
    if (!product) {
      return { ok: false, error: "One of the items in your cart is no longer available. Please review your cart." };
    }
    if (product.stockStatus === "out-of-stock") {
      return { ok: false, error: `${product.name} is out of stock. Please remove it from your cart.` };
    }
    priced.push({
      productId: product.id,
      name: product.name,
      price: product.priceEffective,
      // Only recorded when there is a discount, so a full-price line stays
      // exactly the shape it has always been.
      //
      // listPrice is what carries the saving onto the receipt and the tax
      // invoice -- both derive the discount from (listPrice - price), so a
      // flat discount has to set it just as a percentage one does. The
      // percentage is recorded only when that is how the offer was expressed;
      // back-computing one from a flat sum would print "-23.5%" on an invoice
      // for an offer the customer was told was "MVR 100 off".
      ...(product.discountPercent > 0 || product.discountAmount > 0
        ? {
            listPrice: product.price,
            ...(product.discountPercent > 0 ? { discountPercent: product.discountPercent } : {}),
          }
        : {}),
      currency: product.currency,
      quantity,
      image: product.images[0] ?? null,
    });
  }
  items = priced;

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const currency = items[0].currency;

  const methodRaw = String(formData.get("paymentMethod") ?? "");
  if (methodRaw !== "cash" && methodRaw !== "transfer") {
    return { ok: false, error: "Please choose a payment method." };
  }
  const paymentMethod: PaymentMethod = methodRaw;

  // Cash on delivery needs no receipt; bank transfers must include one so the
  // store can verify the payment before confirming the order.
  let paymentProofPath: string | null = null;
  if (paymentMethod === "transfer") {
    const proofFile = formData.get("paymentProof");
    if (!(proofFile instanceof File) || proofFile.size === 0) {
      return { ok: false, error: "Please upload your transfer receipt to place the order." };
    }
    if (proofFile.size > MAX_FILE_BYTES) {
      return { ok: false, error: "Payment proof file is too large (max 8MB)." };
    }
    if (!ALLOWED_TYPES.includes(proofFile.type) && !ALLOWED_EXT.test(proofFile.name)) {
      return { ok: false, error: "Payment proof must be a JPG, PNG, WEBP, HEIC, or PDF." };
    }

    const ext = path.extname(proofFile.name) || "";
    const safeName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const bytes = Buffer.from(await proofFile.arrayBuffer());
    paymentProofPath = await uploadPublicFile({
      bucket: PAYMENT_PROOFS_BUCKET,
      path: safeName,
      bytes,
      contentType: proofFile.type || "application/octet-stream",
    });
  }

  // Resolved once, unconditionally — not just when redeeming Sangu. Account
  // linkage must never depend on the shipping-form email matching the
  // login email (they're allowed to differ, e.g. ordering for someone
  // else): a signed-in checkout is always attributed to the session's
  // account id, regardless of what contact email was typed.
  const currentUser = await getCurrentUser();

  // Sangu redemption is opt-in and account-only: the checkout form only
  // renders the widget for a signed-in user, but a guest could still post
  // the field, so this is re-validated server-side regardless of what the
  // client sent (spec §6.4 — never trust the client).
  const boliRedeemRaw = formData.get("boliRedeem");
  let boliRedeemedAmount: number | undefined;
  let boliDiscountMvr: number | undefined;
  // Generated up front (rather than left to createOrder's own default) so
  // the same id can be handed to the Sangu ledger's redemption idempotency
  // key (`redeem:{orderId}`) before the order row itself exists — see
  // lib/data/orders.server.ts createOrder() for why this is a param.
  const orderId = `ord-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;

  if (boliRedeemRaw) {
    const amount = parseBoliAmount(boliRedeemRaw);
    if (amount === null) {
      return { ok: false, error: "That Sangu amount isn't valid." };
    }
    if (!currentUser) {
      return { ok: false, error: "Sign in to redeem Sangu." };
    }
    const result = await redeemForOrder({
      userId: currentUser.id,
      orderId,
      boliAmount: amount,
      orderSubtotalMvr: subtotal,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    boliRedeemedAmount = Number(amount);
    boliDiscountMvr = result.mvrValue;
  }

  // Gift voucher, applied after any Sangu redemption.
  //
  // Deliberately NOT subject to the 30%-of-subtotal cap or the 1,000 minimum
  // that govern Sangu. Those exist so loyalty points cannot replace revenue;
  // a voucher is not loyalty, it is money the shop has already been paid, at
  // par. Capping it would leave a customer holding credit they bought and
  // cannot spend.
  //
  // Spent against the order id that is about to be used, so if createOrder
  // fails below the spend is handed straight back (see the catch).
  // Ignored entirely while the feature is off, so a posted code cannot spend
  // anything even though no field on the page offers to send one.
  const voucherCode = VOUCHERS_ENABLED
    ? normalizeVoucherCode(String(formData.get("voucherCode") ?? ""))
    : "";
  let voucherBoli = 0;
  let voucherDiscountMvr = 0;
  if (voucherCode) {
    const payable = Math.max(0, subtotal - (boliDiscountMvr ?? 0));
    const wantBoli = Math.floor(payable / BOLI_TO_MVR);
    if (wantBoli > 0) {
      try {
        voucherBoli = await redeemVoucher({
          code: voucherCode,
          orderId,
          wantBoli,
          redeemer: { name, email, phone },
        });
        voucherDiscountMvr = Math.round(voucherBoli * BOLI_TO_MVR * 100) / 100;
      } catch (err) {
        // Postgres raises these with customer-readable text on purpose --
        // "voucher has expired", "voucher has no balance left".
        const message = String((err as Error).message ?? "").replace(/^.*voucher_redeem: /, "");
        return { ok: false, error: message || "That voucher couldn't be applied." };
      }
    }
  }

  let order: Order;
  try {
    order = await createOrder({
      id: orderId,
      items,
      subtotal,
      currency,
      customer: { name, email, phone, address, ...(notes ? { notes } : {}) },
      paymentMethod,
      paymentProofPath,
      userId: currentUser?.id,
      boliRedeemed: boliRedeemedAmount,
      boliDiscountAmount: boliDiscountMvr,
      idempotencyKey,
      voucherCode: voucherCode || null,
      voucherBoli: voucherBoli || null,
      voucherDiscountAmount: voucherDiscountMvr || null,
    });
  } catch (err) {
    // The voucher was spent a moment ago against an order that now does not
    // exist. Hand it straight back, or the customer has paid for credit that
    // vanished into a failed insert.
    if (voucherBoli > 0) {
      await reverseVoucherForOrder(orderId).catch((e) =>
        console.error(`[voucher] could not reverse ${voucherCode} for failed order ${orderId}:`, e)
      );
    }
    // Two requests that both got past the check above race to insert; the
    // unique index lets exactly one win. The loser isn't an error to show the
    // customer -- their order exists, it just wasn't this request that made
    // it. Anything other than that collision is a real failure and rethrows.
    const existing = idempotencyKey && (err as { code?: string }).code === "23505"
      ? await getOrderByIdempotencyKey(idempotencyKey)
      : null;
    if (!existing) throw err;
    return { ok: true, orderId: existing.id, accessToken: orderAccessToken(existing.id) };
  }

  notifyNewOrder(order);

  return { ok: true, orderId: order.id, accessToken: orderAccessToken(order.id) };
}
