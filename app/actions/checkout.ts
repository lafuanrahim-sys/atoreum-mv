"use server";

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { createOrder } from "@/lib/data/orders.server";
import { notifyNewOrder } from "@/lib/notify";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { parseBoliAmount, redeemForOrder } from "@/lib/boli/ledger.server";
import type { OrderItem, PaymentMethod } from "@/lib/types";

export type CheckoutResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "payment-proofs");
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
// HEIC/HEIF included for iPhone camera photos; some browsers report an empty
// MIME type for them, so the extension check below is the real gate.
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
const ALLOWED_EXT = /\.(jpe?g|png|webp|heic|heif|pdf)$/i;

export async function submitOrder(formData: FormData): Promise<CheckoutResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
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

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const ext = path.extname(proofFile.name) || "";
    const safeName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const bytes = Buffer.from(await proofFile.arrayBuffer());
    await fs.writeFile(path.join(UPLOAD_DIR, safeName), bytes);
    paymentProofPath = `/uploads/payment-proofs/${safeName}`;
  }

  // Resolved once, unconditionally — not just when redeeming Boli. Account
  // linkage must never depend on the shipping-form email matching the
  // login email (they're allowed to differ, e.g. ordering for someone
  // else): a signed-in checkout is always attributed to the session's
  // account id, regardless of what contact email was typed.
  const currentUser = await getCurrentUser();

  // Boli redemption is opt-in and account-only: the checkout form only
  // renders the widget for a signed-in user, but a guest could still post
  // the field, so this is re-validated server-side regardless of what the
  // client sent (spec §6.4 — never trust the client).
  const boliRedeemRaw = formData.get("boliRedeem");
  let boliRedeemedAmount: number | undefined;
  let boliDiscountMvr: number | undefined;
  // Generated up front (rather than left to createOrder's own default) so
  // the same id can be handed to the Boli ledger's redemption idempotency
  // key (`redeem:{orderId}`) before the order row itself exists — see
  // lib/data/orders.server.ts createOrder() for why this is a param.
  const orderId = `ord-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;

  if (boliRedeemRaw) {
    const amount = parseBoliAmount(boliRedeemRaw);
    if (amount === null) {
      return { ok: false, error: "That Boli amount isn't valid." };
    }
    if (!currentUser) {
      return { ok: false, error: "Sign in to redeem Boli." };
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

  const order = createOrder({
    id: orderId,
    items,
    subtotal,
    currency,
    customer: { name, email, phone, address },
    paymentMethod,
    paymentProofPath,
    userId: currentUser?.id,
    boliRedeemed: boliRedeemedAmount,
    boliDiscountAmount: boliDiscountMvr,
  });

  notifyNewOrder(order);

  return { ok: true, orderId: order.id };
}
