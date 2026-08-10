import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/data/orders.server";
import { changeOrderStatus } from "@/app/actions/orders";
import AdminActionButton from "@/components/dashboard/AdminActionButton";
import OrderStatusForm from "@/components/dashboard/OrderStatusForm";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

export default async function DashboardOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  const isProofImage = order.paymentProofPath && !order.paymentProofPath.endsWith(".pdf");
  const paymentMethod = order.paymentMethod ?? "transfer";

  return (
    <div className="max-w-3xl">
      {/* Invoice masthead */}
      <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-ivory pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-sand">Order Record</p>
          <h1 className="mt-3 font-admin-heading text-3xl font-bold text-ivory md:text-4xl">{order.orderNumber}</h1>
          <p className="mt-2 font-mono text-xs text-ivory-dim">
            Placed {new Date(order.createdAt).toLocaleString()}
          </p>
          <Link
            href={`/invoice/${order.id}`}
            className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.15em] text-gold-deep hover:underline"
          >
            Tax invoice →
          </Link>
        </div>

        {order.status === "Completed" ? (
          <p className="flex items-center gap-2 border-2 border-emerald-600 px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-emerald-600">
            <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
              <path d="M3 8.5l3.2 3.2L13 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Completed
          </p>
        ) : (
          order.status !== "Cancelled" && (
            <AdminActionButton
              action={async () => {
                "use server";
                await changeOrderStatus(order.id, "Completed");
              }}
              label="Mark as Completed"
              pendingLabel="Updating…"
              variant="success"
              className="px-6 py-3 text-xs shadow-lg"
              toastMessage={`${order.orderNumber} marked as completed.`}
              icon={
                <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
                  <path d="M3 8.5l3.2 3.2L13 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            />
          )
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Bill To</h2>
          <p className="mt-3 font-admin-heading font-semibold text-ivory">{order.customer.name}</p>
          <p className="mt-1 text-sm text-ivory-dim">{order.customer.email}</p>
          <p className="text-sm text-ivory-dim">{order.customer.phone}</p>
          <p className="mt-2 text-sm text-ivory-dim">{order.customer.address}</p>
        </div>

        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Status</h2>
          <OrderStatusForm orderId={order.id} currentStatus={order.status} changeStatus={changeOrderStatus} />
        </div>
      </div>

      <div className="mt-10">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Items</h2>
        <ul className="mt-4 flex flex-col border-t border-line">
          {order.items.map((item) => (
            <li key={item.productId} className="flex items-baseline justify-between gap-4 border-b border-line py-3 text-sm">
              <span className="text-ivory">
                {item.name} <span className="font-mono text-ivory-dim">× {item.quantity}</span>
              </span>
              <span className="shrink-0 font-mono tabular-nums text-ivory-dim">
                {formatPrice(item.price * item.quantity, item.currency)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-baseline justify-between border-t-2 border-ivory pt-3">
          <span className="font-admin-heading font-semibold text-ivory">Total</span>
          <span className="font-mono text-xl tabular-nums text-ivory">{formatPrice(order.subtotal, order.currency)}</span>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Payment</h2>
          <p className="mt-3 text-sm text-ivory">
            {paymentMethod === "cash" ? "Cash on delivery" : "Bank transfer"}
          </p>
        </div>

        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Payment Proof</h2>
          {order.paymentProofPath ? (
            isProofImage ? (
              <a href={order.paymentProofPath} target="_blank" rel="noopener noreferrer">
                <div className="relative mt-3 h-48 w-48 overflow-hidden border border-line">
                  <Image src={order.paymentProofPath} alt="Payment proof" fill className="object-contain" />
                </div>
              </a>
            ) : (
              <a
                href={order.paymentProofPath}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block font-mono text-sm text-gold-deep hover:underline"
              >
                View uploaded PDF
              </a>
            )
          ) : (
            <p className="mt-3 text-sm text-ivory-dim">
              {paymentMethod === "cash"
                ? "Not applicable. Payment is collected in cash on delivery."
                : "No proof uploaded yet."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
