"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrderById, updateOrderStatus, deleteOrder } from "@/lib/data/orders.server";
import { getUserById } from "@/lib/data/users.server";
import { sendOrderReceiptEmail } from "@/lib/email";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import { creditPurchaseEarn, reverseOrder } from "@/lib/boli/ledger.server";
import { flagRefundPatternIfNeeded } from "@/lib/boli/fraud.server";
import { activateVoucherForOrder, reverseVoucherForOrder } from "@/lib/vouchers/vouchers.server";
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

    // userId, set at checkout from the session, is the ONLY link between an
    // order and a Sangu account.
    //
    // There used to be a fallback that matched order.customer.email against
    // the account list. It meant a guest checkout typed with a registered
    // address credited that account -- so guests did accumulate Sangu, just
    // into someone else's balance, and anyone could push Sangu into any
    // account they knew the email of without ever signing in. An order
    // belongs to an account because a session said so, or it belongs to no
    // account at all.
    const user = order.userId ? await getUserById(order.userId) : null;
    if (!user) return; // guest checkout — Sangu is account-only, by design

    // A gift voucher purchase earns nothing.
    //
    // Sangu is a give-back on money spent ON GOODS. A voucher is not spent
    // yet -- it is credit, and the goods it eventually buys earn their own
    // Sangu for whoever buys them. Paying out on both ends would mint Sangu
    // from the same rufiyaa twice, and would reward buying vouchers over
    // buying anything. Observed for real before this: a MVR 10 voucher
    // purchase credited 20 Sangu.
    if (order.invoiceSeries === "GVINV") return;

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

/**
 * The two things an order status change means for gift vouchers.
 *
 * Confirmed  -> a voucher this order BOUGHT becomes spendable. This is the
 *               gate: until an admin has seen the payment, the code the buyer
 *               is holding buys nothing.
 * Cancelled  -> a voucher this order SPENT gets its balance back, onto the
 *               voucher itself rather than into anyone's Sangu. The recipient
 *               keeps the gift, the buyer is not paid twice.
 *
 * Both are idempotent in the database, so a repeated transition is harmless.
 * Failures are logged and swallowed for the same reason the Sangu hook does
 * it: a voucher problem must not block an admin from managing orders.
 */
/** Statuses that mean the purchase has been paid for. */
const VOUCHER_SETTLED_STATUSES: ReadonlySet<OrderStatus> = new Set(["Confirmed", "Shipped", "Completed"]);

async function runVoucherHook(orderId: string, previousStatus: OrderStatus, nextStatus: OrderStatus) {
  if (previousStatus === nextStatus) return;
  try {
    // Any status that means the money is settled activates the voucher, not
    // Confirmed alone. The status dropdown can move an order straight from
    // Pending Verification to Completed, and an admin doing that has plainly
    // decided they have been paid -- gating on Confirmed only would leave the
    // buyer holding a code that never came alive and no obvious way to fix it.
    // voucher_activate() only acts on a pending voucher, so passing through
    // several of these in turn activates once.
    if (VOUCHER_SETTLED_STATUSES.has(nextStatus) && !VOUCHER_SETTLED_STATUSES.has(previousStatus)) {
      const voucher = await activateVoucherForOrder(orderId);
      if (voucher) console.log(`[voucher] ${voucher.code} activated by ${orderId} (${nextStatus})`);
    } else if (nextStatus === "Cancelled" && previousStatus !== "Cancelled") {
      const owed = await reverseVoucherForOrder(orderId);
      // Non-zero means the voucher had already expired or been voided, so the
      // value could not go back onto it. Surfaced rather than silently
      // dropped -- somebody is owed this.
      if (owed > 0) {
        console.warn(`[voucher] ${orderId} cancelled but its voucher is closed; ${owed} Sangu owed to the purchaser`);
      }
    }
  } catch (err) {
    console.error(`[voucher] order hook failed for ${orderId} (${previousStatus} -> ${nextStatus}):`, err);
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
    await runVoucherHook(orderId, previous.status, status);
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
    await runVoucherHook(orderId, order.status, "Cancelled");
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

/**
 * Sends the customer their receipt on demand.
 *
 * The automatic send fires once, on the first transition into Confirmed. That
 * is right for the common case and useless for every other one: mail that
 * bounced, an address corrected after the fact, a customer who deleted it, or
 * an order confirmed while SMTP was down. This is the manual escape hatch, and
 * unlike the automatic path it reports what happened rather than logging it —
 * the admin pressed a button and is entitled to know whether it worked.
 *
 * Deliberately not restricted to Confirmed orders: the reason to re-send is
 * usually that something went wrong, and refusing on a status technicality
 * would block exactly the case this exists for.
 */
export async function sendOrderReceiptAction(orderId: string): Promise<{ ok: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) return { error: "Not authorised." };

  const order = await getOrderById(orderId);
  if (!order) return { error: "That order no longer exists." };
  if (!order.customer.email) return { error: "This order has no email address on it." };

  const result = await sendOrderReceiptEmail({
    to: order.customer.email,
    name: order.customer.name,
    order,
  });
  if ("error" in result) {
    console.error(`[receipt] manual send for ${order.orderNumber} failed:`, result.error);
    return { error: result.error };
  }
  console.log(`[receipt] manual send for ${order.orderNumber} -> ${order.customer.email}`);
  return { ok: true };
}
