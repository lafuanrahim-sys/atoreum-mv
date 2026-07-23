import Link from "next/link";
import { getAllOrders } from "@/lib/data/orders.server";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

/**
 * Pre-orders = bank-transfer orders still awaiting payment verification.
 * They're reserved but not yet confirmed sales, so they get their own queue
 * separate from the full order list.
 */
export default function DashboardPreOrdersPage() {
  const preorders = getAllOrders().filter((o) => o.status === "Pending Verification");

  return (
    <div>
      <h1 className="font-display text-2xl text-ivory">Pre-Orders ({preorders.length})</h1>
      <p className="mt-1 text-sm text-ivory-dim">
        Orders awaiting bank-transfer verification. Confirm or cancel them from the order page.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-ink">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ivory-dim">
              <th className="px-5 py-3">Order #</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Items</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3">Placed</th>
              <th className="px-5 py-3">Proof</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {preorders.map((o) => (
              <tr key={o.id} className="border-b border-line/50 last:border-b-0">
                <td className="px-5 py-3 text-ivory">{o.orderNumber}</td>
                <td className="px-5 py-3 text-ivory-dim">{o.customer.name}</td>
                <td className="px-5 py-3 text-ivory-dim tabular-nums">
                  {o.items.reduce((n, i) => n + i.quantity, 0)}
                </td>
                <td className="px-5 py-3 text-ivory-dim tabular-nums">
                  {formatPrice(o.subtotal, o.currency)}
                </td>
                <td className="px-5 py-3 text-ivory-dim">
                  {new Date(o.createdAt).toLocaleDateString()}
                </td>
                <td className="px-5 py-3">
                  {o.paymentProofPath ? (
                    <span className="text-xs uppercase tracking-wide text-sand">Uploaded</span>
                  ) : (
                    <span className="text-xs uppercase tracking-wide text-gold">Awaiting</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/dashboard/orders/${o.id}`} className="text-gold hover:underline">
                    Review
                  </Link>
                </td>
              </tr>
            ))}
            {preorders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-sm text-ivory-dim">
                  No pre-orders waiting — all caught up.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
