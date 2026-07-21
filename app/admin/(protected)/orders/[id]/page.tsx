import Image from "next/image";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/data/orders.server";
import { changeOrderStatus } from "@/app/actions/orders";
import type { OrderStatus } from "@/lib/types";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

const STATUSES: OrderStatus[] = ["Pending Verification", "Confirmed", "Shipped", "Cancelled"];

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = getOrderById(id);
  if (!order) notFound();

  const isProofImage = order.paymentProofPath && !order.paymentProofPath.endsWith(".pdf");

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl text-ivory">{order.orderNumber}</h1>
      <p className="mt-1 text-xs text-ivory-dim">
        Placed {new Date(order.createdAt).toLocaleString()}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-8">
        <div>
          <h2 className="text-xs uppercase tracking-wide text-ivory-dim">Customer</h2>
          <p className="mt-2 text-sm text-ivory">{order.customer.name}</p>
          <p className="text-sm text-ivory-dim">{order.customer.email}</p>
          <p className="text-sm text-ivory-dim">{order.customer.phone}</p>
          <p className="mt-2 text-sm text-ivory-dim">{order.customer.address}</p>
        </div>

        <div>
          <h2 className="text-xs uppercase tracking-wide text-ivory-dim">Status</h2>
          <form
            action={async (formData: FormData) => {
              "use server";
              await changeOrderStatus(order.id, formData.get("status") as OrderStatus);
            }}
            className="mt-2 flex gap-3"
          >
            <select
              name="status"
              defaultValue={order.status}
              className="border border-line bg-transparent px-3 py-2 text-sm text-ivory"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s} className="bg-ink-2">
                  {s}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-gold px-4 py-2 text-xs uppercase tracking-wide text-ink hover:bg-gold/90"
            >
              Update
            </button>
          </form>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xs uppercase tracking-wide text-ivory-dim">Items</h2>
        <ul className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          {order.items.map((item) => (
            <li key={item.productId} className="flex justify-between text-sm">
              <span className="text-ivory">
                {item.name} <span className="text-ivory-dim">× {item.quantity}</span>
              </span>
              <span className="text-ivory-dim">
                {formatPrice(item.price * item.quantity, item.currency)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-line pt-3 text-base">
          <span className="text-ivory">Total</span>
          <span className="text-ivory">{formatPrice(order.subtotal, order.currency)}</span>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xs uppercase tracking-wide text-ivory-dim">Payment Proof</h2>
        {order.paymentProofPath ? (
          isProofImage ? (
            <a href={order.paymentProofPath} target="_blank" rel="noopener noreferrer">
              <div className="relative mt-3 h-64 w-64 overflow-hidden border border-line">
                <Image src={order.paymentProofPath} alt="Payment proof" fill className="object-contain" />
              </div>
            </a>
          ) : (
            <a
              href={order.paymentProofPath}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-gold hover:underline"
            >
              View uploaded PDF
            </a>
          )
        ) : (
          <p className="mt-3 text-sm text-ivory-dim">No proof uploaded yet.</p>
        )}
      </div>
    </div>
  );
}
