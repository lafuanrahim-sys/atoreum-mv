import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/data/orders.server";
import { verifyOrderAccessToken } from "@/lib/orderAccessToken";
import { getCurrentUser } from "@/lib/auth/currentUser.server";

/**
 * Never indexed. The URL carries an access token and the page shows a
 * customer's name, address and order contents -- exactly what must not appear
 * in a search result. app/robots.ts disallows the path too; this covers the
 * case where the link is shared and a crawler reaches it regardless.
 */
export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
};

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

/**
 * This used to be one hardcoded paragraph assuming every order was an
 * unverified bank transfer -- wrong for cash orders (Confirmed immediately
 * at checkout, no transfer involved at all) and wrong again for a transfer
 * order revisited after an admin has already verified it. Branches on the
 * order's actual paymentMethod + current status instead.
 */
function statusMessage(order: { status: string; paymentMethod?: string; paymentProofPath: string | null }) {
  if (order.paymentMethod === "cash") {
    return "Your order is confirmed. Please have the exact amount ready in cash for our courier when it's delivered.";
  }
  if (order.status === "Pending Verification") {
    return (
      "Your order is Pending Verification. We'll confirm it as soon as we've verified your bank transfer" +
      (order.paymentProofPath
        ? " and payment proof."
        : ". If you haven't uploaded your receipt yet, you can reply to your confirmation email with it, or contact us directly.")
    );
  }
  if (order.status === "Cancelled") {
    return "This order has been cancelled.";
  }
  // Confirmed/Shipped/Completed bank transfer -- payment already verified.
  return "Your order is confirmed. Thank you for your payment.";
}

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t: token } = await searchParams;
  const order = await getOrderById(id);
  if (!order) notFound();

  // The order id is also its DB primary key -- short and never meant to be
  // secret, so it can't be trusted as a bearer credential on its own (it's
  // guessable/enumerable). Allow access either via the one-time token minted
  // at checkout (checkout.ts) and carried in the redirect URL -- covers
  // guest checkouts, which have no account to check ownership against -- or,
  // same ownership rule the account page already uses, for a signed-in user
  // revisiting later.
  const hasValidToken = verifyOrderAccessToken(id, token);
  if (!hasValidToken) {
    const user = await getCurrentUser();
    const owns =
      !!user && (order.userId === user.id || order.customer.email.toLowerCase() === user.email.toLowerCase());
    if (!owns) notFound();
  }

  return (
    <div className="page-gutter bg-ink pt-10 pb-28 md:pt-14">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Order Received</p>
        <h1 className="mt-6 font-display text-3xl text-ivory md:text-4xl">
          Thank you, {order.customer.name.split(" ")[0]}.
        </h1>
        <p className="mt-4 text-sm uppercase tracking-[0.2em] text-ivory-dim">
          Order {order.orderNumber}
        </p>

        <div className="mt-10 border border-line p-8 text-left">
          <p className="text-sm leading-relaxed text-ivory-dim">{statusMessage(order)}</p>

          <ul className="mt-6 flex flex-col gap-3 border-t border-line pt-6">
            {order.items.map((item) => (
              <li key={item.productId} className="flex justify-between text-sm">
                <span className="text-ivory">
                  {item.name} <span className="text-ivory-dim">× {item.quantity}</span>
                </span>
                <span className="text-ivory-dim tabular-nums">
                  {formatPrice(item.price * item.quantity, item.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-between border-t border-line pt-6 text-base">
            <span className="text-ivory">Total</span>
            <span className="text-ivory tabular-nums">{formatPrice(order.subtotal, order.currency)}</span>
          </div>
        </div>

        <Link
          href="/products"
          className="mt-10 inline-block border border-gold px-8 py-4 text-xs uppercase tracking-[0.2em] text-gold transition-colors hover:bg-gold-deep hover:text-ink"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
