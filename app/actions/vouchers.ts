"use server";

import path from "path";
import crypto from "crypto";
import { headers } from "next/headers";
import { createOrder } from "@/lib/data/orders.server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { uploadPublicFile, PAYMENT_PROOFS_BUCKET } from "@/lib/storage";
import { orderAccessToken } from "@/lib/orderAccessToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { normalizeVoucherCode } from "@/lib/vouchers/code";
import {
  createPendingVoucher,
  previewVoucher,
  voucherPriceMvr,
  VOUCHER_DENOMINATIONS_BOLI,
} from "@/lib/vouchers/vouchers.server";
import type { PaymentMethod } from "@/lib/types";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
const ALLOWED_EXT = /\.(jpe?g|png|webp|heic|heif|pdf)$/i;

async function clientIp(): Promise<string> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export type VoucherPurchaseResult =
  | { ok: true; orderId: string; accessToken: string }
  | { ok: false; error: string };

/**
 * Buy a gift voucher.
 *
 * Signed-in only, and not because of a UI preference: the purchaser is where
 * an unspent remainder goes home to when the voucher expires. A voucher with
 * no account behind it would have nowhere to return value to, so there is no
 * guest path here at all -- the check is the first thing this function does.
 *
 * The voucher is created 'pending'. It buys nothing until the order reaches
 * Confirmed, which for a bank transfer means an admin has actually looked at
 * the receipt. That ordering is the whole defence against a fabricated
 * transfer slip turning into spendable credit.
 */
export async function purchaseVoucherAction(formData: FormData): Promise<VoucherPurchaseResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Please sign in to buy a gift voucher." };
  }

  if (!checkRateLimit(`voucher:buy:${user.id}`, 10, 3600)) {
    return { ok: false, error: "Too many voucher purchases in a row. Please try again later." };
  }

  const faceValueBoli = Number(formData.get("faceValueBoli"));
  if (!VOUCHER_DENOMINATIONS_BOLI.includes(faceValueBoli as (typeof VOUCHER_DENOMINATIONS_BOLI)[number])) {
    return { ok: false, error: "Choose one of the available voucher amounts." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000);
  if (!name || !email || !phone) {
    return { ok: false, error: "Please fill in your name, email and phone." };
  }

  const methodRaw = String(formData.get("paymentMethod") ?? "");
  if (methodRaw !== "cash" && methodRaw !== "transfer") {
    return { ok: false, error: "Please choose a payment method." };
  }
  const paymentMethod: PaymentMethod = methodRaw;

  let paymentProofPath: string | null = null;
  if (paymentMethod === "transfer") {
    const proofFile = formData.get("paymentProof");
    if (!(proofFile instanceof File) || proofFile.size === 0) {
      return { ok: false, error: "Please upload your transfer receipt." };
    }
    if (proofFile.size > MAX_FILE_BYTES) {
      return { ok: false, error: "Payment proof file is too large (max 8MB)." };
    }
    if (!ALLOWED_TYPES.includes(proofFile.type) && !ALLOWED_EXT.test(proofFile.name)) {
      return { ok: false, error: "Payment proof must be a JPG, PNG, WEBP, HEIC, or PDF." };
    }
    const ext = path.extname(proofFile.name) || "";
    paymentProofPath = await uploadPublicFile({
      bucket: PAYMENT_PROOFS_BUCKET,
      path: `${Date.now()}-${crypto.randomUUID()}${ext}`,
      bytes: Buffer.from(await proofFile.arrayBuffer()),
      contentType: proofFile.type || "application/octet-stream",
    });
  }

  // Priced server-side from the denomination alone. Nothing about the amount
  // comes from the form except which of the four fixed options was chosen.
  const price = voucherPriceMvr(faceValueBoli);
  const orderId = `ord-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;

  const order = await createOrder({
    id: orderId,
    items: [
      {
        productId: `gift-voucher-${faceValueBoli}`,
        name: `Gift Voucher (${faceValueBoli.toLocaleString("en-US")} Sangu)`,
        price,
        currency: "MVR",
        quantity: 1,
        image: null,
      },
    ],
    subtotal: price,
    currency: "MVR",
    customer: { name, email, phone, address: "Gift voucher, nothing to deliver", ...(notes ? { notes } : {}) },
    paymentMethod,
    paymentProofPath,
    userId: user.id,
    // A voucher is not a stockable good; see createOrder.
    movesStock: false,
    // ...and not a sale of goods, so it takes a number from its own run.
    invoiceSeries: "GVINV",
  });

  await createPendingVoucher({
    purchaserUserId: user.id,
    orderId: order.id,
    faceValueBoli,
  });

  return { ok: true, orderId: order.id, accessToken: orderAccessToken(order.id) };
}

/**
 * What a code is worth, for the checkout preview.
 *
 * Rate-limited per IP even though 80 bits of entropy already makes guessing
 * hopeless -- the limit is there so a script cannot turn this into a free
 * oracle, and so the answer stays cheap to serve. Every failure returns the
 * same message: a prober learns "not usable", never whether a code exists.
 */
export async function checkVoucherAction(
  rawCode: string
): Promise<{ ok: true; balanceBoli: number; discountMvr: number } | { ok: false; error: string }> {
  if (!checkRateLimit(`voucher:check:${await clientIp()}`, 20, 600)) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const code = normalizeVoucherCode(rawCode);
  const unusable = { ok: false as const, error: "That code isn't valid, or has no balance left." };
  if (!code) return unusable;

  const found = await previewVoucher(code);
  if (!found) return unusable;

  return {
    ok: true,
    balanceBoli: found.balanceBoli,
    discountMvr: Math.round(found.balanceBoli * 0.01 * 100) / 100,
  };
}
