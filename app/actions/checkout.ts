"use server";

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { createOrder } from "@/lib/data/orders.server";
import { notifyNewOrder } from "@/lib/notify";
import type { OrderItem } from "@/lib/types";

export type CheckoutResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "payment-proofs");
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

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

  // Payment proof is optional at submission time — customers often need to
  // actually go complete the bank transfer after filling out this form, not
  // during it, so we don't block order creation on having the file yet.
  // Judgment call: flagged for review, see chat summary.
  let paymentProofPath: string | null = null;
  const proofFile = formData.get("paymentProof");
  if (proofFile instanceof File && proofFile.size > 0) {
    if (proofFile.size > MAX_FILE_BYTES) {
      return { ok: false, error: "Payment proof file is too large (max 8MB)." };
    }
    if (!ALLOWED_TYPES.includes(proofFile.type)) {
      return { ok: false, error: "Payment proof must be a JPG, PNG, WEBP, or PDF." };
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const ext = path.extname(proofFile.name) || "";
    const safeName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const bytes = Buffer.from(await proofFile.arrayBuffer());
    await fs.writeFile(path.join(UPLOAD_DIR, safeName), bytes);
    paymentProofPath = `/uploads/payment-proofs/${safeName}`;
  }

  const order = createOrder({
    items,
    subtotal,
    currency,
    customer: { name, email, phone, address },
    paymentProofPath,
  });

  notifyNewOrder(order);

  return { ok: true, orderId: order.id };
}
