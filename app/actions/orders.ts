"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrderById, updateOrderStatus } from "@/lib/data/orders.server";
import { getUserById, getUserByEmail } from "@/lib/data/users.server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import { creditPurchaseEarn, reverseOrder } from "@/lib/boli/ledger.server";
import { flagRefundPatternIfNeeded } from "@/lib/boli/fraud.server";
import type { OrderStatus } from "@/lib/types";

/**
 * Boli purchase-credit (on the order's first transition to "Completed" —
 * this codebase's equivalent of the spec's "delivered", see
 * lib/boli/schema.sql header) and refund clawback (on transition to
 * "Cancelled") both hang off this one function, since it's the only place
 * order.status is ever written (see lib/data/orders.server.ts,
 * updateOrderStatus — grepped repo-wide, nothing else calls it).
 *
 * Deliberately fire-and-forget-with-logging, not fire-and-block: a Boli
 * ledger failure (e.g. Supabase not yet provisioned — see docs/BOLI_SPEC.md)
 * must never prevent an admin from managing orders, which is core store
 * functionality that predates and doesn't depend on Boli.
 */
async function runBoliHook(orderId: string, previousStatus: OrderStatus, nextStatus: OrderStatus) {
  if (previousStatus === nextStatus) return; // no real transition — nothing to do

  try {
    const order = await getOrderById(orderId);
    if (!order) return;

    // userId (set at checkout from the session) is authoritative — it
    // survives the shipping-form email differing from the account's login
    // email. Falls back to email match for orders placed before userId
    // existed.
    const user = (order.userId ? await getUserById(order.userId) : null) ?? (await getUserByEmail(order.customer.email));
    if (!user) return; // guest checkout, no account — Boli is account-only

    if (nextStatus === "Completed" && previousStatus !== "Completed") {
      await creditPurchaseEarn({
        userId: user.id,
        orderId: order.id,
        orderSubtotalMvr: order.subtotal,
        boliDiscountMvr: order.boliDiscountAmount ?? 0,
      });
    } else if (nextStatus === "Cancelled" && previousStatus !== "Cancelled") {
      const { clawback } = await reverseOrder({ userId: user.id, orderId: order.id });
      // Only a real earn-clawback counts as a "refund" for the fraud
      // pattern check (BOLI_SPEC.md §6.2) — an order cancelled before it
      // ever earned anything isn't a refund-abuse signal.
      if (clawback) await flagRefundPatternIfNeeded(user.id);
    }
  } catch (err) {
    // Never let a Boli failure block order management — log loudly and move on.
    console.error(`[boli] order status hook failed for ${orderId} (${previousStatus} -> ${nextStatus}):`, err);
  }
}

export async function changeOrderStatus(orderId: string, status: OrderStatus) {
  // Server actions are public endpoints — role-check inside, not just at the page.
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) redirect("/login");

  const previous = await getOrderById(orderId);
  await updateOrderStatus(orderId, status);
  if (previous) await runBoliHook(orderId, previous.status, status);

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/preorders");
  revalidatePath("/dashboard");
  // Customers see status (and gain review rights on completion) on these.
  revalidatePath("/account");
}
