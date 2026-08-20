"use server";

import { getOrderById } from "@/lib/data/orders.server";
import { sendOrderReceiptEmail } from "@/lib/email";
import { headers } from "next/headers";
import { orderAccessToken, verifyOrderAccessToken } from "@/lib/orderAccessToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { SITE_URL } from "@/lib/site";

/**
 * Re-send an order's details to an address the customer names.
 *
 * People mistype their own email constantly, and for a guest the emailed order
 * number is the only durable handle they have on the order. A receipt sitting
 * in a mailbox that does not exist is the same as one never sent, so there has
 * to be a second chance that does not require contacting the shop.
 *
 * THE ACCESS TOKEN IS THE CREDENTIAL, not the order id. An earlier version of
 * this took the id alone, which was wrong in a way worth spelling out: ids are
 * `ord-{timestamp}-{3 random bytes}`, so twenty-four bits of randomness on a
 * guessable timestamp, and the per-order rate limit does nothing against
 * someone trying a different id each time. Anyone who found one could have the
 * customer's name, items and totals emailed to an address of their choosing --
 * along with a confirmation link carrying a VALID access token, which is
 * durable access rather than a one-off disclosure.
 *
 * Requiring the token means only someone who legitimately reached the
 * confirmation page can resend, which is exactly the set of people the feature
 * is for.
 */

/** Sends per order. Enough for a genuine mistake, useless for anything else. */
const RESENDS_PER_ORDER_PER_HOUR = 3;

/** Attempts per caller, so trying many different order ids is bounded too. */
const ATTEMPTS_PER_CALLER_PER_HOUR = 10;

export async function resendOrderEmailAction(
  orderId: string,
  token: string,
  email: string
): Promise<{ ok: boolean; message: string }> {
  const to = email.trim();

  // Bounded before anything else, so id-guessing costs the attacker rather
  // than the shop. Keyed on IP because there is no session to key on: the
  // whole point is that guests use this.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`order-resend-ip:${ip}`, ATTEMPTS_PER_CALLER_PER_HOUR, 3_600)) {
    return { ok: false, message: "Too many attempts. Please email sales@aranzo.co." };
  }

  // The token proves the caller reached the confirmation page for THIS order.
  // Checked before the database is touched, so a wrong token costs a hash and
  // not a query.
  if (!verifyOrderAccessToken(orderId, token)) {
    return { ok: false, message: "We could not send that. Please email sales@aranzo.co." };
  }

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
