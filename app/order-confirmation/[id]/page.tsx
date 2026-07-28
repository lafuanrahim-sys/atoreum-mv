import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/data/orders.server";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

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
          <p className="text-sm leading-relaxed text-ivory-dim">
            Your order is <span className="text-gold">Pending Verification</span>. We&apos;ll
            confirm it as soon as we&apos;ve verified your bank transfer{" "}
            {order.paymentProofPath
              ? "and payment proof."
              : "— if you haven't uploaded your receipt yet, you can reply to your confirmation email with it, or contact us directly."}
          </p>

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
