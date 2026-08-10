"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrderById, updateOrderStatus, deleteOrder } from "@/lib/data/orders.server";
import { getUserById, getUserByEmail } from "@/lib/data/users.server";
import { sendOrderReceiptEmail } from "@/lib/email";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import { creditPurchaseEarn, reverseOrder } from "@/lib/boli/ledger.server";
import { flagRefundPatternIfNeeded } from "@/lib/boli/fraud.server";
import type { OrderStatus } from "@/lib/types";

/**
 * Sangu purchase-credit (on the order's first transition to "Completed" —
 * this codebase's equivalent of the spec's "delivered", see
 * lib/boli/schema.sql header) and refund clawback (on transition to
 * "Cancelled") both hang off this one function, since it's the only place
 * order.status is ever written (see lib/data/orders.server.ts,
 * updateOrderStatus — grepped repo-wide, nothing else calls it).
 *
 * Deliberately fire-and-forget-with-logging, not fire-and-block: a Sangu
 * ledger failure (e.g. Supabase not yet provisioned — see docs/BOLI_SPEC.md)
 * must never prevent an admin from managing orders, which is core store
 * functionality that predates and doesn't depend on Sangu.
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
    if (!user) return; // guest checkout, no account — Sangu is account-only

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
    // Never let a Sangu failure block order management — log loudly and move on.
    console.error(`[boli] order status hook failed for ${orderId} (${previousStatus} -> ${nextStatus}):`, err);
  }
}

/**
 * Emails the customer their receipt the first time an order is confirmed.
 *
 * Guarded on the transition, not on the destination status: Confirmed ->
 * Shipped -> back to Confirmed must not send a second receipt, and neither
 * must an admin clicking Confirm twice.
 *
 * Failures are logged, never thrown. SMTP being down is not a reason to leave
 * an order stuck unconfirmed with its stock un-deducted -- the confirmation is
 * the real event, the email is a notification about it. The same reasoning the
 * Sangu hook above already uses.
 */
async function sendReceiptOnConfirm(orderId: string, previousStatus: OrderStatus, nextStatus: OrderStatus) {
  if (nextStatus !== "Confirmed" || previousStatus === "Confirmed") return;
  try {
    const order = await getOrderById(orderId);
    if (!order?.customer.email) return;
    const result = await sendOrderReceiptEmail({
      to: order.customer.email,
      name: order.customer.name,
      order,
    });
    if ("error" in result) {
      console.error(`[receipt] ${order.orderNumber} -> ${order.customer.email} failed:`, result.error);
    } else {
      console.log(`[receipt] ${order.orderNumber} sent to ${order.customer.email}`);
    }
  } catch (err) {
    console.error(`[receipt] order ${orderId} receipt failed:`, err);
  }
}

export async function changeOrderStatus(orderId: string, status: OrderStatus) {
  // Server actions are public endpoints — role-check inside, not just at the page.
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) redirect("/login");

  const previous = await getOrderById(orderId);
  // updateOrderStatus is also what deducts stock, through the movement
  // ledger, on the transition into Confirmed/Shipped/Completed -- and puts it
  // back if a committed order is later cancelled.
  await updateOrderStatus(orderId, status);
  if (previous) {
    await runBoliHook(orderId, previous.status, status);
    await sendReceiptOnConfirm(orderId, previous.status, status);
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/preorders");
  revalidatePath("/dashboard");
  // Customers see status (and gain review rights on completion) on these.
  revalidatePath("/account");
}

/**
 * Deletes an order and undoes what it did.
 *
 * The revert runs FIRST, and it runs by cancelling the order through the
 * normal path rather than by reversing things by hand:
 *
 *   - stock goes back on the shelf, through the movement ledger
 *   - purchase Sangu is clawed back, and a redemption is returned
 *
 * Reusing the Cancelled transition matters. It is the same code that runs
 * every time a real order is cancelled, so it stays correct by being used;
 * a bespoke unwind here would be a second path that quietly drifts out of
 * step with the first. An order that is already Cancelled has been reverted
 * already and is simply removed.
 *
 * Irreversible, and deliberately not offered for anything but a mistake:
 * a genuine order that was placed and refunded should be Cancelled and KEPT,
 * because the money moved and the record of it is the point. Deleting is for
 * test rows and orders created in error.
 */
export async function deleteOrderAction(orderId: string) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) redirect("/login");

  const order = await getOrderById(orderId);
  if (!order) return;

  if (order.status !== "Cancelled") {
    await updateOrderStatus(orderId, "Cancelled");
    await runBoliHook(orderId, order.status, "Cancelled");
  }
  await deleteOrder(orderId);

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/preorders");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard/products");
  revalidatePath("/products");
  revalidatePath("/account");
}
