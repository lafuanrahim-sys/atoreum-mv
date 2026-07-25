import Image from "next/image";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/data/orders.server";
import { changeOrderStatus } from "@/app/actions/orders";
import type { OrderStatus } from "@/lib/types";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

const STATUSES: OrderStatus[] = [
  "Pending Verification",
  "Confirmed",
  "Shipped",
  "Completed",
  "Cancelled",
];

export default async function DashboardOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = getOrderById(id);
  if (!order) notFound();

  const isProofImage = order.paymentProofPath && !order.paymentProofPath.endsWith(".pdf");
  const paymentMethod = order.paymentMethod ?? "transfer";

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ivory">{order.orderNumber}</h1>
          <p className="mt-1 text-xs text-ivory-dim">
            Placed {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>

        {order.status === "Completed" ? (
          <p className="flex items-center gap-2 border-2 border-emerald-600 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
            ✓ Order Completed
          </p>
        ) : (
          order.status !== "Cancelled" && (
            <form
              action={async () => {
                "use server";
                await changeOrderStatus(order.id, "Completed");
              }}
            >
              <button
                type="submit"
                className="bg-emerald-600 px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-lg transition-colors hover:bg-emerald-500"
              >
                ✓ Mark as Completed
              </button>
            </form>
          )
        )}
      </div>

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
              className="bg-gold-deep px-4 py-2 text-xs uppercase tracking-wide text-ink hover:bg-gold-deep/90"
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
              <span className="text-ivory-dim tabular-nums">
                {formatPrice(item.price * item.quantity, item.currency)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-line pt-3 text-base">
          <span className="text-ivory">Total</span>
          <span className="text-ivory tabular-nums">{formatPrice(order.subtotal, order.currency)}</span>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xs uppercase tracking-wide text-ivory-dim">Payment</h2>
        <p className="mt-2 text-sm text-ivory">
          {paymentMethod === "cash" ? "Cash on delivery" : "Bank transfer"}
        </p>
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
          <p className="mt-3 text-sm text-ivory-dim">
            {paymentMethod === "cash"
              ? "Not applicable — payment is collected in cash on delivery."
              : "No proof uploaded yet."}
          </p>
        )}
      </div>
    </div>
  );
}
