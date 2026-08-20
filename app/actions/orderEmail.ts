"use server";

import { getOrderById } from "@/lib/data/orders.server";
import { sendOrderReceiptEmail } from "@/lib/email";
import { orderAccessToken } from "@/lib/orderAccessToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { SITE_URL } from "@/lib/site";

/**
 * Re-send an order's details to an address the customer names.
 *
 * People mistype their own email constantly, and for a guest the emailed
 * order number is the only durable handle they have on the order. A receipt
 * sitting in a mailbox that does not exist is the same as one never sent, so
 * there has to be a second chance that does not require contacting the shop.
 *
 * The order id is the credential here, which is weaker than it sounds and
 * stronger than it looks. Ids are unguessable, and the page offering this is
 * reached with an access token; but a link forwarded to someone else would let
 * them send the order details onward, so this is rate limited hard and reveals
 * nothing in its own response.
 */

/** Sends per order. Enough for a genuine mistake, useless for anything else. */
const RESENDS_PER_ORDER_PER_HOUR = 3;

export async function resendOrderEmailAction(
  orderId: string,
  email: string
): Promise<{ ok: boolean; message: string }> {
  const to = email.trim();

  // Deliberately shallow. Real validation is the mail server accepting it;
  // a stricter pattern here would reject valid addresses and teach nobody
  // anything.
  if (!to.includes("@") || to.length < 5 || to.length > 200) {
    return { ok: false, message: "That does not look like an email address." };
  }

  if (!checkRateLimit(`order-resend:${orderId}`, RESENDS_PER_ORDER_PER_HOUR, 3_600)) {
    return {
      ok: false,
      message: "That has been sent a few times already. Please email sales@aranzo.co if it has not arrived.",
    };
  }

  const order = await getOrderById(orderId);
  // Same answer whether the order is missing or the send failed: a caller
  // poking at order ids learns nothing either way.
  if (!order) {
    return { ok: false, message: "We could not send that. Please email sales@aranzo.co." };
  }

  const result = await sendOrderReceiptEmail({
    to,
    name: order.customer.name,
    order,
    orderUrl: `${SITE_URL}/order-confirmation/${order.id}?t=${orderAccessToken(order.id)}`,
  });

  if ("error" in result) {
    console.error(`[order-email] resend of ${order.orderNumber} to ${to} failed:`, result.error);
    return { ok: false, message: "We could not send that. Please email sales@aranzo.co." };
  }

  return { ok: true, message: `Sent to ${to}. Check spam if it has not arrived in a few minutes.` };
}
